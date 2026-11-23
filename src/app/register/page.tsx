"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isOwnerEmail } from "@/lib/constants";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import Input from "@/components/ui/Input";

const OWNER_PASSWORD = "Propietario1234";

function onlyLetters(v: string) {
  return /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]*$/.test(v);
}
function onlyDigits(v: string) {
  return /^\d*$/.test(v);
}

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const toast = useToast();

  const owner = isOwnerEmail(email);

  const nameError = useMemo(() => {
    if (!fullName) return "Requerido";
    if (!onlyLetters(fullName)) return "Solo letras";
    return "";
  }, [fullName]);
  const phoneError = useMemo(() => {
    if (!phone) return "Requerido";
    if (!onlyDigits(phone)) return "Solo números";
    if (phone.length > 10) return "Máximo 10 dígitos";
    if (phone.length < 10) return "Mínimo 10 dígitos";
    return "";
  }, [phone]);
  const emailError = useMemo(() => {
    if (!email) return "Requerido";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Formato inválido (ej: example@gmail.com)";
    return "";
  }, [email]);
  const passwordError = useMemo(() => {
    if (!password) return "Requerido";
    if (owner && password !== OWNER_PASSWORD) return "Contraseña incorrecta";
    if (!owner && password.length < 6) return "Mínimo 6 caracteres";
    return "";
  }, [password, owner]);

  const strength = useMemo(() => {
    if (!password) return { level: 0, label: "", color: "" };
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (score <= 1) return { level: 1, label: "Bajo", color: "text-red-600" };
    if (score === 2) return { level: 2, label: "Medio", color: "text-yellow-600" };
    return { level: 3, label: "Alto", color: "text-green-600" };
  }, [password]);
  const termsError = terms ? "" : "Debes aceptar los términos";

  const mark = (f: string) => setTouched((t) => ({ ...t, [f]: true }));

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ fullName: true, phone: true, email: true, password: true, terms: true });
    if (nameError || phoneError || emailError || passwordError || termsError) {
      setError("Corrige los errores antes de continuar.");
      return;
    }
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone, accepted_terms: true },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) { setError("Acceso fallido"); setLoading(false); return; }
    toast.show("Cuenta creada correctamente", "success");
    router.push("/login");
    router.refresh();
  };


  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-bold text-primary">Crear cuenta</h1>
      <form onSubmit={handleRegister} className="flex flex-col gap-4">
        <Input
          label="Nombre completo"
          value={fullName}
          onChange={(e) => { if (onlyLetters(e.target.value)) setFullName(e.target.value); }}
          onBlur={() => mark("fullName")}
          error={touched.fullName ? nameError : ""}
          success={touched.fullName && !nameError}
          placeholder="Solo letras"
          required
        />
        <Input
          label="Teléfono celular"
          value={phone}
          onChange={(e) => { const v = e.target.value; if (onlyDigits(v) && v.length <= 10) setPhone(v); }}
          onBlur={() => mark("phone")}
          error={touched.phone ? phoneError : ""}
          success={touched.phone && !phoneError}
          placeholder="10 dígitos"
          maxLength={10}
          required
        />
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
          placeholder="Mínimo 6 caracteres"
          required
        />
        {!owner && password && (
          <p className={`text-xs font-medium ${strength.color}`}>
            Nivel de seguridad: {strength.label}
          </p>
        )}
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={terms} onChange={(e) => { setTerms(e.target.checked); mark("terms"); }} className="mt-1" />
          <span>Acepto los <Link href="/terms" className="text-primary hover:underline">términos y condiciones</Link>.</span>
        </label>
        {touched.terms && termsError && <p className="text-xs text-red-600">{termsError}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" loading={loading}>Registrarse</Button>
      </form>

      <p className="mt-4 text-center text-sm">
        ¿Ya tienes cuenta? <Link href="/login" className="text-primary hover:underline">Entrar</Link>
      </p>
    </div>
  );
}
