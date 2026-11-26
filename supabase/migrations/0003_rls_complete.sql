-- Fase 3 B1: RLS policies + search_path fix + protección de contratos (Supabase Ready)

-- 1. Fix search_path en funciones SECURITY DEFINER existentes
alter function public.handle_new_user() set search_path = public;
alter function public.notify_request_status_change() set search_path = public;

-- 2. Políticas RLS idempotentes

-- payments
drop policy if exists "payments participants" on public.payments;
create policy "payments participants" on public.payments for all
  using (tenant_id = auth.uid() or exists (select 1 from public.contracts c where c.id = contract_id and c.owner_id = auth.uid()))
  with check (tenant_id = auth.uid() or exists (select 1 from public.contracts c where c.id = contract_id and c.owner_id = auth.uid()));

-- expenses
drop policy if exists "expenses owner" on public.expenses;
create policy "expenses owner" on public.expenses for all
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()));

-- visits (tenant gestiona las suyas; owner lee y actualiza estado de visitas a sus inmuebles)
drop policy if exists "visits participants" on public.visits;
drop policy if exists "visits tenant own" on public.visits;
drop policy if exists "visits owner read" on public.visits;
drop policy if exists "visits owner update" on public.visits;

create policy "visits tenant own" on public.visits for all
  using (tenant_id = auth.uid())
  with check (tenant_id = auth.uid());

create policy "visits owner read" on public.visits for select
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()));

create policy "visits owner update" on public.visits for update
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()));

-- reservations (tenant gestiona las suyas; owner lee y actualiza estado de reservas en sus inmuebles)
drop policy if exists "reservations participants" on public.reservations;
drop policy if exists "reservations tenant own" on public.reservations;
drop policy if exists "reservations owner read" on public.reservations;
drop policy if exists "reservations owner update" on public.reservations;

create policy "reservations tenant own" on public.reservations for all
  using (tenant_id = auth.uid())
  with check (tenant_id = auth.uid());

create policy "reservations owner read" on public.reservations for select
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()));

create policy "reservations owner update" on public.reservations for update
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()));

-- calendar_events
drop policy if exists "calendar self" on public.calendar_events;
create policy "calendar self" on public.calendar_events for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- conversations
drop policy if exists "conversations participants" on public.conversations;
create policy "conversations participants" on public.conversations for all
  using (owner_id = auth.uid() or tenant_id = auth.uid())
  with check (owner_id = auth.uid() or tenant_id = auth.uid());

-- messages
drop policy if exists "messages participants" on public.messages;
create policy "messages participants" on public.messages for all
  using (exists (select 1 from public.conversations c where c.id = conversation_id and (c.owner_id = auth.uid() or c.tenant_id = auth.uid())))
  with check (exists (select 1 from public.conversations c where c.id = conversation_id and (c.owner_id = auth.uid() or c.tenant_id = auth.uid())));

-- quick_replies
drop policy if exists "quick_replies self" on public.quick_replies;
create policy "quick_replies self" on public.quick_replies for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- activity_log
drop policy if exists "activity_log self" on public.activity_log;
create policy "activity_log self" on public.activity_log for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- owner_verifications
drop policy if exists "owner_verifications self" on public.owner_verifications;
create policy "owner_verifications self" on public.owner_verifications for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- reviews (lectura pública, escritura autenticada del propio autor, borrado/edición propio)
drop policy if exists "reviews public read" on public.reviews;
drop policy if exists "reviews auth write" on public.reviews;
drop policy if exists "reviews author modify" on public.reviews;

create policy "reviews public read" on public.reviews for select using (true);
create policy "reviews auth write" on public.reviews for insert with check (auth.uid() = author_id);
create policy "reviews author modify" on public.reviews for update using (auth.uid() = author_id) with check (auth.uid() = author_id);

-- saved_lists
drop policy if exists "saved_lists self" on public.saved_lists;
create policy "saved_lists self" on public.saved_lists for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- saved_list_items
drop policy if exists "saved_list_items self" on public.saved_list_items;
create policy "saved_list_items self" on public.saved_list_items for all
  using (exists (select 1 from public.saved_lists l where l.id = list_id and l.user_id = auth.uid()))
  with check (exists (select 1 from public.saved_lists l where l.id = list_id and l.user_id = auth.uid()));

-- request_notes
drop policy if exists "notes author" on public.request_notes;
drop policy if exists "notes owner read" on public.request_notes;

create policy "notes author" on public.request_notes for all
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "notes owner read" on public.request_notes for select
  using (exists (select 1 from public.rental_requests r join public.properties p on p.id = r.property_id where r.id = request_id and p.owner_id = auth.uid()));

-- profiles: propio perfil + lectura mutua entre participantes de solicitudes, contratos o conversaciones
drop policy if exists "profiles owner read all" on public.profiles;
drop policy if exists "profiles owner read related" on public.profiles;
drop policy if exists "profiles related read" on public.profiles;

create policy "profiles related read" on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from public.rental_requests r
      join public.properties p on p.id = r.property_id
      where (r.tenant_id = auth.uid() and p.owner_id = profiles.id)
         or (p.owner_id = auth.uid() and r.tenant_id = profiles.id)
    )
    or exists (
      select 1 from public.contracts c
      where (c.tenant_id = auth.uid() and c.owner_id = profiles.id)
         or (c.owner_id = auth.uid() and c.tenant_id = profiles.id)
    )
    or exists (
      select 1 from public.conversations conv
      where (conv.tenant_id = auth.uid() and conv.owner_id = profiles.id)
         or (conv.owner_id = auth.uid() and conv.tenant_id = profiles.id)
    )
  );

-- contracts: políticas y trigger de protección de campos críticos
drop policy if exists "contracts participants" on public.contracts;
drop policy if exists "contracts participants select" on public.contracts;
drop policy if exists "contracts owner insert" on public.contracts;
drop policy if exists "contracts participants update" on public.contracts;

create policy "contracts participants select" on public.contracts for select
  using (tenant_id = auth.uid() or owner_id = auth.uid());

create policy "contracts owner insert" on public.contracts for insert
  with check (owner_id = auth.uid());

create policy "contracts participants update" on public.contracts for update
  using (tenant_id = auth.uid() or owner_id = auth.uid())
  with check (tenant_id = auth.uid() or owner_id = auth.uid());

-- Trigger para impedir que el inquilino altere términos, fechas o dueños del contrato
create or replace function public.protect_contract_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Si quien actualiza no es el owner (es decir, es el tenant)
  if auth.uid() is not null and auth.uid() <> old.owner_id then
    if new.property_id is distinct from old.property_id
       or new.tenant_id is distinct from old.tenant_id
       or new.owner_id is distinct from old.owner_id
       or new.start_date is distinct from old.start_date
       or new.end_date is distinct from old.end_date
       or new.terms is distinct from old.terms
       or new.owner_signature_url is distinct from old.owner_signature_url then
      raise exception 'Solo el propietario puede modificar los términos o fechas del contrato.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_protect_contract_fields on public.contracts;
create trigger trg_protect_contract_fields
  before update on public.contracts
  for each row execute function public.protect_contract_fields();