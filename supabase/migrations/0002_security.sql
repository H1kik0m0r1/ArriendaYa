-- Fase 2: Seguridad y corrección de errores críticos

-- 1. Tabla de invitaciones de propietarios (reemplaza lista hardcodeada)
create table if not exists public.owner_invitations (
  email text primary key,
  invited_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 2. Tabla de notas privadas de solicitudes
create table if not exists public.request_notes (
  id uuid primary key default uuid_generate_v4(),
  request_id uuid not null references public.rental_requests(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  text text not null,
  created_at timestamptz not null default now()
);

-- 3. Corregir handle_new_user para usar owner_invitations
create or replace function public.handle_new_user()
returns trigger as $$
declare role_val user_role := 'tenant';
begin
  if exists (select 1 from public.owner_invitations where lower(email) = lower(new.email)) then
    role_val := 'owner';
  end if;
  insert into public.profiles (id, email, full_name, role, accepted_terms)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''), role_val, coalesce((new.raw_user_meta_data->>'accepted_terms')::boolean, false))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Corregir RLS permisiva

-- request_documents: solo tenant propietario o owner del inmueble
drop policy if exists "docs participants" on public.request_documents;
drop policy if exists "docs tenant own" on public.request_documents;
drop policy if exists "docs owner received" on public.request_documents;
create policy "docs tenant own" on public.request_documents for all
  using (exists (select 1 from public.rental_requests r where r.id = request_id and r.tenant_id = auth.uid()))
  with check (exists (select 1 from public.rental_requests r where r.id = request_id and r.tenant_id = auth.uid()));
create policy "docs owner received" on public.request_documents for select
  using (exists (select 1 from public.rental_requests r join public.properties p on p.id = r.property_id where r.id = request_id and p.owner_id = auth.uid()));

-- visits: solo tenant propietario o owner del inmueble
drop policy if exists "visits participants" on public.visits;
drop policy if exists "visits tenant own" on public.visits;
drop policy if exists "visits owner read" on public.visits;
create policy "visits tenant own" on public.visits for all
  using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
create policy "visits owner read" on public.visits for select
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()));

-- property_views: insert autenticado, read solo owner
drop policy if exists "property_views all" on public.property_views;
drop policy if exists "property_views insert auth" on public.property_views;
drop policy if exists "property_views owner read" on public.property_views;
create policy "property_views insert auth" on public.property_views for insert
  with check (auth.uid() is not null);
create policy "property_views owner read" on public.property_views for select
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()));

-- reports: reporter lee/escribe los suyos; admin lee todo
drop policy if exists "reports all auth" on public.reports;
drop policy if exists "reports reporter read" on public.reports;
drop policy if exists "reports reporter insert" on public.reports;
drop policy if exists "reports admin all" on public.reports;
create policy "reports reporter read" on public.reports for select
  using (reporter_id = auth.uid());
create policy "reports reporter insert" on public.reports for insert
  with check (reporter_id = auth.uid());
create policy "reports admin all" on public.reports for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- request_notes: autor o propietario del inmueble
alter table public.request_notes enable row level security;
drop policy if exists "notes author" on public.request_notes;
drop policy if exists "notes owner read" on public.request_notes;
create policy "notes author" on public.request_notes for all
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "notes owner read" on public.request_notes for select
  using (exists (select 1 from public.rental_requests r join public.properties p on p.id = r.property_id where r.id = request_id and p.owner_id = auth.uid()));

-- 5. Trigger para notificaciones automáticas al cambiar estado de solicitud
create or replace function public.notify_request_status_change()
returns trigger as $$
begin
  if old.status is distinct from new.status then
    insert into public.notifications (user_id, type, title, message, link)
    values (
      new.tenant_id,
      'request_status_changed',
      'Cambio de estado de solicitud',
      'Tu solicitud cambió a: ' || new.status,
      '/tenant/requests/' || new.id
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_request_status_notify on public.rental_requests;
create trigger trg_request_status_notify
  after update on public.rental_requests
  for each row execute function public.notify_request_status_change();

-- 6. Storage: asegurar buckets privados
update storage.buckets set public = false where id in ('request-documents', 'signatures');
