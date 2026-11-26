-- Fase 3 B1: RLS policies for remaining tables + search_path fix

-- Fix search_path on existing SECURITY DEFINER functions
alter function public.handle_new_user() set search_path = public;
alter function public.notify_request_status_change() set search_path = public;

-- RLS policies for new tables (payments, expenses, visits, reservations, calendar_events, conversations, messages, quick_replies, activity_log, owner_verifications, reviews, saved_lists, saved_list_items, request_notes)

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

-- visits
drop policy if exists "visits tenant own" on public.visits;
drop policy if exists "visits owner read" on public.visits;
create policy "visits tenant own" on public.visits for all
  using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
create policy "visits owner read" on public.visits for select
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()));

-- reservations
drop policy if exists "reservations tenant own" on public.reservations;
drop policy if exists "reservations owner read" on public.reservations;
create policy "reservations tenant own" on public.reservations for all
  using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
create policy "reservations owner read" on public.reservations for select
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()));

-- calendar_events
drop policy if exists "calendar self" on public.calendar_events;
create policy "calendar self" on public.calendar_events for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

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
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- activity_log
drop policy if exists "activity_log self" on public.activity_log;
create policy "activity_log self" on public.activity_log for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- owner_verifications
drop policy if exists "owner_verifications self" on public.owner_verifications;
create policy "owner_verifications self" on public.owner_verifications for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- reviews
drop policy if exists "reviews public read" on public.reviews;
drop policy if exists "reviews auth write" on public.reviews;
create policy "reviews public read" on public.reviews for select using (true);
create policy "reviews auth write" on public.reviews for insert with check (auth.uid() is not null);

-- saved_lists
drop policy if exists "saved_lists self" on public.saved_lists;
create policy "saved_lists self" on public.saved_lists for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- saved_list_items
drop policy if exists "saved_list_items self" on public.saved_list_items;
create policy "saved_list_items self" on public.saved_list_items for all
  using (exists (select 1 from public.saved_lists l where l.id = list_id and l.user_id = auth.uid()))
  with check (exists (select 1 from public.saved_lists l where l.id = list_id and l.user_id = auth.uid()));

-- request_notes (already in 0002, re-ensure)
drop policy if exists "notes author" on public.request_notes;
drop policy if exists "notes owner read" on public.request_notes;
create policy "notes author" on public.request_notes for all
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "notes owner read" on public.request_notes for select
  using (exists (select 1 from public.rental_requests r join public.properties p on p.id = r.property_id where r.id = request_id and p.owner_id = auth.uid()));

-- profiles: restrict owner read to related profiles only
drop policy if exists "profiles owner read all" on public.profiles;
create policy "profiles owner read related" on public.profiles for select
  using (
    id = auth.uid() or exists (
      select 1 from public.rental_requests r join public.properties p on p.id = r.property_id
      where (r.tenant_id = profiles.id or p.owner_id = profiles.id) and p.owner_id = auth.uid()
    )
  );

-- contracts: restrict update to specific fields (status, signatures) - enforce via trigger or app logic
-- (RLS allows participants to update; field-level restriction should be done in app/trigger)
drop policy if exists "contracts participants update" on public.contracts;
create policy "contracts participants update" on public.contracts for update
  using (tenant_id = auth.uid() or owner_id = auth.uid())
  with check (tenant_id = auth.uid() or owner_id = auth.uid());

-- trigger search_path fix for notify_request_status_change already applied above
