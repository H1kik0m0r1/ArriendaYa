"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LayoutDashboard, Home, ClipboardList, FileText, FileSignature, Calendar, MessageSquare, Bell, BarChart3, AlertTriangle, Wallet, Settings } from "lucide-react";

const menu = [
  { href: "/owner", label: "Panel de control", Icon: LayoutDashboard },
  { href: "/owner/properties", label: "Mis propiedades", Icon: Home },
  { href: "/owner/requests", label: "Solicitudes recibidas", Icon: ClipboardList },
  { href: "/owner/documents", label: "Documentación", Icon: FileText },
  { href: "/owner/contracts", label: "Contratos", Icon: FileSignature },
  { href: "/owner/calendar", label: "Calendario", Icon: Calendar },
  { href: "/owner/messages", label: "Mensajes", Icon: MessageSquare },
  { href: "/notifications", label: "Notificaciones", Icon: Bell },
  { href: "/owner/stats", label: "Estadísticas", Icon: BarChart3 },
  { href: "/owner/reports", label: "Reportes", Icon: AlertTriangle },
  { href: "/owner/finances", label: "Finanzas", Icon: Wallet },
  { href: "/settings", label: "Configuración", Icon: Settings },
];

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (profile?.role !== "owner") router.push("/");
    })();
  }, [router, supabase]);
  return (
    <div className="flex gap-4">
      <aside className="hidden w-56 shrink-0 md:block">
        <nav className="sticky top-20 flex flex-col gap-1">
          {menu.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className={`flex items-center gap-2 rounded-lg border-l-4 px-3 py-2 text-sm ${pathname === m.href ? "border-primary text-primary font-semibold" : "border-transparent text-gray-600 hover:bg-primary/10"}`}
            >
              <m.Icon className="h-4 w-4" />
              {m.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1">{children}</div>
    </div>
  );
}
