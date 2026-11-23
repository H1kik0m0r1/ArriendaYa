import Accordion from "@/components/ui/Accordion";

export default function TenantHelpPage() {
  const faqs = [
    { q: "¿Cómo solicito un arriendo?", a: "En el detalle de la propiedad, haz clic en 'Solicitar arriendo'." },
    { q: "¿Qué documentos necesito?", a: "Cédula, formulario diligenciado, extractos bancarios y según tu perfil laboral." },
    { q: "¿Cómo firmo el contrato?", a: "Cuando tu solicitud sea aceptada, ve a Contratos y firma con el canvas." },
  ];
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-primary">Ayuda y soporte</h1>
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-2 font-semibold">Preguntas frecuentes</h2>
        <Accordion items={faqs} />
      </div>
      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-2 font-semibold">Reportar un problema</h2>
        <p className="text-sm text-muted">Envía un reporte desde la sección de notificaciones o contacta al equipo de soporte.</p>
      </div>
    </div>
  );
}
