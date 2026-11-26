export interface RolePermissionEntry {
  capability: string;
  scope: string;
  admin: string;
  owner: string;
  tenant: string;
  anonymous: string;
  enforcement: string;
}

export const ROLES_PERMISSIONS_MATRIX: RolePermissionEntry[] = [
  {
    capability: "Catálogo público y detalle de inmuebles publicados",
    scope: "UI (/properties, /properties/[id]) + RLS properties",
    admin: "Lectura total (cualquier estado o moderación)",
    owner: "Lectura pública + lectura/gestión solo de sus inmuebles",
    tenant: "Lectura de publicados activos + vinculados por contrato/solicitud/visita",
    anonymous: "Solo publicados con moderation_status = 'active'",
    enforcement: "RLS properties public read (0005 + 0006) + filtro repositorio",
  },
  {
    capability: "Creación, edición y cambio de estado de inmuebles",
    scope: "UI (/owner/properties*) + /api/properties/[id]",
    admin: "Solo moderación no destructiva (pause/suspend/restore); puede eliminar si no hay contratos",
    owner: "CRUD de sus inmuebles; bloqueado publicar si tiene moderación administrativa",
    tenant: "Denegado (403 / redirección proxy + RLS)",
    anonymous: "Denegado (401 / login)",
    enforcement: "proxy.ts + requireApiAuth + trigger protect_property_moderation",
  },
  {
    capability: "Solicitudes de alquiler y notas privadas",
    scope: "UI (/owner/requests, /tenant/requests) + /api/requests*",
    admin: "Supervisión agregada (no crea solicitudes)",
    owner: "Aprueba/devuelve/rechaza solicitudes de sus inmuebles; lee notas de sus solicitudes",
    tenant: "Crea solicitudes (solo inmuebles activos), sube documentos y agrega notas",
    anonymous: "Denegado",
    enforcement: "requireApiAuth + trigger enforce_rental_request_transitions + RLS",
  },
  {
    capability: "Contratos y firmas digitales",
    scope: "UI (/contracts/[id]) + /api/contracts/[id]/*",
    admin: "Supervisión de conteos e historial (la moderación no cancela contratos)",
    owner: "Crea borrador, edita términos antes de firma y firma como propietario",
    tenant: "Consulta su contrato y firma como inquilino",
    anonymous: "Denegado",
    enforcement: "requireApiAuth + triggers protect_signed_contracts & on_contract_activated",
  },
  {
    capability: "Pagos y gastos",
    scope: "UI (/owner/finances, /tenant/finances) + /api/payments*",
    admin: "Sin mutación directa",
    owner: "Confirma/rechaza pagos de sus contratos y registra gastos",
    tenant: "Registra pago pendiente/comprobante de su contrato",
    anonymous: "Denegado",
    enforcement: "requireApiAuth + trigger protect_payments + RLS",
  },
  {
    capability: "Almacenamiento privado (documentos y firmas)",
    scope: "Storage (request-documents, signatures) + /api/storage/*",
    admin: "Consulta controlada de verificación de identidad vía URL firmada",
    owner: "Sube/firma y lee solo archivos de sus solicitudes/contratos",
    tenant: "Sube documentos personales y firmas de sus contratos",
    anonymous: "Denegado",
    enforcement: "requireApiAuth + storage policies (0004) + validación MIME/tamaño",
  },
  {
    capability: "Reportes y soporte",
    scope: "UI (/admin/reports, /owner/reports, /tenant/help) + /api/reports*",
    admin: "Lectura total, respuesta oficial y cambio de estado",
    owner: "Crea reportes y responde únicamente reportes sobre sus inmuebles",
    tenant: "Crea reportes y lee solo los propios",
    anonymous: "Denegado",
    enforcement: "requireApiAuth + /api/reports + RLS reports + trigger updated_at",
  },
  {
    capability: "Panel administrativo, usuarios, suspensiones y auditoría",
    scope: "UI (/admin*) + /api/admin/*",
    admin: "Acceso completo (sin auto-suspensión ni suspensión del último admin)",
    owner: "Denegado (403 en API / redirección en proxy)",
    tenant: "Denegado (403 en API / redirección en proxy)",
    anonymous: "Denegado (401 en API / login)",
    enforcement: "proxy.ts + requirePageRole(['admin']) + requireApiAuth(['admin']) + triggers DB",
  },
  {
    capability: "Cuenta suspendida",
    scope: "Sesión previa + login + páginas + APIs",
    admin: "Si se suspende (otro admin), pierde acceso inmediato",
    owner: "Bloqueado en login, proxy, páginas, APIs (403 ACCOUNT_SUSPENDED) y perfil DB",
    tenant: "Bloqueado en login, proxy, páginas, APIs (403 ACCOUNT_SUSPENDED) y perfil DB",
    anonymous: "No aplica",
    enforcement: "Auth ban + profiles.suspended_at + proxy.ts + server-guard + trigger DB",
  },
];
