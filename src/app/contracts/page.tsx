"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ContractsList from "@/components/contracts/ContractsList";

const ownerMenu = [
  { href: "/owner", label: "Panel de control", icon: "📊" },
  { href: "/owner/properties", label: "Mis propiedades", icon: "🏠" },
  { href: "/owner/requests", label: "Solicitudes recibidas", icon: "📋" },
  { href: "/owner/contracts", label: "Contratos", icon: "📝" },
  { href: "/owner/calendar", label: "Calendario", icon: "📅" },
  { href: "/owner/messages", label: "Mensajes", icon: "💬" },
  { href: "/notifications", label: "Notificaciones", icon: "🔔" },
  { href: "/owner/stats", label: "Estadísticas", icon: "📈" },
  { href: "/owner/finances", label: "Finanzas", icon: "💰" },
  { href: "/settings", label: "Configuración", icon: "⚙️" },
];

const tenantMenu = [
  { href: "/tenant", label: "Panel principal", icon: "📊" },
  { href: "/tenant/saved", label: "Mis favoritos", icon: "⭐" },
  { href: "/tenant/requests", label: "Mis solicitudes", icon: "📋" },
  { href: "/tenant/contracts", label: "Mis contratos", icon: "📝" },
  { href: "/tenant/calendar", label: "Calendario y visitas", icon: "📅" },
  { href: "/owner/messages", label: "Mensajes", icon: "💬" },
  { href: "/notifications", label: "Notificaciones", icon: "🔔" },
  { href: "/tenant/finances", label: "Mis pagos y gastos", icon: "💰" },
  { href: "/settings", label: "Configuración", icon: "⚙️" },
  { href: "/tenant/help", label: "Ayuda y soporte", icon: "❓" },
];

export default function ContractsPage() {
  const [role, setRole] = useState<string | null>(null);
  const supabase = createClient();
  const pathname = usePathname();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      setRole(profile?.role || null);
    })();
  }, [supabase]);

  const menu = role === "owner" ? ownerMenu : tenantMenu;

  return (
    <div className="flex gap-4">
      <aside className="hidden w-56 shrink-0 md:block">
        <nav className="sticky top-20 flex flex-col gap-1">
          {menu.map((m) => (
            <Link key={m.href} href={m.href} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${pathname === m.href ? "bg-primary-light font-semibold text-primary-dark" : "text-foreground hover:bg-primary/10"}`}>
              <span>{m.icon}</span>
              {m.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1">
        <ContractsList />
      </div>
    </div>
  );
}
