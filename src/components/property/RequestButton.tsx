"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";

export default function RequestButton({ propertyId, ownerId }: { propertyId: string; ownerId: string }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const request = async () => {
    setLoading(true);
    setMsg("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); setLoading(false); return; }
    if (user.id === ownerId) { setMsg("No puedes solicitar tu propia propiedad."); setLoading(false); return; }

    // check existing request
    const { data: existing } = await supabase
      .from("rental_requests")
      .select("id, status")
      .eq("property_id", propertyId)
      .eq("tenant_id", user.id)
      .maybeSingle();
    if (existing) { setMsg("Ya tienes una solicitud para esta propiedad."); setLoading(false); return; }

    const { error } = await supabase.from("rental_requests").insert({
      property_id: propertyId,
      tenant_id: user.id,
      status: "pending",
    });
    if (error) { setMsg(error.message); setLoading(false); return; }
    setMsg("Solicitud enviada. Recuerda que hay dos filtros para la confirmación del arriendo.");
    setLoading(false);
    router.push("/tenant/requests");
  };

  return (
    <div>
      <Button onClick={request} loading={loading} className="w-full">Solicitar arriendo</Button>
      {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
    </div>
  );
}
