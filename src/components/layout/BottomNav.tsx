"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Inicio", icon: "🏠" },
  { href: "/tenant/saved", label: "Favoritos", icon: "⭐" },
  { href: "/tenant/requests", label: "Solicitudes", icon: "📋" },
  { href: "/owner/messages", label: "Mensajes", icon: "💬" },
  { href: "/profile", label: "Perfil", icon: "👤" },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex justify-around border-t border-border bg-white py-2 md:hidden">
      {items.map((it) => (
        <Link key={it.href} href={it.href} className={`flex flex-col items-center text-xs ${pathname === it.href ? "text-primary" : "text-muted"}`}>
          <span className="text-lg">{it.icon}</span>
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
