export type BadgeColor = "green" | "gray" | "red" | "yellow" | "blue";

export function getRequestStatusBadge(status: string): { label: string; color: BadgeColor } {
  switch (status) {
    case "pending":
      return { label: "Pendiente", color: "yellow" };
    case "first_accepted":
      return { label: "1er filtro aprobado", color: "blue" };
    case "docs_submitted":
      return { label: "Documentos enviados", color: "blue" };
    case "returned":
      return { label: "Devuelta para corrección", color: "yellow" };
    case "accepted":
      return { label: "Aceptada", color: "green" };
    case "rejected":
      return { label: "Rechazada", color: "red" };
    case "expired":
      return { label: "Expirada", color: "gray" };
    case "property_rented":
      return { label: "Propiedad arrendada", color: "gray" };
    default:
      return { label: status, color: "gray" };
  }
}

export function getContractStatusBadge(status: string): { label: string; color: BadgeColor } {
  switch (status) {
    case "pending_signatures":
      return { label: "Pendiente de firmas", color: "yellow" };
    case "active":
      return { label: "Activo", color: "green" };
    case "expiring":
      return { label: "Por vencer", color: "yellow" };
    case "suspended":
      return { label: "Suspendido", color: "red" };
    case "renewed":
      return { label: "Renovado", color: "blue" };
    default:
      return { label: status, color: "gray" };
  }
}

export function getPaymentStatusBadge(status: string): { label: string; color: BadgeColor } {
  switch (status) {
    case "confirmado":
      return { label: "Confirmado", color: "green" };
    case "comprobante_enviado":
      return { label: "Comprobante enviado", color: "blue" };
    case "rechazado":
      return { label: "Rechazado", color: "red" };
    default:
      return { label: "Pendiente", color: "yellow" };
  }
}

export function getDocumentStatusBadge(status?: string): { label: string; color: BadgeColor } {
  switch (status) {
    case "aprobado":
      return { label: "Aprobado", color: "green" };
    case "rechazado":
      return { label: "Rechazado", color: "red" };
    default:
      return { label: "Pendiente", color: "yellow" };
  }
}

export function getPropertyStatusBadge(status: string): { label: string; color: BadgeColor } {
  switch (status) {
    case "published":
      return { label: "Disponible", color: "green" };
    case "rented":
      return { label: "Alquilado", color: "blue" };
    case "paused":
      return { label: "Pausado", color: "yellow" };
    case "maintenance":
      return { label: "Mantenimiento", color: "yellow" };
    case "archived":
      return { label: "Archivado", color: "gray" };
    default:
      return { label: "Borrador", color: "gray" };
  }
}

export function getVisitStatusBadge(status: string): { label: string; color: BadgeColor } {
  switch (status) {
    case "aprobada":
      return { label: "Confirmada", color: "green" };
    case "cancelada":
    case "rechazada":
      return { label: "Cancelada", color: "red" };
    case "completada":
      return { label: "Completada", color: "blue" };
    default:
      return { label: "Solicitada", color: "yellow" };
  }
}
