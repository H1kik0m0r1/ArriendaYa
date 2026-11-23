export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold text-primary">Términos y condiciones</h1>
      <div className="prose text-sm leading-relaxed text-foreground">
        <p>
          Al usar ArriendaYa aceptas que la plataforma actúa como intermediaria entre propietarios e inquilinos.
          Los datos personales se usan únicamente para gestionar arriendos y verificaciones.
        </p>
        <p>
          El propietario es responsable de la información publicada. El inquilino es responsable de la veracidad de los
          documentos adjuntos. ArriendaYa no se hace responsable por acuerdos fuera de la plataforma.
        </p>
        <p>
          Los contratos generados son básicos y deben ser revisados por las partes. La firma digital tiene validez
          informativa dentro de la plataforma.
        </p>
      </div>
    </div>
  );
}
