-- Fase 6: Panel administrativo, suspension de cuentas, moderacion de inmuebles,
-- verificaciones de propietarios, reportes extendidos y bitacora de auditoria inmutable.
-- Migracion estrictamente aditiva e idempotente (no modifica 0001..0005).

-- ============================================================================
-- 1. SUSPENSION DE USUARIOS EN public.profiles
-- ============================================================================

alter table public.profiles
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_reason text,
  add column if not exists suspended_by uuid references public.profiles(id) on delete set null;

create index if not exists idx_profiles_role_suspended
  on public.profiles(role, suspended_at);

drop policy if exists "profiles admin read" on public.profiles;
create policy "profiles admin read"
  on public.profiles
  for select
  using (public.is_admin());

-- Actualiza la funcion existente de 0004 (el trigger trg_protect_profile_sensitive_fields ya apunta a ella)
create or replace function public.protect_profile_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('role', true) = 'service_role' or public.is_admin() then
    -- Impedir que un administrador se suspenda o reactive a si mismo
    if auth.uid() is not null
       and old.id = auth.uid()
       and new.suspended_at is distinct from old.suspended_at then
      raise exception 'Un administrador no puede suspender o reactivar su propia cuenta';
    end if;

    -- Impedir suspender o degradar al ultimo administrador activo
    if old.role = 'admin'
       and old.suspended_at is null
       and (new.suspended_at is not null or new.role is distinct from 'admin') then
      if not exists (
        select 1
        from public.profiles p
        where p.id <> old.id
          and p.role = 'admin'
          and p.suspended_at is null
      ) then
        raise exception 'No se puede suspender o cambiar el rol del ultimo administrador activo';
      end if;
    end if;

    new.updated_at := now();
    return new;
  end if;

  if old.suspended_at is not null then
    raise exception 'Tu cuenta se encuentra suspendida y no puede modificar el perfil';
  end if;

  if new.role is distinct from old.role then
    raise exception 'No tienes permisos para cambiar el rol del perfil';
  end if;

  if new.email is distinct from old.email then
    raise exception 'El correo del perfil no puede modificarse directamente';
  end if;

  if new.suspended_at is distinct from old.suspended_at
     or new.suspended_reason is distinct from old.suspended_reason
     or new.suspended_by is distinct from old.suspended_by then
    raise exception 'No tienes permisos para modificar el estado de suspension';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- ============================================================================
-- 2. MODERACION NO DESTRUCTIVA DE INMUEBLES EN public.properties
-- ============================================================================

alter table public.properties
  add column if not exists moderation_status text not null default 'active',
  add column if not exists moderation_reason text,
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid references public.profiles(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'properties_moderation_status_check'
      and conrelid = 'public.properties'::regclass
  ) then
    alter table public.properties
      add constraint properties_moderation_status_check
      check (moderation_status in ('active', 'paused_by_admin', 'suspended'));
  end if;
end $$;

create index if not exists idx_properties_moderation_status
  on public.properties(moderation_status);

-- Ocultar inmuebles moderados del catalogo publico conservando acceso a duenos, admin e inquilinos vinculados
drop policy if exists "properties public read" on public.properties;
create policy "properties public read"
  on public.properties
  for select
  using (
    (status = 'published' and moderation_status = 'active')
    or owner_id = auth.uid()
    or public.is_admin()
    or public.is_property_related_user(id)
  );

drop policy if exists "properties admin update" on public.properties;
create policy "properties admin update"
  on public.properties
  for update
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.protect_property_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('role', true) = 'service_role' or public.is_admin() then
    if tg_op = 'UPDATE' then
      new.updated_at := now();
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.moderation_status := 'active';
    new.moderation_reason := null;
    new.moderated_at := null;
    new.moderated_by := null;
    return new;
  end if;

  if new.moderation_status is distinct from old.moderation_status
     or new.moderation_reason is distinct from old.moderation_reason
     or new.moderated_at is distinct from old.moderated_at
     or new.moderated_by is distinct from old.moderated_by then
    raise exception 'Solo un administrador puede modificar la moderacion del inmueble';
  end if;

  if old.moderation_status <> 'active'
     and new.status is distinct from old.status
     and new.status = 'published' then
    raise exception 'Este inmueble tiene una medida administrativa vigente y no puede publicarse hasta ser restaurado';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_property_moderation on public.properties;
create trigger trg_protect_property_moderation
  before insert or update on public.properties
  for each row execute function public.protect_property_moderation();

-- ============================================================================
-- 3. BITACORA DE AUDITORIA INMUTABLE EN public.activity_log
-- ============================================================================

alter table public.activity_log
  add column if not exists target_type text,
  add column if not exists target_id text,
  add column if not exists result text not null default 'success',
  add column if not exists details jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'activity_log_result_check'
      and conrelid = 'public.activity_log'::regclass
  ) then
    alter table public.activity_log
      add constraint activity_log_result_check
      check (result in ('success', 'denied', 'error'));
  end if;
end $$;

create index if not exists idx_activity_log_created_at
  on public.activity_log(created_at desc);

create index if not exists idx_activity_log_user_created
  on public.activity_log(user_id, created_at desc);

create index if not exists idx_activity_log_target
  on public.activity_log(target_type, target_id);

-- Retirar la politica permisiva anterior ("for all") y restringir lectura solo a admin.
-- Ningun rol autenticado o anonimo puede insertar/modificar/eliminar desde el cliente;
-- las inserciones autorizadas ocurren unicamente en servidor via service_role.
drop policy if exists "activity_log self" on public.activity_log;
drop policy if exists "activity_log admin read" on public.activity_log;
create policy "activity_log admin read"
  on public.activity_log
  for select
  using (public.is_admin());

revoke insert, update, delete on public.activity_log from anon, authenticated;

create or replace function public.prevent_activity_log_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'La bitacora de auditoria es inmutable y no permite operaciones de actualizacion o eliminacion';
end;
$$;

drop trigger if exists trg_prevent_activity_log_mutation on public.activity_log;
create trigger trg_prevent_activity_log_mutation
  before update or delete on public.activity_log
  for each row execute function public.prevent_activity_log_mutation();

-- ============================================================================
-- 4. REPORTES Y VERIFICACIONES DE PROPIETARIOS
-- ============================================================================

alter table public.reports
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_reports_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_reports_updated_at on public.reports;
create trigger trg_touch_reports_updated_at
  before update on public.reports
  for each row execute function public.touch_reports_updated_at();

alter table public.owner_verifications
  add column if not exists notes text,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

drop policy if exists "owner_verifications admin all" on public.owner_verifications;
create policy "owner_verifications admin all"
  on public.owner_verifications
  for all
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.protect_owner_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('role', true) = 'service_role' or public.is_admin() then
    new.updated_at := now();
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.email_verified := false;
    new.phone_verified := false;
    new.status := 'pendiente';
    new.notes := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.updated_at := now();
    return new;
  end if;

  if new.notes is distinct from old.notes
     or new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at then
    raise exception 'Solo un administrador puede registrar notas o revisiones de verificacion';
  end if;

  if new.email_verified is distinct from old.email_verified
     or new.phone_verified is distinct from old.phone_verified
     or new.status is distinct from old.status then
    if new.identity_doc_url is distinct from old.identity_doc_url then
      new.status := 'pendiente';
      new.email_verified := old.email_verified;
      new.phone_verified := old.phone_verified;
      new.updated_at := now();
      return new;
    end if;
    raise exception 'Solo un administrador puede aprobar o modificar el estado de verificacion';
  end if;

  new.updated_at := now();
  return new;
end;
$$;
