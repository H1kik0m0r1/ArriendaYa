"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Calendar,
  ClipboardList,
  FileSignature,
  FileText,
  HelpCircle,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  Shield,
  Star,
  User,
  Wallet,
  X,
} from "lucide-react";
import { isDemoMode } from "@/lib/config/env";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/types";
import { logoutSession } from "@/modules/auth/service";

interface MenuItem {
  href: string;
  label: string;
  icon: string;
}

const OWNER_MENU: MenuItem[] = [
  { href: "/owner/dashboard", label: "Panel de control", icon: "dashboard" },
  { href: "/owner/properties", label: "Mis propiedades", icon: "home" },
  { href: "/owner/requests", label: "Solicitudes recibidas", icon: "clipboard" },
  { href: "/owner/documents", label: "Documentación", icon: "file" },
  { href: "/owner/contracts", label: "Contratos", icon: "signature" },
  { href: "/owner/calendar", label: "Calendario", icon: "calendar" },
  { href: "/owner/messages", label: "Mensajes", icon: "message" },
  { href: "/notifications", label: "Notificaciones", icon: "bell" },
  { href: "/owner/stats", label: "Estadísticas", icon: "chart" },
  { href: "/owner/reports", label: "Reportes", icon: "alert" },
  { href: "/owner/finances", label: "Finanzas", icon: "wallet" },
  { href: "/settings", label: "Configuración", icon: "settings" },
];

const TENANT_MENU: MenuItem[] = [
  { href: "/tenant/dashboard", label: "Panel principal", icon: "dashboard" },
  { href: "/tenant/saved", label: "Mis favoritos", icon: "star" },
  { href: "/tenant/requests", label: "Mis solicitudes", icon: "clipboard" },
  { href: "/tenant/documents", label: "Mis documentos", icon: "file" },
  { href: "/tenant/contracts", label: "Mis contratos", icon: "signature" },
  { href: "/tenant/calendar", label: "Calendario y visitas", icon: "calendar" },
  { href: "/tenant/messages", label: "Mensajes", icon: "message" },
  { href: "/notifications", label: "Notificaciones", icon: "bell" },
  { href: "/tenant/finances", label: "Mis pagos y gastos", icon: "wallet" },
  { href: "/settings", label: "Configuración", icon: "settings" },
  { href: "/tenant/help", label: "Ayuda y soporte", icon: "help" },
];

const ADMIN_MENU: MenuItem[] = [
  { href: "/admin", label: "Resumen general", icon: "dashboard" },
  { href: "/admin/users", label: "Usuarios y accesos", icon: "user" },
  { href: "/admin/properties", label: "Inmuebles", icon: "home" },
  { href: "/admin/reports", label: "Reportes y soporte", icon: "alert" },
  { href: "/admin/permissions", label: "Roles y permisos", icon: "shield" },
  { href: "/admin/audit", label: "Auditoría", icon: "clipboard" },
  { href: "/profile", label: "Mi perfil", icon: "user" },
  { href: "/notifications", label: "Notificaciones", icon: "bell" },
  { href: "/settings", label: "Configuración", icon: "settings" },
];

const ROLE_LABELS: Record<Role, string> = {
  owner: "Propietario",
  tenant: "Inquilino",
  admin: "Administrador",
};

function MenuIcon({ name }: { name: string }) {
  const cls = "h-4 w-4 shrink-0";
  switch (name) {
    case "dashboard":
      return <LayoutDashboard className={cls} />;
    case "home":
      return <Home className={cls} />;
    case "clipboard":
      return <ClipboardList className={cls} />;
    case "file":
      return <FileText className={cls} />;
    case "signature":
      return <FileSignature className={cls} />;
    case "calendar":
      return <Calendar className={cls} />;
    case "message":
      return <MessageSquare className={cls} />;
    case "bell":
      return <Bell className={cls} />;
    case "chart":
      return <BarChart3 className={cls} />;
    case "alert":
      return <AlertTriangle className={cls} />;
    case "wallet":
      return <Wallet className={cls} />;
    case "star":
      return <Star className={cls} />;
    case "help":
      return <HelpCircle className={cls} />;
    case "shield":
      return <Shield className={cls} />;
    case "user":
      return <User className={cls} />;
    default:
      return <Settings className={cls} />;
  }
}

export default function RoleSidebarShell({
  requiredRole,
  children,
}: {
  requiredRole: Role;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const menu =
    requiredRole === "owner" ? OWNER_MENU : requiredRole === "admin" ? ADMIN_MENU : TENANT_MENU;

  useEffect(() => {
    if (!isDemoMode()) return;
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profile?.role !== requiredRole) {
        router.push("/");
      }
    })();
  }, [requiredRole, router]);

  const isActive = (href: string) => {
    if (pathname === href) return true;
    if (href === "/tenant/dashboard" && pathname === "/tenant") return true;
    if (href !== "/owner/dashboard" && href !== "/tenant/dashboard" && href !== "/admin") {
      return pathname.startsWith(`${href}/`);
    }
    return false;
  };

  const handleLogout = async () => {
    setMobileOpen(false);
    await logoutSession();
    router.push("/");
    router.refresh();
  };

  const renderLinks = (onNavigate?: () => void) => (
    <div className="flex flex-col gap-1">
      {menu.map((m) => {
        const active = isActive(m.href);
        return (
          <Link
            key={m.href}
            href={m.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-xl border-l-4 px-3 py-2 text-sm transition-colors ${
              active
                ? "border-primary bg-primary-light/70 font-semibold text-primary-dark"
                : "border-transparent text-muted hover:bg-primary/10 hover:text-foreground"
            }`}
          >
            <MenuIcon name={m.icon} />
            <span className="truncate">{m.label}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => void handleLogout()}
        className="mt-3 flex items-center gap-2.5 rounded-xl border-l-4 border-transparent px-3 py-2 text-left text-sm text-red-700 hover:bg-red-500/10 dark:text-red-400"
      >
        <LogOut className="h-4 w-4 shrink-0" />
        <span>Cerrar sesión</span>
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 md:flex-row md:gap-6">
      <div className="flex items-center justify-between rounded-xl border border-border bg-menu-bg px-3 py-2 md:hidden">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">
          Menú · {ROLE_LABELS[requiredRole]}
        </span>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-expanded={mobileOpen}
          aria-label="Abrir menú del panel"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-primary/10"
        >
          <Menu className="h-4 w-4" />
          Secciones
        </button>
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 flex bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Menú de ${ROLE_LABELS[requiredRole]}`}
            className="h-full w-72 max-w-[85vw] overflow-y-auto bg-menu-bg p-4 text-foreground shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <span className="font-bold text-primary">Panel · {ROLE_LABELS[requiredRole]}</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Cerrar menú"
                className="rounded-lg p-1 text-muted hover:bg-surface-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav aria-label="Navegación móvil de perfil">
              {renderLinks(() => setMobileOpen(false))}
            </nav>
          </div>
        </div>
      )}

      <aside className="hidden w-60 shrink-0 md:block">
        <div className="sticky top-20 rounded-2xl border border-border bg-menu-bg p-3 shadow-xs">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted">
            {ROLE_LABELS[requiredRole]}
          </p>
          <nav aria-label={`Navegación de ${ROLE_LABELS[requiredRole]}`}>
            {renderLinks()}
          </nav>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
