-- Fase 7: Configuracion de plazos en servidor, ciclo de vida y vencimientos automaticos
-- de solicitudes (120h reales), declaracion y firma obligatorias, minimo 4 fotografias
-- sin evasion por service_role/admin, endurecimiento de request-documents, bucket privado
-- profile-avatars y resenas verificadas.
-- Migracion estrictamente aditiva e idempotente (no modifica 0001..0006 ni registros existentes).

-- ============================================================================
-- 1. CONFIGURACION DE PLAZOS DE SOLICITUD EN public.platform_settings (SOLO ADMIN/SERVIDOR)
-- ============================================================================

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null check (jsonb_typeof(value) = 'object'),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;

revoke all on public.platform_settings from anon;
revoke insert, update, delete on public.platform_settings from authenticated;

drop policy if exists "platform_settings public read" on public.platform_settings;
drop policy if exists "platform_settings admin read" on public.platform_settings;
drop policy if exists "platform_settings admin write" on public.platform_settings;

create policy "platform_settings admin read"
  on public.platform_settings
  for select
  using (public.is_admin());

create policy "platform_settings admin write"
  on public.platform_settings
  for all
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.touch_platform_settings_updated_at()
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

drop trigger if exists trg_touch_platform_settings_updated_at on public.platform_settings;
create trigger trg_touch_platform_settings_updated_at
  before update on public.platform_settings
  for each row execute function public.touch_platform_settings_updated_at();

insert into public.platform_settings (key, value)
values (
  'request_deadlines',
  '{"filter1_days": 5, "filter2_docs_days": 5, "filter2_decision_days": 5, "reminder_hours": 24}'::jsonb
)
on conflict (key) do nothing;

-- ============================================================================
-- 2. FORMULARIO DE SOLICITUD, FIRMA PRIVADA Y PLAZOS EN public.rental_requests
-- ============================================================================

alter table public.rental_requests
  add column if not exists applicant_full_name text,
  add column if not exists applicant_phone text,
  add column if not exists rental_reason text,
  add column if not exists household_size int,
  add column if not exists has_children boolean not null default false,
  add column if not exists children_count int not null default 0,
  add column if not exists has_pets boolean not null default false,
  add column if not exists pets_type text,
  add column if not exists pets_count int not null default 0,
  add column if not exists additional_info text,
  add column if not exists truth_declaration_accepted boolean not null default false,
  add column if not exists applicant_signature_url text,
  add column if not exists cancelled_by_role text,
  add column if not exists second_deadline timestamptz,
  add column if not exists first_reminder_sent boolean not null default false,
  add column if not exists second_reminder_sent boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rental_requests_household_size_check'
      and conrelid = 'public.rental_requests'::regclass
  ) then
    alter table public.rental_requests
      add constraint rental_requests_household_size_check
      check (household_size is null or household_size >= 1) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rental_requests_counts_non_negative_check'
      and conrelid = 'public.rental_requests'::regclass
  ) then
    alter table public.rental_requests
      add constraint rental_requests_counts_non_negative_check
      check (children_count >= 0 and pets_count >= 0) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rental_requests_children_consistency_check'
      and conrelid = 'public.rental_requests'::regclass
  ) then
    alter table public.rental_requests
      add constraint rental_requests_children_consistency_check
      check (
        (not has_children and children_count = 0)
        or (has_children and children_count >= 1)
      ) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rental_requests_pets_consistency_check'
      and conrelid = 'public.rental_requests'::regclass
  ) then
    alter table public.rental_requests
      add constraint rental_requests_pets_consistency_check
      check (
        (not has_pets and pets_count = 0 and pets_type is null)
        or (has_pets and pets_count >= 1 and pets_type is not null and length(trim(pets_type)) >= 2)
      ) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rental_requests_cancelled_by_role_check'
      and conrelid = 'public.rental_requests'::regclass
  ) then
    alter table public.rental_requests
      add constraint rental_requests_cancelled_by_role_check
      check (cancelled_by_role is null or cancelled_by_role in ('tenant', 'owner', 'admin', 'system')) not valid;
  end if;

  -- Impide solicitudes nuevas o activas incompletas en estado pending;
  -- marcado NOT VALID para no romper solicitudes historicas pre-0007 en staging.
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rental_requests_pending_complete_check'
      and conrelid = 'public.rental_requests'::regclass
  ) then
    alter table public.rental_requests
      add constraint rental_requests_pending_complete_check
      check (
        status <> 'pending'
        or (
          applicant_full_name is not null and length(trim(applicant_full_name)) >= 2
          and applicant_phone is not null and trim(applicant_phone) ~ '^[0-9+\-\s()]{7,20}$'
          and rental_reason is not null and length(trim(rental_reason)) >= 5
          and household_size is not null and household_size >= 1
          and truth_declaration_accepted = true
          and applicant_signature_url is not null
          and split_part(applicant_signature_url, '/', 1) = id::text
          and split_part(applicant_signature_url, '/', 2) = tenant_id::text
          and split_part(applicant_signature_url, '/', 3) = 'signature'
          and split_part(applicant_signature_url, '/', 4) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.png$'
          and split_part(applicant_signature_url, '/', 5) = ''
        )
      ) not valid;
  end if;
end $$;

create index if not exists idx_rental_requests_status_deadlines
  on public.rental_requests(status, first_deadline, second_deadline);

-- Valida formulario obligatorio, firma privada existente en request-documents y plazo inicial (120h)
create or replace function public.handle_rental_request_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg jsonb;
  v_filter1_hours int;
begin
  select value into v_cfg
  from public.platform_settings
  where key = 'request_deadlines';

  v_filter1_hours := greatest(coalesce(nullif(v_cfg->>'filter1_days', '')::int, 5), 1) * 24;

  -- Si no es una insercion con sesion de usuario ni service_role autorizado (ej. migracion SQL), no permitir solicitudes huerfanas
  if current_setting('role', true) <> 'service_role' and not public.is_admin() then
    if auth.uid() is null or new.tenant_id is distinct from auth.uid() then
      raise exception 'Solo el inquilino autenticado puede crear su propia solicitud';
    end if;
  end if;

  if new.id is null then
    new.id := gen_random_uuid();
  end if;

  if new.applicant_full_name is null or length(trim(new.applicant_full_name)) < 2 then
    raise exception 'El nombre completo del solicitante es obligatorio';
  end if;
  if new.applicant_phone is null or not (trim(new.applicant_phone) ~ '^[0-9+\-\s()]{7,20}$') then
    raise exception 'El telefono de contacto valido es obligatorio';
  end if;
  if new.rental_reason is null or length(trim(new.rental_reason)) < 5 then
    raise exception 'El motivo de arriendo es obligatorio';
  end if;
  if new.household_size is null or new.household_size < 1 then
    raise exception 'La cantidad de integrantes del hogar debe ser al menos 1';
  end if;
  if new.truth_declaration_accepted is distinct from true then
    raise exception 'Debes aceptar la declaracion de veracidad para enviar la solicitud';
  end if;

  if not new.has_children then
    new.children_count := 0;
  elsif new.children_count < 1 then
    raise exception 'Debes indicar al menos 1 hijo/menor si marcaste que tienes hijos';
  end if;

  if not new.has_pets then
    new.pets_count := 0;
    new.pets_type := null;
  elsif new.pets_count < 1 or new.pets_type is null or length(trim(new.pets_type)) < 2 then
    raise exception 'Debes indicar tipo y cantidad de mascotas si marcaste que tienes mascotas';
  end if;

  if new.applicant_signature_url is null
     or split_part(new.applicant_signature_url, '/', 1) <> new.id::text
     or split_part(new.applicant_signature_url, '/', 2) <> new.tenant_id::text
     or split_part(new.applicant_signature_url, '/', 3) <> 'signature'
     or not (split_part(new.applicant_signature_url, '/', 4) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.png$')
     or split_part(new.applicant_signature_url, '/', 5) <> '' then
    raise exception 'La firma manuscrita debe corresponder a una ruta privada valida de request-documents';
  end if;

  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'request-documents'
      and o.name = new.applicant_signature_url
  ) then
    raise exception 'La firma manuscrita indicada no existe en el bucket privado request-documents';
  end if;

  if current_setting('role', true) = 'service_role' or public.is_admin() then
    new.status := 'pending';
    new.first_deadline := coalesce(new.first_deadline, now() + make_interval(hours => v_filter1_hours));
    new.second_deadline := null;
    new.first_decision_at := null;
    new.rejection_reason := null;
    new.return_message := null;
    new.cancelled_by_role := null;
    new.first_reminder_sent := false;
    new.second_reminder_sent := false;
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := now();
    return new;
  end if;

  new.status := 'pending';
  new.first_deadline := now() + make_interval(hours => v_filter1_hours);
  new.second_deadline := null;
  new.first_decision_at := null;
  new.rejection_reason := null;
  new.return_message := null;
  new.cancelled_by_role := null;
  new.first_reminder_sent := false;
  new.second_reminder_sent := false;
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_handle_rental_request_insert on public.rental_requests;
create trigger trg_handle_rental_request_insert
  before insert on public.rental_requests
  for each row execute function public.handle_rental_request_insert();

-- Actualiza la funcion existente de 0004 (el trigger trg_enforce_rental_request_transitions ya apunta a ella)
-- Sin bypass general para service_role: cada canal privilegiado debe autenticar su contexto y alcance exacto.
create or replace function public.enforce_rental_request_transitions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_is_admin boolean;
  v_cfg jsonb;
  v_filter2_docs_hours int;
  v_filter2_decision_hours int;
  v_trusted_actor_id uuid;
  v_effective_uid uuid;
begin
  -- Bloquear modificacion directa de metadata interna por cualquier usuario normal
  if new.property_id is distinct from old.property_id
     or new.tenant_id is distinct from old.tenant_id
     or new.created_at is distinct from old.created_at then
    raise exception 'No es posible reasignar la propiedad, el inquilino ni la fecha de creacion de una solicitud';
  end if;

  -- Inmutabilidad estricta de datos declarados, declaracion y firma (incluso para service_role/admin)
  if new.applicant_full_name is distinct from old.applicant_full_name
     or new.applicant_phone is distinct from old.applicant_phone
     or new.rental_reason is distinct from old.rental_reason
     or new.household_size is distinct from old.household_size
     or new.has_children is distinct from old.has_children
     or new.children_count is distinct from old.children_count
     or new.has_pets is distinct from old.has_pets
     or new.pets_type is distinct from old.pets_type
     or new.pets_count is distinct from old.pets_count
     or new.additional_info is distinct from old.additional_info
     or new.truth_declaration_accepted is distinct from old.truth_declaration_accepted
     or new.applicant_signature_url is distinct from old.applicant_signature_url then
    raise exception 'Los datos personales declarados, la declaracion de veracidad y la firma son inmutables tras el envio';
  end if;

  -- 1. Activacion de contrato: cierre de solicitudes competidoras -> property_rented
  if pg_trigger_depth() > 1
     and nullif(current_setting('arriendaya.internal_contract_activation', true), '') is not null
     and new.status = 'property_rented'
     and old.status in ('pending', 'first_accepted', 'docs_submitted', 'returned')
     and new.first_deadline is not distinct from old.first_deadline
     and new.second_deadline is not distinct from old.second_deadline
     and new.first_decision_at is not distinct from old.first_decision_at
     and exists (
       select 1
       from public.contracts c
       where c.id::text = current_setting('arriendaya.internal_contract_activation', true)
         and c.property_id = old.property_id
         and c.status = 'active'
     ) then
    new.updated_at := now();
    return new;
  end if;

  -- 2. Vencimiento automatico y recordatorios desde process_request_deadlines()
  if auth.uid() is null
     and nullif(current_setting('arriendaya.internal_deadline_job', true), '') = 'active'
     and new.first_deadline is not distinct from old.first_deadline
     and new.second_deadline is not distinct from old.second_deadline
     and new.first_decision_at is not distinct from old.first_decision_at
     and new.cancelled_by_role is not distinct from old.cancelled_by_role
     and (
       (
         new.status = 'expired'
         and new.first_reminder_sent is not distinct from old.first_reminder_sent
         and new.second_reminder_sent is not distinct from old.second_reminder_sent
         and new.return_message is not distinct from old.return_message
         and (
           (old.status = 'pending' and old.first_deadline is not null and old.first_deadline <= now())
           or (
             old.status in ('first_accepted', 'docs_submitted', 'returned')
             and old.second_deadline is not null
             and old.second_deadline <= now()
           )
         )
       )
       or (
         new.status is not distinct from old.status
         and new.rejection_reason is not distinct from old.rejection_reason
         and new.return_message is not distinct from old.return_message
         and (
           (old.status = 'pending' and old.first_reminder_sent = false and new.first_reminder_sent = true and new.second_reminder_sent is not distinct from old.second_reminder_sent)
           or (
             old.status in ('first_accepted', 'docs_submitted', 'returned')
             and old.second_reminder_sent = false
             and new.second_reminder_sent = true
             and new.first_reminder_sent is not distinct from old.first_reminder_sent
           )
         )
       )
     ) then
    new.updated_at := now();
    return new;
  end if;

  -- 3. Rollback compensatorio limitado de second_accept (solo service_role cuando falla creacion de contrato)
  if current_setting('role', true) = 'service_role'
     and old.status = 'accepted'
     and new.status in ('docs_submitted', 'returned')
     and new.first_deadline is not distinct from old.first_deadline
     and new.second_deadline is not distinct from old.second_deadline
     and new.first_decision_at is not distinct from old.first_decision_at
     and new.rejection_reason is not distinct from old.rejection_reason
     and new.return_message is not distinct from old.return_message
     and new.cancelled_by_role is not distinct from old.cancelled_by_role
     and new.first_reminder_sent is not distinct from old.first_reminder_sent
     and new.second_reminder_sent is not distinct from old.second_reminder_sent
     and not exists (
       select 1 from public.contracts c where c.request_id = old.id
     ) then
    new.updated_at := now();
    return new;
  end if;

  -- 4. Operaciones administrativas excepcionales (sesion admin verificada o service_role auditado en activity_log)
  v_is_admin := public.is_admin();
  if v_is_admin
     or (
       current_setting('role', true) = 'service_role'
       and nullif(current_setting('arriendaya.admin_override_actor_id', true), '') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
       and exists (
         select 1
         from public.profiles adm
         where adm.id = (current_setting('arriendaya.admin_override_actor_id', true))::uuid
           and adm.role::text = 'admin'
           and adm.suspended_at is null
       )
     ) then
    if new.status = 'rejected' and old.status is distinct from 'rejected' then
      new.cancelled_by_role := coalesce(new.cancelled_by_role, 'admin');
    end if;
    new.updated_at := now();
    return new;
  end if;

  -- Resolver actor autenticado: auth.uid() directo o trusted_actor_id verificado exclusivamente bajo service_role
  if current_setting('role', true) = 'service_role'
     and nullif(current_setting('arriendaya.trusted_actor_id', true), '') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    v_trusted_actor_id := (current_setting('arriendaya.trusted_actor_id', true))::uuid;
  else
    v_trusted_actor_id := null;
  end if;

  v_effective_uid := coalesce(auth.uid(), v_trusted_actor_id);
  if v_effective_uid is null then
    raise exception 'No autorizado para modificar esta solicitud sin actor autenticado';
  end if;

  -- Impedir que el cliente manipule cancelled_by_role manualmente
  if new.cancelled_by_role is distinct from old.cancelled_by_role then
    raise exception 'El autor de cancelacion es asignado exclusivamente por el servidor';
  end if;

  select p.owner_id into v_owner_id
  from public.properties p
  where p.id = old.property_id;

  if old.status in ('accepted', 'rejected', 'expired', 'property_rented') then
    raise exception 'La solicitud se encuentra en estado final (%) y no admite modificaciones', old.status;
  end if;

  -- Bloquear avance si el plazo de la etapa vigente ya expiro
  if old.status = 'pending' and old.first_deadline is not null and old.first_deadline <= now() then
    raise exception 'El plazo del Filtro 1 vencio y la solicitud no puede continuar avanzando';
  end if;

  if old.status in ('first_accepted', 'docs_submitted', 'returned')
     and old.second_deadline is not null
     and old.second_deadline <= now() then
    raise exception 'El plazo del Filtro 2 vencio y la solicitud no puede continuar avanzando';
  end if;

  -- Impedir actualizaciones con el mismo estado para evitar manipulacion silenciosa de campos sensibles
  if old.status is not distinct from new.status then
    raise exception 'No se permiten actualizaciones sin transicion valida de estado';
  end if;

  select value into v_cfg
  from public.platform_settings
  where key = 'request_deadlines';

  v_filter2_docs_hours := greatest(coalesce(nullif(v_cfg->>'filter2_docs_days', '')::int, 5), 1) * 24;
  v_filter2_decision_hours := greatest(coalesce(nullif(v_cfg->>'filter2_decision_days', '')::int, 5), 1) * 24;

  -- 5. Transiciones normales del inquilino solicitante
  if v_effective_uid = old.tenant_id then
    if new.first_deadline is distinct from old.first_deadline
       or new.second_deadline is distinct from old.second_deadline
       or new.first_decision_at is distinct from old.first_decision_at
       or new.first_reminder_sent is distinct from old.first_reminder_sent
       or new.second_reminder_sent is distinct from old.second_reminder_sent
       or new.return_message is distinct from old.return_message then
      raise exception 'El inquilino no puede modificar plazos, fechas de decision, devoluciones ni banderas de recordatorio';
    end if;

    if old.status in ('first_accepted', 'returned') and new.status = 'docs_submitted' then
      if new.rejection_reason is distinct from old.rejection_reason then
        raise exception 'No puedes alterar el motivo de rechazo al enviar documentos';
      end if;
      new.second_deadline := now() + make_interval(hours => v_filter2_decision_hours);
      new.second_reminder_sent := false;
      new.updated_at := now();
      return new;
    end if;

    if old.status in ('pending', 'first_accepted', 'docs_submitted', 'returned') and new.status = 'rejected' then
      if new.labor_profile is distinct from old.labor_profile
         or new.has_cosigner is distinct from old.has_cosigner
         or new.cosigner_requires_property is distinct from old.cosigner_requires_property
         or new.desired_duration_value is distinct from old.desired_duration_value
         or new.desired_duration_unit is distinct from old.desired_duration_unit then
        raise exception 'No puedes alterar informacion laboral o de duracion al cancelar la solicitud';
      end if;
      new.cancelled_by_role := 'tenant';
      new.updated_at := now();
      return new;
    end if;

    raise exception 'Transicion de solicitud no permitida para inquilino (% -> %)', old.status, new.status;
  end if;

  -- 6. Transiciones normales del propietario del inmueble
  if v_effective_uid = v_owner_id then
    if new.labor_profile is distinct from old.labor_profile
       or new.has_cosigner is distinct from old.has_cosigner
       or new.cosigner_requires_property is distinct from old.cosigner_requires_property
       or new.desired_duration_value is distinct from old.desired_duration_value
       or new.desired_duration_unit is distinct from old.desired_duration_unit then
      raise exception 'El propietario no puede alterar la informacion laboral o de duracion declarada por el inquilino';
    end if;

    if new.first_deadline is distinct from old.first_deadline
       or new.first_reminder_sent is distinct from old.first_reminder_sent
       or new.second_deadline is distinct from old.second_deadline
       or new.second_reminder_sent is distinct from old.second_reminder_sent then
      raise exception 'El propietario no puede manipular directamente los plazos o banderas de recordatorio';
    end if;

    if old.status = 'pending' and new.status in ('first_accepted', 'rejected') then
      new.first_decision_at := now();
      if new.status = 'first_accepted' then
        if new.rejection_reason is distinct from old.rejection_reason
           or new.return_message is distinct from old.return_message then
          raise exception 'No puedes fijar mensajes de rechazo o devolucion al aprobar el Filtro 1';
        end if;
        new.second_deadline := now() + make_interval(hours => v_filter2_docs_hours);
        new.second_reminder_sent := false;
      else
        new.cancelled_by_role := 'owner';
      end if;
      new.updated_at := now();
      return new;
    end if;

    if new.first_decision_at is distinct from old.first_decision_at then
      raise exception 'No es posible modificar la fecha de decision del Filtro 1 en etapas posteriores';
    end if;

    if old.status = 'docs_submitted' and new.status = 'returned' then
      if new.return_message is null or length(trim(new.return_message)) = 0 then
        raise exception 'Debes indicar el motivo o correcciones requeridas al devolver la solicitud';
      end if;
      if new.rejection_reason is distinct from old.rejection_reason then
        raise exception 'No puedes fijar motivo de rechazo al devolver documentos';
      end if;
      new.second_deadline := now() + make_interval(hours => v_filter2_docs_hours);
      new.second_reminder_sent := false;
      new.updated_at := now();
      return new;
    end if;

    if old.status in ('docs_submitted', 'returned') and new.status in ('accepted', 'rejected') then
      if new.status = 'accepted' and new.rejection_reason is distinct from old.rejection_reason then
        raise exception 'No puedes fijar motivo de rechazo al aceptar definitivamente';
      end if;
      if new.status = 'rejected' then
        new.cancelled_by_role := 'owner';
      end if;
      new.updated_at := now();
      return new;
    end if;

    if old.status = 'first_accepted' and new.status = 'rejected' then
      new.cancelled_by_role := 'owner';
      new.updated_at := now();
      return new;
    end if;

    raise exception 'Transicion de solicitud no permitida para propietario (% -> %)', old.status, new.status;
  end if;

  raise exception 'No autorizado para cambiar el estado de esta solicitud';
end;
$$;

-- Actualiza la funcion existente de 0004 (el trigger trg_request_events_notify ya apunta a ella)
-- Detecta cancelacion de inquilino via cancelled_by_role (asignado confiablemente en trigger) o auth.uid()
create or replace function public.notify_request_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_prop_name text;
begin
  select owner_id, name into v_owner_id, v_prop_name
  from public.properties where id = new.property_id;

  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, type, title, message, link)
    values (
      v_owner_id,
      'request_created',
      'Nueva solicitud de arriendo',
      'Recibiste una solicitud para "' || coalesce(v_prop_name, 'tu inmueble') || '". Revisa el Filtro 1 dentro de las proximas 120 horas.',
      '/owner/requests/' || new.id::text
    );
    return new;
  end if;

  if old.status is distinct from new.status then
    if new.status = 'first_accepted' then
      insert into public.notifications (user_id, type, title, message, link)
      values (new.tenant_id, 'request_first_accepted', 'Filtro 1 aprobado', 'Tu solicitud para "' || coalesce(v_prop_name, 'el inmueble') || '" paso al Filtro 2. Tienes 5 dias calendario para cargar tus documentos.', '/tenant/requests/' || new.id::text);
    elsif new.status = 'docs_submitted' then
      insert into public.notifications (user_id, type, title, message, link)
      values (v_owner_id, 'docs_submitted', 'Documentos recibidos (Filtro 2)', 'El inquilino envio documentos para "' || coalesce(v_prop_name, 'tu inmueble') || '". Tienes 5 dias calendario para decidir.', '/owner/requests/' || new.id::text);
    elsif new.status = 'returned' then
      insert into public.notifications (user_id, type, title, message, link)
      values (new.tenant_id, 'request_returned', 'Solicitud devuelta (Filtro 2)', 'Tu solicitud para "' || coalesce(v_prop_name, 'el inmueble') || '" fue devuelta: ' || coalesce(new.return_message, 'revisa las observaciones'), '/tenant/requests/' || new.id::text);
    elsif new.status = 'accepted' then
      insert into public.notifications (user_id, type, title, message, link)
      values (new.tenant_id, 'request_accepted', 'Solicitud aceptada definitivamente', 'Tu solicitud para "' || coalesce(v_prop_name, 'el inmueble') || '" fue aceptada. Procede a firmar el contrato.', '/tenant/requests/' || new.id::text);
    elsif new.status = 'expired' then
      insert into public.notifications (user_id, type, title, message, link)
      values
        (new.tenant_id, 'request_expired', 'Solicitud vencida por plazo', 'El plazo de respuesta para "' || coalesce(v_prop_name, 'el inmueble') || '" expiro sin decision.', '/tenant/requests/' || new.id::text),
        (v_owner_id, 'request_expired', 'Solicitud vencida por plazo', 'La solicitud para "' || coalesce(v_prop_name, 'tu inmueble') || '" vencio al cumplirse el plazo de etapa.', '/owner/requests/' || new.id::text);
    elsif new.status = 'rejected' then
      if new.cancelled_by_role = 'tenant' or auth.uid() = new.tenant_id then
        insert into public.notifications (user_id, type, title, message, link)
        values (v_owner_id, 'request_cancelled', 'Solicitud cancelada', 'El inquilino cancelo la solicitud para "' || coalesce(v_prop_name, 'tu inmueble') || '".', '/owner/requests/' || new.id::text);
      else
        insert into public.notifications (user_id, type, title, message, link)
        values (new.tenant_id, 'request_rejected', 'Solicitud rechazada', 'Tu solicitud para "' || coalesce(v_prop_name, 'el inmueble') || '" fue rechazada: ' || coalesce(new.rejection_reason, ''), '/tenant/requests/' || new.id::text);
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- Funcion programable e idempotente para vencimientos y recordatorios de 24h
create or replace function public.process_request_deadlines(
  p_reminder_hours int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg jsonb;
  v_reminder_hours int;
  v_expired_count int := 0;
  v_reminded_count int := 0;
  v_row record;
  v_prop_name text;
begin
  if not pg_try_advisory_xact_lock(hashtext('arriendaya_process_request_deadlines')) then
    return jsonb_build_object('skipped', true, 'expired', 0, 'reminded', 0);
  end if;

  select value into v_cfg
  from public.platform_settings
  where key = 'request_deadlines';

  v_reminder_hours := greatest(
    coalesce(
      p_reminder_hours,
      nullif(v_cfg->>'reminder_hours', '')::int,
      24
    ),
    1
  );

  perform set_config('arriendaya.internal_deadline_job', 'active', true);

  -- 1. Expirar solicitudes en Filtro 1 vencidas (notify_request_events notifica a ambas partes)
  for v_row in
    update public.rental_requests
    set status = 'expired',
        rejection_reason = coalesce(rejection_reason, 'Vencida automaticamente por cumplimiento del plazo de Filtro 1')
    where status = 'pending'
      and first_deadline is not null
      and first_deadline <= now()
    returning id
  loop
    v_expired_count := v_expired_count + 1;
  end loop;

  -- 2. Expirar solicitudes en Filtro 2 vencidas (notify_request_events notifica a ambas partes)
  for v_row in
    update public.rental_requests
    set status = 'expired',
        rejection_reason = coalesce(rejection_reason, 'Vencida automaticamente por cumplimiento del plazo de Filtro 2')
    where status in ('first_accepted', 'docs_submitted', 'returned')
      and second_deadline is not null
      and second_deadline <= now()
    returning id
  loop
    v_expired_count := v_expired_count + 1;
  end loop;

  -- 3. Recordatorios preventivos Filtro 1 (una sola vez antes de vencer)
  for v_row in
    select r.id, r.property_id, r.tenant_id, p.owner_id, p.name as prop_name
    from public.rental_requests r
    join public.properties p on p.id = r.property_id
    where r.status = 'pending'
      and r.first_reminder_sent = false
      and r.first_deadline is not null
      and r.first_deadline > now()
      and r.first_deadline <= now() + make_interval(hours => v_reminder_hours)
  loop
    update public.rental_requests
    set first_reminder_sent = true
    where id = v_row.id
      and status = 'pending'
      and first_reminder_sent = false;

    if found then
      v_prop_name := coalesce(v_row.prop_name, 'el inmueble');
      insert into public.notifications (user_id, type, title, message, link)
      values
        (v_row.owner_id, 'request_deadline_reminder', 'Plazo proximo a vencer (Filtro 1)', 'Quedan menos de ' || v_reminder_hours || 'h para responder la solicitud de "' || v_prop_name || '".', '/owner/requests/' || v_row.id::text),
        (v_row.tenant_id, 'request_deadline_reminder', 'Solicitud proxima a vencimiento', 'El plazo del Filtro 1 para "' || v_prop_name || '" vence en menos de ' || v_reminder_hours || 'h.', '/tenant/requests/' || v_row.id::text);
      v_reminded_count := v_reminded_count + 1;
    end if;
  end loop;

  -- 4. Recordatorios preventivos Filtro 2 (una sola vez por sub-etapa)
  for v_row in
    select r.id, r.status, r.property_id, r.tenant_id, p.owner_id, p.name as prop_name
    from public.rental_requests r
    join public.properties p on p.id = r.property_id
    where r.status in ('first_accepted', 'docs_submitted', 'returned')
      and r.second_reminder_sent = false
      and r.second_deadline is not null
      and r.second_deadline > now()
      and r.second_deadline <= now() + make_interval(hours => v_reminder_hours)
  loop
    update public.rental_requests
    set second_reminder_sent = true
    where id = v_row.id
      and status = v_row.status
      and second_reminder_sent = false;

    if found then
      v_prop_name := coalesce(v_row.prop_name, 'el inmueble');
      insert into public.notifications (user_id, type, title, message, link)
      values
        (
          case when v_row.status = 'docs_submitted' then v_row.owner_id else v_row.tenant_id end,
          'request_deadline_reminder',
          'Plazo proximo a vencer (Filtro 2)',
          case
            when v_row.status = 'docs_submitted' then 'Quedan menos de ' || v_reminder_hours || 'h para emitir decision final sobre "' || v_prop_name || '".'
            else 'Quedan menos de ' || v_reminder_hours || 'h para completar o reenviar tus documentos de "' || v_prop_name || '".'
          end,
          case when v_row.status = 'docs_submitted' then '/owner/requests/' || v_row.id::text else '/tenant/requests/' || v_row.id::text end
        );
      v_reminded_count := v_reminded_count + 1;
    end if;
  end loop;

  perform set_config('arriendaya.internal_deadline_job', '', true);

  return jsonb_build_object(
    'skipped', false,
    'expired', v_expired_count,
    'reminded', v_reminded_count
  );
end;
$$;

revoke all on function public.process_request_deadlines(int) from public;
revoke all on function public.process_request_deadlines(int) from anon;
revoke all on function public.process_request_deadlines(int) from authenticated;
grant execute on function public.process_request_deadlines(int) to service_role;

do $$
declare
  v_job_id bigint;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute 'select jobid from cron.job where jobname = $1 limit 1'
      into v_job_id
      using 'arriendaya_process_request_deadlines';

    if v_job_id is not null then
      execute 'select cron.unschedule($1)' using v_job_id;
    end if;

    execute 'select cron.schedule($1, $2, $3)'
      using 'arriendaya_process_request_deadlines', '*/15 * * * *', 'select public.process_request_deadlines();';
    raise notice 'pg_cron job arriendaya_process_request_deadlines programado cada 15 minutos.';
  else
    raise notice 'Extension pg_cron no instalada en este proyecto; configure cron externo autenticado hacia /api/cron/deadlines.';
  end if;
end $$;

-- ============================================================================
-- 3. MINIMO 4 FOTOGRAFIAS PARA PUBLICAR INMUEBLES (SIN EVASION DE service_role/ADMIN)
-- ============================================================================

create or replace function public.mark_property_deleting()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('arriendaya.deleting_property_id', old.id::text, true);
  return old;
end;
$$;

create or replace function public.clear_property_deleting()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('arriendaya.deleting_property_id', '', true);
  return old;
end;
$$;

drop trigger if exists trg_a_mark_property_deleting on public.properties;
create trigger trg_a_mark_property_deleting
  before delete on public.properties
  for each row execute function public.mark_property_deleting();

drop trigger if exists trg_z_clear_property_deleting on public.properties;
create trigger trg_z_clear_property_deleting
  after delete on public.properties
  for each row execute function public.clear_property_deleting();

create or replace function public.enforce_min_property_images()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_img_count int;
begin
  -- Exige >= 4 fotografias unicamente al insertar como published o transicionar hacia published
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    select count(*) into v_img_count
    from public.property_images
    where property_id = new.id;

    if v_img_count < 4 then
      raise exception 'Se requieren al menos 4 fotografias para publicar el inmueble';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_min_property_images on public.properties;
create trigger trg_enforce_min_property_images
  before insert or update on public.properties
  for each row execute function public.enforce_min_property_images();

-- Protege DELETE y UPDATE/reasignacion de property_id incluso para service_role o admin.
-- Unica excepcion permitida: borrado en cascada del inmueble padre (pg_trigger_depth() > 1).
create or replace function public.guard_property_images_min_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prop_status public.property_status;
  v_img_count int;
begin
  if tg_op = 'DELETE'
     and pg_trigger_depth() > 1
     and nullif(current_setting('arriendaya.deleting_property_id', true), '') = old.property_id::text then
    return old;
  end if;

  if tg_op = 'UPDATE' and new.property_id is not distinct from old.property_id then
    return new;
  end if;

  -- Serializa transacciones concurrentes de eliminacion o reasignacion sobre el mismo inmueble
  select status into v_prop_status
  from public.properties
  where id = old.property_id
  for update;

  if v_prop_status = 'published' then
    select count(*) into v_img_count
    from public.property_images
    where property_id = old.property_id;

    if (v_img_count - 1) < 4 then
      raise exception 'Un inmueble publicado debe conservar al menos 4 fotografias';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_prevent_dropping_below_min_images on public.property_images;
drop trigger if exists trg_guard_property_images_min_count on public.property_images;
create trigger trg_guard_property_images_min_count
  before update or delete on public.property_images
  for each row execute function public.guard_property_images_min_count();

-- ============================================================================
-- 4. BUCKETS PRIVADOS: request-documents (FIRMA EN pending + DOCS EN FILTRO 2) Y profile-avatars
--    (No modifica politicas ni acceso de signatures)
-- ============================================================================

update storage.buckets set public = false where id = 'request-documents';

drop policy if exists "Request participants access documents" on storage.objects;
drop policy if exists "Request documents select authorized" on storage.objects;
drop policy if exists "Request documents insert tenant active" on storage.objects;
drop policy if exists "Request documents insert initial signature" on storage.objects;
drop policy if exists "Request documents insert filter2 docs" on storage.objects;
drop policy if exists "Request documents admin mutate" on storage.objects;
drop policy if exists "Request documents admin delete" on storage.objects;

-- Lectura privada solo para admin o participantes legitimos (tenant/owner) de la solicitud
create policy "Request documents select authorized"
  on storage.objects
  for select
  using (
    bucket_id = 'request-documents'
    and (
      public.is_admin()
      or (
        split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        and public.is_request_participant((split_part(name, '/', 1))::uuid)
      )
    )
  );

-- Firma inicial manuscrita en estado pending: ruta obligatoria {request_id}/{tenant_id}/signature/{uuid}.png
-- Impide sobrescribir o duplicar firma una vez registrada.
create policy "Request documents insert initial signature"
  on storage.objects
  for insert
  with check (
    bucket_id = 'request-documents'
    and auth.role() = 'authenticated'
    and (
      public.is_admin()
      or (
        name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/signature/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.png$'
        and split_part(name, '/', 2) = auth.uid()::text
        and exists (
          select 1
          from public.rental_requests r
          where r.id = (split_part(name, '/', 1))::uuid
            and r.tenant_id = auth.uid()
            and r.status = 'pending'
            and r.applicant_signature_url is null
        )
        and not exists (
          select 1
          from storage.objects o
          where o.bucket_id = 'request-documents'
            and o.name like (split_part(name, '/', 1) || '/' || auth.uid()::text || '/signature/%')
        )
      )
    )
  );

-- Documentos adicionales del Filtro 2 en estados first_accepted o returned: ruta {request_id}/{tenant_id}/{uuid}.{pdf|jpg|jpeg|png|webp}
create policy "Request documents insert filter2 docs"
  on storage.objects
  for insert
  with check (
    bucket_id = 'request-documents'
    and auth.role() = 'authenticated'
    and (
      public.is_admin()
      or (
        name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(pdf|jpg|jpeg|png|webp)$'
        and split_part(name, '/', 2) = auth.uid()::text
        and exists (
          select 1
          from public.rental_requests r
          where r.id = (split_part(name, '/', 1))::uuid
            and r.tenant_id = auth.uid()
            and r.status in ('first_accepted', 'returned')
        )
      )
    )
  );

-- Inquilinos y propietarios nunca pueden sobrescribir ni eliminar firmas o documentos cargados
create policy "Request documents admin mutate"
  on storage.objects
  for update
  using (bucket_id = 'request-documents' and public.is_admin())
  with check (bucket_id = 'request-documents' and public.is_admin());

create policy "Request documents admin delete"
  on storage.objects
  for delete
  using (bucket_id = 'request-documents' and public.is_admin());

-- Bucket privado profile-avatars: propietario gestiona su propio avatar;
-- visualizacion por terceros autorizados mediante URLs firmadas desde el servidor previa verificacion.
insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', false)
on conflict (id) do update set public = false;

drop policy if exists "Profile avatars owner manage" on storage.objects;
drop policy if exists "Profile avatars owner or admin select" on storage.objects;
drop policy if exists "Profile avatars owner insert" on storage.objects;
drop policy if exists "Profile avatars owner update" on storage.objects;
drop policy if exists "Profile avatars owner delete" on storage.objects;

create policy "Profile avatars owner or admin select"
  on storage.objects
  for select
  using (
    bucket_id = 'profile-avatars'
    and (
      public.is_admin()
      or (
        split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        and split_part(name, '/', 1) = auth.uid()::text
      )
    )
  );

create policy "Profile avatars owner insert"
  on storage.objects
  for insert
  with check (
    bucket_id = 'profile-avatars'
    and auth.role() = 'authenticated'
    and split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "Profile avatars owner update"
  on storage.objects
  for update
  using (
    bucket_id = 'profile-avatars'
    and (
      public.is_admin()
      or split_part(name, '/', 1) = auth.uid()::text
    )
  )
  with check (
    bucket_id = 'profile-avatars'
    and (
      public.is_admin()
      or split_part(name, '/', 1) = auth.uid()::text
    )
  );

create policy "Profile avatars owner delete"
  on storage.objects
  for delete
  using (
    bucket_id = 'profile-avatars'
    and (
      public.is_admin()
      or split_part(name, '/', 1) = auth.uid()::text
    )
  );

-- ============================================================================
-- 5. RESENAS VERIFICADAS EN public.reviews (UNA POR INMUEBLE Y AUTOR)
-- ============================================================================

alter table public.reviews
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reviews_rating_range_check'
      and conrelid = 'public.reviews'::regclass
  ) then
    alter table public.reviews
      add constraint reviews_rating_range_check
      check (rating between 1 and 5);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'reviews_comment_length_check'
      and conrelid = 'public.reviews'::regclass
  ) then
    alter table public.reviews
      add constraint reviews_comment_length_check
      check (comment is not null and length(trim(comment)) >= 5);
  end if;
end $$;

create unique index if not exists idx_reviews_property_author_unique
  on public.reviews(property_id, author_id)
  where property_id is not null and author_id is not null;

create or replace function public.protect_reviews()
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

  if new.property_id is null or new.author_id is null or new.author_id <> auth.uid() then
    raise exception 'Resena invalida: autor o inmueble no autorizado';
  end if;

  if tg_op = 'UPDATE' then
    if new.property_id is distinct from old.property_id
       or new.author_id is distinct from old.author_id then
      raise exception 'No es posible reasignar el inmueble o autor de una resena existente';
    end if;
  end if;

  if not exists (
    select 1
    from public.contracts c
    where c.property_id = new.property_id
      and c.tenant_id = auth.uid()
      and c.status in ('active', 'expiring', 'renewed', 'suspended')
  ) then
    raise exception 'Solo inquilinos con un contrato asociado a este inmueble pueden publicar o editar resenas';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_reviews_updated_at on public.reviews;
drop trigger if exists trg_protect_reviews on public.reviews;
create trigger trg_protect_reviews
  before insert or update on public.reviews
  for each row execute function public.protect_reviews();

-- Sustituye TODAS las politicas de escritura de reviews (INSERT y UPDATE)
drop policy if exists "reviews auth write" on public.reviews;
create policy "reviews auth write"
  on public.reviews
  for insert
  with check (
    auth.uid() = author_id
    and property_id is not null
    and exists (
      select 1
      from public.contracts c
      where c.property_id = reviews.property_id
        and c.tenant_id = auth.uid()
        and c.status in ('active', 'expiring', 'renewed', 'suspended')
    )
  );

drop policy if exists "reviews author modify" on public.reviews;
create policy "reviews author modify"
  on public.reviews
  for update
  using (auth.uid() = author_id)
  with check (
    auth.uid() = author_id
    and property_id is not null
    and exists (
      select 1
      from public.contracts c
      where c.property_id = reviews.property_id
        and c.tenant_id = auth.uid()
        and c.status in ('active', 'expiring', 'renewed', 'suspended')
    )
  );
