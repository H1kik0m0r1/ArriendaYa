"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LayoutDashboard, Star, ClipboardList, FileText, FileSignature, Calendar, MessageSquare, Bell, Wallet, Settings, HelpCircle } from "lucide-react";

const menu = [
  { href: "/tenant", label: "Panel principal", Icon: LayoutDashboard },
  { href: "/tenant/saved", label: "Mis favoritos", Icon: Star },
  { href: "/tenant/requests", label: "Mis solicitudes", Icon: ClipboardList },
  { href: "/tenant/documents", label: "Mis documentos", Icon: FileText },
  { href: "/tenant/contracts", label: "Mis contratos", Icon: FileSignature },
  { href: "/tenant/calendar", label: "Calendario y visitas", Icon: Calendar },
  { href: "/owner/messages", label: "Mensajes", Icon: MessageSquare },
  { href: "/notifications", label: "Notificaciones", Icon: Bell },
  { href: "/tenant/finances", label: "Mis pagos y gastos", Icon: Wallet },
  { href: "/settings", label: "Configuración", Icon: Settings },
  { href: "/tenant/help", label: "Ayuda y soporte", Icon: HelpCircle },
];

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (profile?.role !== "tenant") router.push("/");
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
