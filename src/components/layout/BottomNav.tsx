"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Building2,
  ClipboardList,
  Home,
  LayoutDashboard,
  LogIn,
  MessageSquare,
  Shield,
  Star,
  User,
  UserPlus,
} from "lucide-react";
import { useSessionProfile } from "@/modules/auth/useSessionProfile";

interface NavItem {
  href: string;
  label: string;
  icon: "home" | "dashboard" | "building" | "star" | "requests" | "messages" | "bell" | "shield" | "user" | "login" | "register";
}

const GUEST_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: "home" },
  { href: "/properties", label: "Explorar", icon: "building" },
  { href: "/login", label: "Entrar", icon: "login" },
  { href: "/register", label: "Registro", icon: "register" },
];

const TENANT_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: "home" },
  { href: "/tenant/saved", label: "Favoritos", icon: "star" },
  { href: "/tenant/requests", label: "Solicitudes", icon: "requests" },
  { href: "/tenant/messages", label: "Mensajes", icon: "messages" },
  { href: "/profile", label: "Perfil", icon: "user" },
];

const OWNER_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: "home" },
  { href: "/owner/dashboard", label: "Panel", icon: "dashboard" },
  { href: "/owner/properties", label: "Inmuebles", icon: "building" },
  { href: "/owner/messages", label: "Mensajes", icon: "messages" },
  { href: "/profile", label: "Perfil", icon: "user" },
];

const ADMIN_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: "home" },
  { href: "/admin", label: "Admin", icon: "shield" },
  { href: "/notifications", label: "Alertas", icon: "bell" },
  { href: "/profile", label: "Perfil", icon: "user" },
];

function NavIcon({ icon }: { icon: NavItem["icon"] }) {
  const cls = "h-4 w-4";
  switch (icon) {
    case "home":
      return <Home className={cls} />;
    case "dashboard":
      return <LayoutDashboard className={cls} />;
    case "building":
      return <Building2 className={cls} />;
    case "star":
      return <Star className={cls} />;
    case "requests":
      return <ClipboardList className={cls} />;
    case "messages":
      return <MessageSquare className={cls} />;
    case "bell":
      return <Bell className={cls} />;
    case "shield":
      return <Shield className={cls} />;
    case "login":
      return <LogIn className={cls} />;
    case "register":
      return <UserPlus className={cls} />;
    default:
      return <User className={cls} />;
  }
}

export default function BottomNav() {
  const pathname = usePathname();
  const { profile } = useSessionProfile();

  const items =
    profile?.role === "owner"
      ? OWNER_ITEMS
      : profile?.role === "admin"
        ? ADMIN_ITEMS
        : profile?.role === "tenant"
          ? TENANT_ITEMS
          : GUEST_ITEMS;

  return (
    <nav
      aria-label="Navegación rápida móvil"
      className="fixed bottom-0 left-0 right-0 z-40 flex justify-around border-t border-border bg-menu-bg/95 py-2 backdrop-blur md:hidden"
    >
      {items.map((it) => {
        const active = pathname === it.href;
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 text-[11px] font-medium ${
              active ? "text-primary" : "text-muted hover:text-foreground"
            }`}
          >
            <NavIcon icon={it.icon} />
            <span className="truncate">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
