// Owner invitations are now managed in the database (owner_invitations table).
// In local/demo mode, the seed adds the internal owner emails.
export function isOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  const db = typeof window !== "undefined" ? (window as any).__arriendaya_db : null;
  // fallback: check localStorage cache
  try {
    const raw = localStorage.getItem("arriendaya_db");
    if (raw) {
      const parsed = JSON.parse(raw);
      return (parsed.owner_invitations || []).some((o: any) => o.email?.toLowerCase() === email.toLowerCase());
    }
  } catch {}
  return false;
}
export const PROPERTY_TYPES = [
  "Apartamento",
  "Casa",
  "Habitación",
  "Estudio",
  "Cabaña",
  "Finca",
  "Local comercial",
  "Oficina",
  "Bodega",
];

export const RENTAL_TYPES = [
  { value: "vivienda", label: "Vivienda" },
  { value: "recreativo", label: "Recreativo" },
] as const;

export const PRICE_PERIODS = [
  { value: "mes", label: "por mes" },
  { value: "dia", label: "por día" },
  { value: "hora", label: "por hora" },
] as const;

export const LABOR_PROFILES = [
  { value: "empleado", label: "Empleado" },
  { value: "independiente", label: "Independiente" },
  { value: "pensionado", label: "Pensionado" },
] as const;

export const REQUEST_STATUSES = {
  pending: "Pendiente (1er filtro)",
  first_accepted: "Aceptada (subir documentos)",
  docs_submitted: "Documentos enviados (2º filtro)",
  returned: "Devuelta (corregir)",
  accepted: "Aceptada (contrato)",
  rejected: "Rechazada",
  expired: "Expirada",
  property_rented: "Propiedad ya alquilada",
} as const;

export const REQUIRED_DOCS_VIVIENDA = [
  "Cédula de ciudadanía o extranjería (ampliada al 150%)",
  "Formulario de solicitud de arrendamiento diligenciado y firmado",
  "Extractos bancarios de los últimos 3 meses",
];

export const REQUIRED_DOCS_RECREATIVO = [
  "Cédula de ciudadanía o extranjería (ampliada al 150%)",
  "Formulario de solicitud de arrendamiento diligenciado y firmado",
  "Extractos bancarios de los últimos 3 meses",
];

export const LABOR_DOCS = {
  empleado: [
    "Certificado laboral original (sueldo, cargo, antigüedad, <30 días)",
    "Últimos 3 a 6 comprobantes de pago de nómina (colillas)",
  ],
  independiente: [
    "RUT actualizado (expedido en los últimos 30 días)",
    "Declaración de renta del último año",
    "Certificación de ingresos por contador público (con tarjeta profesional)",
  ],
  pensionado: [
    "Certificado o comprobante de pago de la pensión",
    "Extractos bancarios recientes",
  ],
};

export const COSIGNER_DOCS = [
  "Fotocopia de la cédula de ciudadanía",
  "Certificados de ingresos (según perfil)",
  "Certificado de Tradición y Libertad (si se exige finca raíz)",
];
