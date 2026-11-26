-- Phase 6 Pre-check (Parte 1.1): Allow tenants with legitimate relationship
-- (rental_requests, contracts, visits) to read property metadata even after
-- the property transitions to 'rented' or another non-public status, without
-- exposing private/paused/archived/rented properties to the general public
-- and without triggering RLS recursion (42P17).

create or replace function public.is_property_related_user(p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    exists (
      select 1
      from public.contracts c
      where c.property_id = p_property_id
        and (c.tenant_id = auth.uid() or c.owner_id = auth.uid())
    )
    or exists (
      select 1
      from public.rental_requests rr
      where rr.property_id = p_property_id
        and rr.tenant_id = auth.uid()
    )
    or exists (
      select 1
      from public.visits v
      where v.property_id = p_property_id
        and v.tenant_id = auth.uid()
    )
  );
$$;

revoke all on function public.is_property_related_user(uuid) from public;
grant execute on function public.is_property_related_user(uuid) to authenticated;

drop policy if exists "properties public read" on public.properties;
create policy "properties public read"
  on public.properties
  for select
  using (
    status = 'published'
    or owner_id = auth.uid()
    or public.is_admin()
    or public.is_property_related_user(id)
  );
