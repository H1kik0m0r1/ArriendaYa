"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isOwnerEmail } from "@/lib/constants";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const mark = (f: string) => setTouched((t) => ({ ...t, [f]: true }));

  const emailError = useMemo(() => {
    if (!email) return "Requerido";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Formato inválido (ej: example@gmail.com)";
    return "";
  }, [email]);
  const passwordError = useMemo(() => {
    if (!password) return "Requerido";
    return "";
  }, [password]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (emailError || passwordError) { setError("Corrige los errores."); return; }
    setLoading(true);
    setError("");
    const owner = isOwnerEmail(email);

    // Auto-provision owner accounts so they can enter without registering
    if (owner && password !== "Propietario1234") {
      setError("La contraseña de propietario debe ser Propietario1234.");
      setLoading(false);
      return;
    }

    let { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error && owner && /invalid login credentials/i.test(error.message)) {
      // create the account on the fly
      const { error: suErr } = await supabase.auth.signUp({
        email,
        password: "Propietario1234",
        options: {
          data: { full_name: "Propietario", phone: "", accepted_terms: true },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (!suErr) {
        const res = await supabase.auth.signInWithPassword({ email, password: "Propietario1234" });
        error = res.error;
      } else {
        error = suErr;
      }
    }

    if (error) { setError("Contraseña incorrecta o acceso fallido"); setLoading(false); return; }
    router.push("/");
    router.refresh();
  };


  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-bold text-primary">Iniciar sesión</h1>
      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <Input
          label="Correo electrónico"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => mark("email")}
          error={touched.email ? emailError : ""}
          success={touched.email && !emailError}
          placeholder="example@gmail.com"
          pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
          required
        />
        <Input
          label="Contraseña"
          type="password"
          showPasswordToggle
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => mark("password")}
          error={touched.password ? passwordError : ""}
          success={touched.password && !passwordError}
          required
        />

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" loading={loading}>Entrar</Button>
      </form>

      <p className="mt-4 text-center text-sm">
        ¿No tienes cuenta? <Link href="/register" className="text-primary hover:underline">Regístrate</Link>
      </p>
    </div>
  );
}
