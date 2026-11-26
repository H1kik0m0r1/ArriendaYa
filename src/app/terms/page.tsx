"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== "undefined") {
      const sameOriginReferrer =
        document.referrer && document.referrer.startsWith(window.location.origin);
      if (sameOriginReferrer && window.history.length > 1) {
        router.back();
        return;
      }
    }
    router.push("/register");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <button
          type="button"
          onClick={handleBack}
          aria-label="Volver a la página anterior"
          className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-primary-light/60 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Volver</span>
        </button>
      </div>

      <h1 className="text-2xl font-bold text-primary">Términos y condiciones</h1>
      <div className="space-y-3 text-sm leading-relaxed text-foreground">
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
