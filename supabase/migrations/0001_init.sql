-- ArriendaYa full schema (Supabase Ready)

-- 1. Extensiones (en Supabase se instalan en el esquema 'extensions')
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "postgis" with schema extensions;

-- 2. Enums (idempotentes)
do $$ begin create type public.user_role as enum ('owner','tenant'); exception when duplicate_object then null; end $$;
do $$ begin create type public.property_type as enum ('Apartamento','Casa','Habitación','Estudio','Cabaña','Finca','Local comercial','Oficina','Bodega'); exception when duplicate_object then null; end $$;
do $$ begin create type public.rental_type as enum ('vivienda','recreativo'); exception when duplicate_object then null; end $$;
do $$ begin create type public.price_period as enum ('mes','dia','hora'); exception when duplicate_object then null; end $$;
do $$ begin create type public.property_status as enum ('draft','published','rented','paused','maintenance','archived','in_process'); exception when duplicate_object then null; end $$;
do $$ begin create type public.request_status as enum ('pending','first_accepted','docs_submitted','returned','accepted','rejected','expired','property_rented'); exception when duplicate_object then null; end $$;
do $$ begin create type public.labor_profile as enum ('empleado','independiente','pensionado'); exception when duplicate_object then null; end $$;
do $$ begin create type public.duration_unit as enum ('dias','meses','horas'); exception when duplicate_object then null; end $$;
do $$ begin create type public.contract_status as enum ('pending_signatures','active','expiring','suspended','renewed'); exception when duplicate_object then null; end $$;

-- 3. Tablas (usamos gen_random_uuid() nativo de Postgres/Supabase)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  role public.user_role not null default 'tenant',
  avatar_url text,
  accepted_terms boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  type public.property_type not null,
  max_people int not null default 1,
  area_sqm numeric not null default 0,
  location text not null,
  address text,
  latitude double precision,
  longitude double precision,
  description text,
  rental_type public.rental_type not null,
  max_rental_days int,
  price numeric not null default 0,
  price_period public.price_period not null default 'mes',
  contact_phone text,
  contact_email text,
  contact_social text,
  discount_percent int default 0,
  discount_until timestamptz,
  status public.property_status not null default 'draft',
  includes_administration boolean,
  administration_fee numeric,
  parking int,
  floor_area numeric,
  condition text,
  stratum int,
  nearby_centers text,
  available_from date,
  requires_cosigner boolean,
  deposit_months int,
  renter_type text,
  renter_name text,
  renter_photo_url text,
  furnished text,
  pets_allowed boolean,
  for_new boolean,
  video_url text,
  whatsapp_contact text,
  visits int default 0,
  shares int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  url text not null,
  label text,
  sort_order int not null default 0
);

create table if not exists public.rental_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  status public.request_status not null default 'pending',
  first_deadline timestamptz not null default (now() + interval '5 days'),
  first_decision_at timestamptz,
  rejection_reason text,
  return_message text,
  desired_duration_value int,
  desired_duration_unit public.duration_unit,
  labor_profile public.labor_profile,
  has_cosigner boolean not null default false,
  cosigner_requires_property boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.request_documents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.rental_requests(id) on delete cascade,
  doc_type text not null,
  file_url text not null,
  status text default 'pendiente',
  delivered_at timestamptz,
  uploaded_at timestamptz not null default now()
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.rental_requests(id) on delete set null,
  property_id uuid not null references public.properties(id) on delete cascade,
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  start_date date,
  end_date date,
  terms text,
  owner_signature_url text,
  tenant_signature_url text,
  signed_at timestamptz,
  status public.contract_status not null default 'pending_signatures',
  reminder_month_sent boolean not null default false,
  reminder_week_sent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, property_id)
);

create table if not exists public.saved_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_list_items (
  list_id uuid not null references public.saved_lists(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  primary key (list_id, property_id)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references public.contracts(id) on delete set null,
  tenant_id uuid references public.profiles(id) on delete set null,
  amount numeric not null,
  concept text,
  date timestamptz not null default now(),
  status text not null default 'pendiente',
  receipt_url text
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete cascade,
  type text,
  amount numeric,
  period text,
  created_at timestamptz not null default now()
);

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete cascade,
  tenant_id uuid references public.profiles(id) on delete set null,
  name text,
  phone text,
  date date,
  papers text,
  status text default 'solicitada',
  created_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete cascade,
  tenant_id uuid references public.profiles(id) on delete set null,
  start timestamptz,
  "end" timestamptz,
  hours int,
  total numeric,
  status text default 'pendiente',
  created_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  type text,
  title text,
  start timestamptz,
  "end" timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade,
  tenant_id uuid references public.profiles(id) on delete cascade,
  tenant_email text,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender text,
  text text,
  created_at timestamptz not null default now()
);

create table if not exists public.quick_replies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  text text
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  action text,
  entity text,
  created_at timestamptz not null default now()
);

create table if not exists public.owner_verifications (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email_verified boolean default false,
  phone_verified boolean default false,
  identity_doc_url text,
  status text default 'pendiente'
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_id uuid,
  target_type text,
  reason text,
  description text,
  evidence_url text,
  status text default 'pendiente',
  response text,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  rating int,
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.property_views (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete cascade,
  viewer_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 4. Habilitar RLS
alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.property_images enable row level security;
alter table public.rental_requests enable row level security;
alter table public.request_documents enable row level security;
alter table public.contracts enable row level security;
alter table public.notifications enable row level security;
alter table public.saved_properties enable row level security;
alter table public.saved_lists enable row level security;
alter table public.saved_list_items enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.visits enable row level security;
alter table public.reservations enable row level security;
alter table public.calendar_events enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.quick_replies enable row level security;
alter table public.activity_log enable row level security;
alter table public.owner_verifications enable row level security;
alter table public.reports enable row level security;
alter table public.reviews enable row level security;
alter table public.property_views enable row level security;

-- 5. Políticas RLS (con DROP IF EXISTS para evitar errores al re-ejecutar)
drop policy if exists "profiles self" on public.profiles;
create policy "profiles self" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "properties public read" on public.properties;
create policy "properties public read" on public.properties for select using (status = 'published' or owner_id = auth.uid());

drop policy if exists "properties owner write" on public.properties;
create policy "properties owner write" on public.properties for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "images public read" on public.property_images;
create policy "images public read" on public.property_images for select using (true);

drop policy if exists "images owner write" on public.property_images;
create policy "images owner write" on public.property_images for all using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid())) with check (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()));

drop policy if exists "requests participants" on public.rental_requests;
create policy "requests participants" on public.rental_requests for all using (tenant_id = auth.uid() or exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid())) with check (tenant_id = auth.uid() or exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()));

drop policy if exists "docs participants" on public.request_documents;
create policy "docs participants" on public.request_documents for all using (
  exists (
    select 1 from public.rental_requests r
    join public.properties p on p.id = r.property_id
    where r.id = request_id and (r.tenant_id = auth.uid() or p.owner_id = auth.uid())
  )
) with check (
  exists (
    select 1 from public.rental_requests r
    join public.properties p on p.id = r.property_id
    where r.id = request_id and (r.tenant_id = auth.uid() or p.owner_id = auth.uid())
  )
);

drop policy if exists "contracts participants" on public.contracts;
create policy "contracts participants" on public.contracts for all using (tenant_id = auth.uid() or owner_id = auth.uid()) with check (tenant_id = auth.uid() or owner_id = auth.uid());

drop policy if exists "notif self" on public.notifications;
create policy "notif self" on public.notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "saved self" on public.saved_properties;
create policy "saved self" on public.saved_properties for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "saved_lists self" on public.saved_lists;
create policy "saved_lists self" on public.saved_lists for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "saved_list_items self" on public.saved_list_items;
create policy "saved_list_items self" on public.saved_list_items for all using (exists (select 1 from public.saved_lists l where l.id = list_id and l.user_id = auth.uid())) with check (exists (select 1 from public.saved_lists l where l.id = list_id and l.user_id = auth.uid()));

drop policy if exists "payments participants" on public.payments;
create policy "payments participants" on public.payments for all using (tenant_id = auth.uid() or exists (select 1 from public.contracts c where c.id = contract_id and c.owner_id = auth.uid())) with check (tenant_id = auth.uid() or exists (select 1 from public.contracts c where c.id = contract_id and c.owner_id = auth.uid()));

-- Política agregada para expenses (faltaba)
drop policy if exists "expenses owner" on public.expenses;
create policy "expenses owner" on public.expenses for all using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid())) with check (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()));

drop policy if exists "visits participants" on public.visits;
create policy "visits participants" on public.visits for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- Política agregada para reservations (faltaba)
drop policy if exists "reservations participants" on public.reservations;
create policy "reservations participants" on public.reservations for all using (tenant_id = auth.uid() or exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid())) with check (tenant_id = auth.uid() or exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()));

drop policy if exists "calendar self" on public.calendar_events;
create policy "calendar self" on public.calendar_events for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "conversations participants" on public.conversations;
create policy "conversations participants" on public.conversations for all using (owner_id = auth.uid() or tenant_id = auth.uid()) with check (owner_id = auth.uid() or tenant_id = auth.uid());

drop policy if exists "messages participants" on public.messages;
create policy "messages participants" on public.messages for all using (exists (select 1 from public.conversations c where c.id = conversation_id and (c.owner_id = auth.uid() or c.tenant_id = auth.uid()))) with check (exists (select 1 from public.conversations c where c.id = conversation_id and (c.owner_id = auth.uid() or c.tenant_id = auth.uid())));

drop policy if exists "quick_replies self" on public.quick_replies;
create policy "quick_replies self" on public.quick_replies for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "activity_log self" on public.activity_log;
create policy "activity_log self" on public.activity_log for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "owner_verifications self" on public.owner_verifications;
create policy "owner_verifications self" on public.owner_verifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "reports all auth" on public.reports;
create policy "reports all auth" on public.reports for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "reviews public read" on public.reviews;
create policy "reviews public read" on public.reviews for select using (true);

drop policy if exists "reviews auth write" on public.reviews;
create policy "reviews auth write" on public.reviews for insert with check (auth.uid() is not null);

drop policy if exists "property_views all" on public.property_views;
create policy "property_views all" on public.property_views for all using (true) with check (true);

-- 6. Storage Buckets y Políticas de acceso
insert into storage.buckets (id, name, public) values ('property-images','property-images', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('request-documents','request-documents', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('signatures','signatures', false) on conflict (id) do nothing;

-- Políticas de Storage
drop policy if exists "Public read property-images" on storage.objects;
create policy "Public read property-images" on storage.objects for select using (bucket_id = 'property-images');

drop policy if exists "Auth upload property-images" on storage.objects;
create policy "Auth upload property-images" on storage.objects for insert with check (bucket_id = 'property-images' and auth.role() = 'authenticated');

drop policy if exists "Owner delete property-images" on storage.objects;
create policy "Owner delete property-images" on storage.objects for delete using (bucket_id = 'property-images' and auth.uid() = owner);

drop policy if exists "Auth access request-documents" on storage.objects;
create policy "Auth access request-documents" on storage.objects for all using (bucket_id = 'request-documents' and auth.role() = 'authenticated') with check (bucket_id = 'request-documents' and auth.role() = 'authenticated');

drop policy if exists "Auth access signatures" on storage.objects;
create policy "Auth access signatures" on storage.objects for all using (bucket_id = 'signatures' and auth.role() = 'authenticated') with check (bucket_id = 'signatures' and auth.role() = 'authenticated');

-- 7. Trigger: auto create profile on signup (con search_path seguro)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_val public.user_role := 'tenant';
begin
  if lower(new.email) in ('lina.torres@gmail.com','alejandro.henao@gmail.com','cristian.camilo@gmail.com','amy.vargas@gmail.com') then
    role_val := 'owner';
  end if;

  insert into public.profiles (id, email, full_name, role, accepted_terms)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    role_val,
    coalesce((new.raw_user_meta_data->>'accepted_terms')::boolean, false)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 8. Función PostGIS para búsqueda por radio (apuntando al esquema extensions)
create or replace function public.properties_within_radius(
  lat double precision,
  lng double precision,
  radius_km double precision
)
returns setof public.properties
language sql
stable
set search_path = public, extensions
as $$
  select * from public.properties
  where status = 'published'
    and latitude is not null
    and longitude is not null
    and extensions.ST_DWithin(
      extensions.ST_SetSRID(extensions.ST_MakePoint(longitude, latitude), 4326)::extensions.geography,
      extensions.ST_SetSRID(extensions.ST_MakePoint(lng, lat), 4326)::extensions.geography,
      radius_km * 1000
    );
$$;