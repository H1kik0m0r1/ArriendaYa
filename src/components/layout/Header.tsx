"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";

type Profile = { id: string; full_name: string | null; role: "owner" | "tenant" };

export default function Header() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [large, setLarge] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("arriendaya_large_text") === "1";
    setLarge(saved);
    document.documentElement.style.fontSize = saved ? "18px" : "16px";
  }, []);

  const toggleLarge = () => {
    const next = !large;
    setLarge(next);
    localStorage.setItem("arriendaya_large_text", next ? "1" : "0");
    document.documentElement.style.fontSize = next ? "18px" : "16px";
  };
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(async ({ data }: { data: any }) => {
      if (!data.user) {
        if (mounted) { setProfile(null); setLoading(false); }
        return;
      }
      const { data: p } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", data.user.id)
        .single();
      if (mounted) { setProfile(p as Profile | null); setLoading(false); }
    });
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      supabase.auth.getUser().then(async ({ data }: { data: any }) => {
        if (!data.user) { setProfile(null); return; }
        const { data: p } = await supabase.from("profiles").select("id, full_name, role").eq("id", data.user.id).single();
        setProfile(p as Profile | null);
      });
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-xl font-bold text-primary">ArriendaYa</Link>
        <nav className="hidden items-center gap-4 md:flex">
          <Link href="/" className="text-sm hover:text-primary">Inicio</Link>
          {profile?.role === "owner" && (
            <Link href="/owner/properties" className="text-sm hover:text-primary">Mis propiedades</Link>
          )}
          {profile?.role === "tenant" && (
            <Link href="/tenant/saved" className="text-sm hover:text-primary">Guardados</Link>
          )}
        </nav>
        <div className="flex items-center gap-2">
          <button onClick={toggleLarge} className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-primary/10" title="Agrandar letras">
            Aa{large ? "+" : ""}
          </button>
          <Link href="/settings" className="text-sm text-muted hover:text-primary">⚙️</Link>
          {loading ? null : profile ? (
            <div className="relative">
              <button onClick={() => setUserMenuOpen((v) => !v)} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-primary/10">
                <span className="text-sm">{profile.full_name || "Perfil"}</span>
                <span className="text-xs">▾</span>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-44 rounded-xl border border-border bg-white shadow-lg">
                  <Link href="/profile" onClick={() => setUserMenuOpen(false)} className="block px-4 py-2 text-sm hover:bg-primary/10">Perfil</Link>
                  <Link href="/notifications" onClick={() => setUserMenuOpen(false)} className="block px-4 py-2 text-sm hover:bg-primary/10">Notificaciones</Link>
                  <Link href="/settings" onClick={() => setUserMenuOpen(false)} className="block px-4 py-2 text-sm hover:bg-primary/10">Configuración</Link>
                  <button onClick={() => { setUserMenuOpen(false); logout(); }} className="block w-full px-4 py-2 text-left text-sm hover:bg-primary/10">Salir</button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/login"><Button size="sm" variant="ghost">Entrar</Button></Link>
              <Link href="/register"><Button size="sm">Registrarse</Button></Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
