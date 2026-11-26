"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
  User,
} from "lucide-react";
import { logoutSession, resolveHomeRouteForRole } from "@/modules/auth/service";
import { useSessionProfile } from "@/modules/auth/useSessionProfile";
import { countUnreadNotifications } from "@/modules/notifications/repository";
import {
  getLargeTextPreference,
  getThemePreference,
  setLargeTextPreference,
  setThemePreference,
  subscribeAccessibilityPreferences,
  syncAllAccessibilityPreferences,
  type ThemePreference,
} from "@/modules/shared/preferences";
import { Badge } from "@/components/ui/Badge";

const ROLE_TEXT: Record<string, string> = {
  owner: "Propietario",
  tenant: "Inquilino",
  admin: "Admin",
};

const THEME_LABELS: Record<ThemePreference, string> = {
  system: "Tema del sistema",
  light: "Modo claro",
  dark: "Modo oscuro",
};

export default function Header() {
  const { profile, loading, clearProfile } = useSessionProfile();
  const [large, setLarge] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [unreadCount, setUnreadCount] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    syncAllAccessibilityPreferences();
    const syncState = () => {
      setLarge(getLargeTextPreference());
      setTheme(getThemePreference());
    };
    const timer = setTimeout(syncState, 0);
    const unsub = subscribeAccessibilityPreferences(syncState);
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const refreshCount = async () => {
      if (!profile?.id) {
        if (active) setUnreadCount(0);
        return;
      }
      const c = await countUnreadNotifications(profile.id).catch(() => 0);
      if (active) setUnreadCount(c);
    };
    void refreshCount();
    const interval = setInterval(() => void refreshCount(), 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [profile?.id]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUserMenuOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [userMenuOpen]);

  const toggleLarge = () => {
    const next = !large;
    setLarge(next);
    setLargeTextPreference(next);
  };

  const cycleTheme = () => {
    const next: ThemePreference =
      theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setTheme(next);
    setThemePreference(next);
  };

  const logout = async () => {
    setUserMenuOpen(false);
    await logoutSession();
    clearProfile();
    setUnreadCount(0);
    router.push("/");
    router.refresh();
  };

  const panelHref = profile ? resolveHomeRouteForRole(profile.role) : "/";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-menu-bg/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:px-4">
        <Link href="/" className="shrink-0 text-lg font-bold tracking-tight text-primary sm:text-xl">
          ArriendaYa
        </Link>
        <nav aria-label="Navegación principal" className="hidden items-center gap-5 md:flex">
          <Link href="/" className="text-sm font-medium text-foreground hover:text-primary">
            Inicio
          </Link>
          {profile?.role === "owner" && (
            <>
              <Link href="/owner/dashboard" className="text-sm font-medium text-foreground hover:text-primary">
                Mi panel
              </Link>
              <Link href="/owner/properties" className="text-sm font-medium text-foreground hover:text-primary">
                Mis propiedades
              </Link>
            </>
          )}
          {profile?.role === "tenant" && (
            <>
              <Link href="/tenant/dashboard" className="text-sm font-medium text-foreground hover:text-primary">
                Mi panel
              </Link>
              <Link href="/tenant/saved" className="text-sm font-medium text-foreground hover:text-primary">
                Favoritos
              </Link>
            </>
          )}
          {profile?.role === "admin" && (
            <Link href="/admin" className="text-sm font-medium text-foreground hover:text-primary">
              Administración
            </Link>
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={cycleTheme}
            aria-label={`Cambiar apariencia (${THEME_LABELS[theme]})`}
            title={THEME_LABELS[theme]}
            className="rounded-lg border border-border p-1.5 text-foreground hover:bg-primary/10"
          >
            {theme === "dark" ? (
              <Moon className="h-4 w-4" aria-hidden="true" />
            ) : theme === "light" ? (
              <Sun className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Monitor className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={toggleLarge}
            aria-pressed={large}
            aria-label={large ? "Restaurar tamaño de letra normal" : "Agrandar letras"}
            className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-primary/10 sm:px-2.5 sm:py-1.5"
            title="Cambiar tamaño de letra"
          >
            Aa{large ? "+" : ""}
          </button>

          {loading ? null : profile ? (
            <>
              <Link
                href="/notifications"
                aria-label={`Notificaciones (${unreadCount} sin leer)`}
                className="relative rounded-lg border border-border p-1.5 text-foreground hover:bg-primary/10"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary-btn px-1 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>

              <div ref={menuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 rounded-xl border border-border bg-menu-bg px-2.5 py-1.5 text-sm font-medium text-foreground hover:bg-primary/10"
                >
                  <User className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span className="max-w-[110px] truncate sm:max-w-[160px]">
                    {profile.full_name || "Perfil"}
                  </span>
                  <Badge color="green" className="hidden sm:inline-flex">
                    {ROLE_TEXT[profile.role] || profile.role}
                  </Badge>
                  <ChevronDown className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                </button>

                {userMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl border border-border bg-menu-bg py-1.5 text-foreground shadow-xl"
                  >
                    <Link
                      role="menuitem"
                      href={panelHref}
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-primary/10"
                    >
                      <LayoutDashboard className="h-4 w-4 text-primary" />
                      Mi panel
                    </Link>
                    <Link
                      role="menuitem"
                      href="/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-primary/10"
                    >
                      <User className="h-4 w-4 text-primary" />
                      Mi perfil
                    </Link>
                    <Link
                      role="menuitem"
                      href="/notifications"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center justify-between gap-2 px-4 py-2 text-sm text-foreground hover:bg-primary/10"
                    >
                      <span className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-primary" />
                        Notificaciones
                      </span>
                      {unreadCount > 0 && <Badge color="green">{unreadCount}</Badge>}
                    </Link>
                    <Link
                      role="menuitem"
                      href="/settings"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-primary/10"
                    >
                      <Settings className="h-4 w-4 text-primary" />
                      Configuración
                    </Link>
                    <div className="my-1 border-t border-border" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void logout()}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-700 hover:bg-red-500/10 dark:text-red-400"
                    >
                      <LogOut className="h-4 w-4" />
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                href="/settings"
                aria-label="Configuración"
                className="rounded-lg p-1.5 text-muted hover:bg-primary/10 hover:text-primary"
              >
                <Settings className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex min-h-[34px] items-center justify-center rounded-lg px-2 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-primary/10 sm:px-3 sm:text-sm"
              >
                Entrar
              </Link>
              <Link
                href="/register"
                className="inline-flex min-h-[34px] items-center justify-center rounded-lg bg-primary-btn px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-btn-hover sm:px-3 sm:text-sm"
              >
                Registrarse
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
