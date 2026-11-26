"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRentalRequest } from "@/modules/rental-requests/service";
import Button from "@/components/ui/Button";

export default function RequestButton({ propertyId, ownerId }: { propertyId: string; ownerId: string }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const router = useRouter();

  const request = async () => {
    setLoading(true);
    setMsg("");
    const res = await createRentalRequest(propertyId, ownerId);
    setLoading(false);

    if (!res.ok) {
      if (res.error === "UNAUTHENTICATED") {
        router.push("/login");
        return;
      }
      setMsg(res.error);
      return;
    }

    setMsg("Solicitud enviada. Recuerda que hay dos filtros para la confirmación del arriendo.");
    router.push("/tenant/requests");
  };

  return (
    <div>
      <Button onClick={request} loading={loading} className="w-full">
        Solicitar arriendo
      </Button>
      {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
    </div>
  );
}
