"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";

export default function NearbyChecker() {
  const supabase = createClient();
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const { data } = await supabase.from("properties").select("*").eq("status", "published");
      const seen = JSON.parse(localStorage.getItem("arriendaya_nearby_seen") || "[]");
      const newSeen = [...seen];
      for (const p of data || []) {
        if (!p.latitude || !p.longitude) continue;
        const R = 6371;
        const dLat = ((p.latitude - lat) * Math.PI) / 180;
        const dLon = ((p.longitude - lng) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat * Math.PI) / 180) * Math.cos((p.latitude * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        if (dist <= 10 && !seen.includes(p.id)) {
          toast.show(`Nueva propiedad disponible cerca de ti: ${p.name}`, "info", { label: "Ver", onClick: () => router.push(`/properties/${p.id}`) });
          newSeen.push(p.id);
        }
      }
      localStorage.setItem("arriendaya_nearby_seen", JSON.stringify(newSeen));
    }, () => {});
  }, [supabase, toast]);

  return null;
}
