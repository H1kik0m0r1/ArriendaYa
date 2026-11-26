-- Fase 2 / 0004: Endurecimiento integral de seguridad, roles, RLS, triggers y Storage privado
-- Orden de ejecucion:
--   1. 0001_init.sql
--   2. 0002_security.sql
--   3. 0003_rls_complete.sql
--   4. 0004_security_hardening.sql

-- 1. Ampliar enum user_role con 'admin' de forma idempotente y no destructiva
alter type public.user_role add value if not exists 'admin';

-- 2. Columnas complementarias no destructivas para invitaciones y auditoria basica
alter table public.owner_invitations
  add column if not exists expires_at timestamptz,
  add column if not exists used_at timestamptz;

alter table public.owner_invitations enable row level security;

-- 3. Funciones auxiliares seguras (SECURITY DEFINER + search_path fijo)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role::text = 'admin'
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role::text = 'owner'
  );
$$;

create or replace function public.is_property_owner(p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.properties pr
    where pr.id = p_property_id
      and pr.owner_id = auth.uid()
  );
$$;

create or replace function public.is_request_participant(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rental_requests r
    join public.properties pr on pr.id = r.property_id
    where r.id = p_request_id
      and (r.tenant_id = auth.uid() or pr.owner_id = auth.uid())
  );
$$;

create or replace function public.is_contract_participant(p_contract_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.contracts c
    where c.id = p_contract_id
      and (c.tenant_id = auth.uid() or c.owner_id = auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_owner() from public;
revoke all on function public.is_property_owner(uuid) from public;
revoke all on function public.is_request_participant(uuid) from public;
revoke all on function public.is_contract_participant(uuid) from public;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.is_property_owner(uuid) to authenticated;
grant execute on function public.is_request_participant(uuid) to authenticated;
grant execute on function public.is_contract_participant(uuid) to authenticated;

-- Fijar search_path en properties_within_radius
alter function public.properties_within_radius(double precision, double precision, double precision)
  set search_path = public, extensions;

-- 4. Corregir trigger handle_new_user (ignora cualquier rol enviado desde el frontend, nunca asigna admin)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_val public.user_role := 'tenant';
  v_email text := lower(trim(coalesce(new.email, '')));
begin
  if exists (
    select 1
    from public.owner_invitations oi
    where lower(trim(oi.email)) = v_email
      and oi.used_at is null
      and (oi.expires_at is null or oi.expires_at > now())
  ) then
    role_val := 'owner';
    update public.owner_invitations
      set used_at = now()
      where lower(trim(email)) = v_email
        and used_at is null;
  end if;

  insert into public.profiles (id, email, full_name, phone, role, accepted_terms)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'phone', ''),
    role_val,
    coalesce((new.raw_user_meta_data->>'accepted_terms')::boolean, false)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- 5. Triggers de integridad y proteccion contra escalamiento / mutaciones ilegitimas

-- 5.1 Bloquear auto-cambio de rol o email en profiles
create or replace function public.protect_profile_sensitive_fields()
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

  if new.role is distinct from old.role then
    raise exception 'No tienes permisos para cambiar el rol del perfil';
  end if;

  if new.email is distinct from old.email then
    raise exception 'El correo del perfil no puede modificarse directamente';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_sensitive_fields on public.profiles;
create trigger trg_protect_profile_sensitive_fields
  before update on public.profiles
  for each row execute function public.protect_profile_sensitive_fields();

-- 5.2 Maquina de estados controlada para rental_requests
create or replace function public.enforce_rental_request_transitions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_is_admin boolean;
begin
  if pg_trigger_depth() > 1
     and nullif(current_setting('arriendaya.internal_contract_activation', true), '') is not null
     and new.status = 'property_rented'
     and old.status in ('pending', 'first_accepted', 'docs_submitted', 'returned')
     and new.property_id is not distinct from old.property_id
     and new.tenant_id is not distinct from old.tenant_id
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

  if current_setting('role', true) = 'service_role' then
    new.updated_at := now();
    return new;
  end if;

  v_is_admin := public.is_admin();
  if v_is_admin then
    new.updated_at := now();
    return new;
  end if;

  select p.owner_id into v_owner_id
  from public.properties p
  where p.id = old.property_id;

  if new.property_id is distinct from old.property_id or new.tenant_id is distinct from old.tenant_id then
    raise exception 'No es posible reasignar la propiedad o el inquilino de una solicitud';
  end if;

  if old.status is not distinct from new.status then
    if auth.uid() = old.tenant_id and old.status in ('first_accepted', 'returned') then
      if new.first_deadline is distinct from old.first_deadline
         or new.first_decision_at is distinct from old.first_decision_at
         or new.rejection_reason is distinct from old.rejection_reason
         or new.return_message is distinct from old.return_message then
        raise exception 'El inquilino no puede modificar campos de decision o plazos';
      end if;
      new.updated_at := now();
      return new;
    end if;
    if auth.uid() = v_owner_id then
      if new.labor_profile is distinct from old.labor_profile
         or new.has_cosigner is distinct from old.has_cosigner
         or new.cosigner_requires_property is distinct from old.cosigner_requires_property
         or new.desired_duration_value is distinct from old.desired_duration_value
         or new.desired_duration_unit is distinct from old.desired_duration_unit then
        raise exception 'El propietario no puede alterar los datos declarados por el inquilino';
      end if;
      new.updated_at := now();
      return new;
    end if;
    raise exception 'No autorizado para modificar esta solicitud';
  end if;

  if auth.uid() = old.tenant_id then
    if old.status in ('first_accepted', 'returned') and new.status = 'docs_submitted' then
      if new.first_deadline is distinct from old.first_deadline
         or new.first_decision_at is distinct from old.first_decision_at
         or new.rejection_reason is distinct from old.rejection_reason
         or new.return_message is distinct from old.return_message then
        raise exception 'No puedes alterar decisiones previas al enviar documentos';
      end if;
      new.updated_at := now();
      return new;
    end if;
    if old.status in ('pending', 'first_accepted', 'docs_submitted', 'returned') and new.status = 'rejected' then
      new.updated_at := now();
      return new;
    end if;
    raise exception 'Transicion de solicitud no permitida para inquilino (% -> %)', old.status, new.status;
  end if;

  if auth.uid() = v_owner_id then
    if old.status = 'pending' and new.status in ('first_accepted', 'rejected', 'expired', 'property_rented') then
      new.updated_at := now();
      return new;
    end if;
    if old.status in ('docs_submitted', 'returned') and new.status in ('accepted', 'rejected', 'returned', 'property_rented') then
      new.updated_at := now();
      return new;
    end if;
    if old.status = 'first_accepted' and new.status in ('expired', 'rejected', 'property_rented') then
      new.updated_at := now();
      return new;
    end if;
    raise exception 'Transicion de solicitud no permitida para propietario (% -> %)', old.status, new.status;
  end if;

  raise exception 'No autorizado para cambiar el estado de esta solicitud';
end;
$$;

drop trigger if exists trg_enforce_rental_request_transitions on public.rental_requests;
create trigger trg_enforce_rental_request_transitions
  before update on public.rental_requests
  for each row execute function public.enforce_rental_request_transitions();

-- 5.3 Impedir crear contratos desde solicitudes rechazadas/expiradas y proteger contratos firmados
create or replace function public.validate_contract_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req record;
  v_prop_owner uuid;
begin
  select owner_id into v_prop_owner from public.properties where id = new.property_id;
  if v_prop_owner is null or v_prop_owner <> new.owner_id then
    raise exception 'El owner_id del contrato debe coincidir con el propietario del inmueble';
  end if;

  if new.request_id is not null then
    select id, property_id, tenant_id, status into v_req
    from public.rental_requests
    where id = new.request_id;

    if not found then
      raise exception 'Solicitud asociada no encontrada';
    end if;
    if v_req.property_id <> new.property_id or v_req.tenant_id <> new.tenant_id then
      raise exception 'La solicitud no corresponde al inmueble o inquilino del contrato';
    end if;
    if v_req.status <> 'accepted' then
      raise exception 'No se puede crear contrato desde una solicitud en estado %', v_req.status;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_contract_insert on public.contracts;
create trigger trg_validate_contract_insert
  before insert on public.contracts
  for each row execute function public.validate_contract_insert();

create or replace function public.protect_signed_contracts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_any_sig boolean;
  v_is_valid_renewal boolean;
begin
  if current_setting('role', true) = 'service_role' or public.is_admin() then
    new.updated_at := now();
    return new;
  end if;

  if new.owner_id is distinct from old.owner_id
     or new.tenant_id is distinct from old.tenant_id
     or new.property_id is distinct from old.property_id
     or new.request_id is distinct from old.request_id then
    raise exception 'No es posible modificar las partes ni el inmueble de un contrato';
  end if;

  v_has_any_sig := (old.owner_signature_url is not null)
                or (old.tenant_signature_url is not null)
                or (old.signed_at is not null)
                or (old.status::text <> 'pending_signatures');

  if old.owner_signature_url is not null and new.owner_signature_url is distinct from old.owner_signature_url then
    raise exception 'La firma del propietario no puede modificarse';
  end if;
  if old.tenant_signature_url is not null and new.tenant_signature_url is distinct from old.tenant_signature_url then
    raise exception 'La firma del inquilino no puede modificarse';
  end if;

  if new.owner_signature_url is distinct from old.owner_signature_url then
    if auth.uid() <> old.owner_id then
      raise exception 'Solo el propietario puede registrar su firma';
    end if;
    if old.status <> 'pending_signatures' or new.owner_signature_url is null or length(trim(new.owner_signature_url)) = 0 then
      raise exception 'Firma del propietario invalida o contrato cerrado';
    end if;
  end if;

  if new.tenant_signature_url is distinct from old.tenant_signature_url then
    if auth.uid() <> old.tenant_id then
      raise exception 'Solo el inquilino puede registrar su firma';
    end if;
    if old.status <> 'pending_signatures' or new.tenant_signature_url is null or length(trim(new.tenant_signature_url)) = 0 then
      raise exception 'Firma del inquilino invalida o contrato cerrado';
    end if;
  end if;

  if new.signed_at is distinct from old.signed_at then
    raise exception 'La fecha de firma se asigna automaticamente al completarse ambas firmas';
  end if;

  v_is_valid_renewal := (
    auth.uid() = old.owner_id
    and old.status in ('active', 'expiring')
    and new.status in ('active', 'renewed')
    and new.end_date is not null
    and (old.end_date is null or new.end_date > old.end_date)
    and new.reminder_month_sent = false
    and new.reminder_week_sent = false
  );

  if (new.reminder_month_sent is distinct from old.reminder_month_sent
      or new.reminder_week_sent is distinct from old.reminder_week_sent)
     and not v_is_valid_renewal then
    raise exception 'Los indicadores de recordatorio solo pueden gestionarse desde el servidor o al renovar';
  end if;

  if old.status = 'pending_signatures' then
    if new.status is distinct from old.status then
      raise exception 'El contrato no puede cambiar de estado manualmente; se activa al completarse ambas firmas';
    end if;

    if v_has_any_sig then
      if new.terms is distinct from old.terms then
        raise exception 'No se pueden modificar los terminos de un contrato con firma registrada';
      end if;
      if new.start_date is distinct from old.start_date then
        raise exception 'No se puede modificar la fecha de inicio de un contrato con firma registrada';
      end if;
      if new.end_date is distinct from old.end_date then
        raise exception 'No se puede modificar la fecha de fin de un contrato con firma registrada';
      end if;
    else
      if (new.terms is distinct from old.terms
          or new.start_date is distinct from old.start_date
          or new.end_date is distinct from old.end_date)
         and auth.uid() <> old.owner_id then
        raise exception 'Solo el propietario puede editar los terminos del contrato';
      end if;
    end if;

    if new.owner_signature_url is not null and new.tenant_signature_url is not null then
      new.signed_at := now();
      new.status := 'active';
    end if;
  else
    if new.terms is distinct from old.terms then
      raise exception 'No se pueden modificar los terminos de un contrato firmado';
    end if;
    if new.start_date is distinct from old.start_date then
      raise exception 'No se puede modificar la fecha de inicio de un contrato firmado';
    end if;

    if new.end_date is distinct from old.end_date then
      if not (auth.uid() = old.owner_id and old.status in ('active', 'expiring') and new.end_date is not null and (old.end_date is null or new.end_date > old.end_date)) then
        raise exception 'Solo el propietario puede extender la fecha fin al renovar un contrato activo';
      end if;
    end if;

    if new.status is distinct from old.status then
      if not (auth.uid() = old.owner_id and old.status in ('active', 'expiring') and new.status in ('suspended', 'renewed', 'active')) then
        raise exception 'Cambio de estado de contrato no permitido (% -> %)', old.status, new.status;
      end if;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- Reemplazamos el trigger de la Fase 3 B1 por este más completo
drop trigger if exists trg_protect_contract_fields on public.contracts;
drop trigger if exists trg_protect_signed_contracts on public.contracts;
create trigger trg_protect_signed_contracts
  before update on public.contracts
  for each row execute function public.protect_signed_contracts();

-- 5.4 Cierre automatico y notificaciones al completarse ambas firmas de un contrato
create or replace function public.on_contract_activated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prop_name text;
begin
  if old.status is distinct from new.status and new.status = 'active' and old.status = 'pending_signatures' then
    select name into v_prop_name from public.properties where id = new.property_id;

    update public.properties
      set status = 'rented', updated_at = now()
      where id = new.property_id;

    if new.request_id is not null then
      update public.rental_requests
        set status = 'accepted', updated_at = now()
        where id = new.request_id and status <> 'accepted';
    end if;

    insert into public.notifications (user_id, type, title, message, link)
    select r.tenant_id,
           'property_rented',
           'Propiedad alquilada',
           'La propiedad "' || coalesce(v_prop_name, 'inmueble') || '" ya ha sido alquilada.',
           '/tenant/requests/' || r.id::text
    from public.rental_requests r
    where r.property_id = new.property_id
      and r.id is distinct from new.request_id
      and r.status in ('pending', 'first_accepted', 'docs_submitted', 'returned');

    perform set_config('arriendaya.internal_contract_activation', new.id::text, true);

    update public.rental_requests
      set status = 'property_rented', updated_at = now()
      where property_id = new.property_id
        and id is distinct from new.request_id
        and status in ('pending', 'first_accepted', 'docs_submitted', 'returned');

    perform set_config('arriendaya.internal_contract_activation', '', true);

    insert into public.notifications (user_id, type, title, message, link)
    values
      (new.owner_id, 'contract_active', 'Contrato activado', 'El contrato de "' || coalesce(v_prop_name, 'inmueble') || '" fue firmado por ambas partes.', '/contracts/' || new.id::text),
      (new.tenant_id, 'contract_active', 'Contrato activado', 'El contrato de "' || coalesce(v_prop_name, 'inmueble') || '" fue firmado por ambas partes.', '/contracts/' || new.id::text);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_on_contract_activated on public.contracts;
create trigger trg_on_contract_activated
  after update on public.contracts
  for each row execute function public.on_contract_activated();

-- 5.5 Proteccion de pagos
create or replace function public.protect_payments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_tenant_id uuid;
  v_contract_status public.contract_status;
begin
  if current_setting('role', true) = 'service_role' or public.is_admin() then
    return new;
  end if;

  if new.contract_id is null then
    raise exception 'El pago debe estar asociado a un contrato valido';
  end if;

  select c.owner_id, c.tenant_id, c.status
    into v_owner_id, v_tenant_id, v_contract_status
  from public.contracts c
  where c.id = new.contract_id;

  if v_owner_id is null then
    raise exception 'Contrato no encontrado';
  end if;

  if tg_op = 'INSERT' then
    if v_contract_status not in ('active', 'expiring', 'renewed') then
      raise exception 'Solo se pueden registrar pagos en contratos activos';
    end if;
    if new.amount is null or new.amount <= 0 then
      raise exception 'El monto del pago debe ser mayor a cero';
    end if;
    if new.tenant_id is distinct from v_tenant_id then
      raise exception 'El pago debe corresponder al inquilino del contrato';
    end if;

    if auth.uid() = v_owner_id then
      new.status := 'pendiente';
      new.receipt_url := null;
      return new;
    elsif auth.uid() = v_tenant_id then
      if new.status not in ('pendiente', 'comprobante_enviado') then
        raise exception 'Un inquilino no puede registrar un pago como confirmado';
      end if;
      if new.status = 'comprobante_enviado' and (new.receipt_url is null or length(trim(new.receipt_url)) = 0) then
        raise exception 'Debes adjuntar el comprobante de pago';
      end if;
      return new;
    else
      raise exception 'No autorizado para registrar pagos en este contrato';
    end if;
  end if;

  if old.status = 'confirmado' then
    raise exception 'Un pago confirmado no puede modificarse';
  end if;

  if new.contract_id is distinct from old.contract_id
     or new.tenant_id is distinct from old.tenant_id
     or new.amount is distinct from old.amount
     or new.concept is distinct from old.concept
     or new.date is distinct from old.date then
    raise exception 'No se pueden alterar el contrato, inquilino, monto, concepto o fecha de un pago existente';
  end if;

  if auth.uid() = v_owner_id then
    if new.receipt_url is distinct from old.receipt_url then
      raise exception 'El propietario no puede modificar el comprobante del inquilino';
    end if;
    if new.status not in ('pendiente', 'comprobante_enviado', 'confirmado', 'rechazado') then
      raise exception 'Estado de pago invalido';
    end if;
    return new;
  elsif auth.uid() = old.tenant_id then
    if old.status not in ('pendiente', 'comprobante_enviado') then
      raise exception 'No puedes modificar un pago ya procesado';
    end if;
    if new.status not in ('pendiente', 'comprobante_enviado') then
      raise exception 'Solo el propietario puede confirmar o rechazar un pago';
    end if;
    if old.status = 'comprobante_enviado' and (new.status <> 'comprobante_enviado' or new.receipt_url is null or length(trim(new.receipt_url)) = 0) then
      raise exception 'No puedes eliminar el comprobante ni revertir a pendiente un pago ya enviado';
    end if;
    if new.receipt_url is distinct from old.receipt_url and new.receipt_url is not null and length(trim(new.receipt_url)) > 0 then
      new.status := 'comprobante_enviado';
    end if;
    if new.status = 'comprobante_enviado' and (new.receipt_url is null or length(trim(new.receipt_url)) = 0) then
      raise exception 'Debes adjuntar el comprobante de pago';
    end if;
    return new;
  end if;

  raise exception 'No autorizado para actualizar este pago';
end;
$$;

drop trigger if exists trg_protect_payments on public.payments;
create trigger trg_protect_payments
  before insert or update on public.payments
  for each row execute function public.protect_payments();

-- 5.6 Proteccion de owner_verifications
create or replace function public.protect_owner_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('role', true) = 'service_role' or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.email_verified := false;
    new.phone_verified := false;
    new.status := 'pendiente';
    return new;
  end if;

  if new.email_verified is distinct from old.email_verified
     or new.phone_verified is distinct from old.phone_verified
     or new.status is distinct from old.status then
    if new.identity_doc_url is distinct from old.identity_doc_url then
      new.status := 'pendiente';
      new.email_verified := old.email_verified;
      new.phone_verified := old.phone_verified;
      return new;
    end if;
    raise exception 'Solo un administrador puede aprobar o modificar el estado de verificacion';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_owner_verification on public.owner_verifications;
create trigger trg_protect_owner_verification
  before insert or update on public.owner_verifications
  for each row execute function public.protect_owner_verification();

-- 5.7 Proteccion de request_documents
create or replace function public.protect_request_documents()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_owner_id uuid;
  v_req_status public.request_status;
begin
  if current_setting('role', true) = 'service_role' or public.is_admin() then
    return new;
  end if;

  select r.tenant_id, p.owner_id, r.status
    into v_tenant_id, v_owner_id, v_req_status
  from public.rental_requests r
  join public.properties p on p.id = r.property_id
  where r.id = coalesce(old.request_id, new.request_id);

  if not found or v_tenant_id is null or v_req_status is null then
    raise exception 'Solicitud asociada no encontrada';
  end if;

  if new.file_url is null or length(trim(new.file_url)) = 0 then
    raise exception 'La ruta del archivo es obligatoria';
  end if;

  if tg_op = 'INSERT' then
    if auth.uid() <> v_tenant_id then
      raise exception 'Solo el inquilino solicitante puede cargar documentos';
    end if;
    if v_req_status not in ('first_accepted', 'returned') then
      raise exception 'La solicitud no esta habilitada para recibir documentos';
    end if;
    new.status := 'pendiente';
    return new;
  end if;

  if new.request_id is distinct from old.request_id then
    raise exception 'No se puede trasladar un documento a otra solicitud';
  end if;

  if new.doc_type is distinct from old.doc_type then
    raise exception 'No se puede modificar el tipo de documento';
  end if;

  if auth.uid() = v_tenant_id then
    if new.file_url is distinct from old.file_url then
      if old.status not in ('pendiente', 'rechazado') then
        raise exception 'Solo puedes reemplazar documentos pendientes o rechazados';
      end if;
      if v_req_status not in ('first_accepted', 'returned') then
        raise exception 'La solicitud no permite reemplazar documentos en su estado actual';
      end if;
      new.status := 'pendiente';
      new.uploaded_at := now();
      return new;
    end if;
    if new.status is distinct from old.status then
      raise exception 'El inquilino no puede modificar el estado de aprobacion';
    end if;
    return new;
  end if;

  if auth.uid() = v_owner_id then
    if new.file_url is distinct from old.file_url or new.uploaded_at is distinct from old.uploaded_at then
      raise exception 'El propietario no puede reemplazar el archivo del inquilino';
    end if;
    if new.status not in ('pendiente', 'aprobado', 'rechazado') then
      raise exception 'Estado de documento invalido';
    end if;
    return new;
  end if;

  raise exception 'No autorizado para modificar este documento';
end;
$$;

drop trigger if exists trg_protect_request_documents on public.request_documents;
create trigger trg_protect_request_documents
  before insert or update on public.request_documents
  for each row execute function public.protect_request_documents();

-- 5.8 Notificaciones automaticas seguras en BD
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
      'Recibiste una solicitud para "' || coalesce(v_prop_name, 'tu inmueble') || '".',
      '/owner/requests/' || new.id::text
    );
    return new;
  end if;

  if old.status is distinct from new.status then
    if new.status = 'first_accepted' then
      insert into public.notifications (user_id, type, title, message, link)
      values (new.tenant_id, 'request_first_accepted', 'Solicitud aceptada (1er filtro)', 'Tu solicitud para "' || coalesce(v_prop_name, 'el inmueble') || '" fue aceptada. Ahora sube los documentos requeridos.', '/tenant/requests/' || new.id::text);
    elsif new.status = 'docs_submitted' then
      insert into public.notifications (user_id, type, title, message, link)
      values (v_owner_id, 'docs_submitted', 'Documentos recibidos', 'El inquilino envio documentos para "' || coalesce(v_prop_name, 'tu inmueble') || '".', '/owner/requests/' || new.id::text);
    elsif new.status = 'returned' then
      insert into public.notifications (user_id, type, title, message, link)
      values (new.tenant_id, 'request_returned', 'Solicitud devuelta', 'Tu solicitud para "' || coalesce(v_prop_name, 'el inmueble') || '" fue devuelta: ' || coalesce(new.return_message, 'revisa los documentos'), '/tenant/requests/' || new.id::text);
    elsif new.status = 'accepted' then
      insert into public.notifications (user_id, type, title, message, link)
      values (new.tenant_id, 'request_accepted', 'Solicitud aceptada (2o filtro)', 'Tu solicitud para "' || coalesce(v_prop_name, 'el inmueble') || '" fue aceptada. Procede a firmar el contrato.', '/tenant/requests/' || new.id::text);
    elsif new.status = 'rejected' then
      if auth.uid() = new.tenant_id then
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

drop trigger if exists trg_request_status_notify on public.rental_requests;
drop trigger if exists trg_request_events_notify on public.rental_requests;
create trigger trg_request_events_notify
  after insert or update on public.rental_requests
  for each row execute function public.notify_request_events();

-- 6. Ajuste de RLS complementario para las reglas del bloque 5

-- 6.1 request_documents: permitir al propietario hacer UPDATE (aprobar/rechazar) y admin acceso total
drop policy if exists "docs owner update" on public.request_documents;
create policy "docs owner update" on public.request_documents for update
  using (public.is_request_participant(request_id))
  with check (public.is_request_participant(request_id));

-- 6.2 notifications: el usuario solo puede leer/marcar leidas sus propias notificaciones (no crear notificaciones falsas a terceros)
drop policy if exists "notif self" on public.notifications;
drop policy if exists "notif self read update" on public.notifications;
drop policy if exists "notif self delete" on public.notifications;

create policy "notif self read update" on public.notifications for select
  using (user_id = auth.uid() or public.is_admin());

create policy "notif self mark read" on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notif self delete" on public.notifications for delete
  using (user_id = auth.uid());

-- 6.3 owner_invitations: usar helper is_admin()
drop policy if exists "owner_invitations admin manage" on public.owner_invitations;
create policy "owner_invitations admin manage" on public.owner_invitations for all
  using (public.is_admin())
  with check (public.is_admin());

-- 7. Storage privado: politicas basadas en participantes (rutas: {request_id}/archivo y {contract_id}/archivo)
update storage.buckets set public = false where id in ('request-documents', 'signatures');

drop policy if exists "Users manage own request-documents" on storage.objects;
drop policy if exists "Request participants access documents" on storage.objects;
create policy "Request participants access documents" on storage.objects for all
  using (
    bucket_id = 'request-documents'
    and (
      public.is_admin()
      or auth.uid() = owner
      or (
        (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
        and public.is_request_participant(((storage.foldername(name))[1])::uuid)
      )
    )
  )
  with check (
    bucket_id = 'request-documents'
    and auth.role() = 'authenticated'
    and (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
      and public.is_request_participant(((storage.foldername(name))[1])::uuid)
    )
  );

drop policy if exists "Users manage own signatures" on storage.objects;
drop policy if exists "Contract participants access signatures" on storage.objects;
create policy "Contract participants access signatures" on storage.objects for all
  using (
    bucket_id = 'signatures'
    and (
      public.is_admin()
      or auth.uid() = owner
      or (
        (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
        and public.is_contract_participant(((storage.foldername(name))[1])::uuid)
      )
    )
  )
  with check (
    bucket_id = 'signatures'
    and auth.role() = 'authenticated'
    and (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
      and public.is_contract_participant(((storage.foldername(name))[1])::uuid)
    )
  );