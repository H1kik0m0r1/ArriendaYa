"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { getDataSourceMode } from "@/lib/config/env";
import { loginSchema, safeRedirectPath, type LoginFormValues } from "@/modules/auth/schemas";
import { loginWithPassword } from "@/modules/auth/service";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Input from "@/components/ui/Input";

function LoginForm() {
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = getDataSourceMode();

  const nextParam = safeRedirectPath(searchParams.get("next"), "");
  const queryError = searchParams.get("error");

  const {
    register,
    handleSubmit,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setError("");
    const res = await loginWithPassword(values, nextParam);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push(res.data.redirectTo);
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-md py-2 sm:py-6">
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-bold text-primary-dark">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-muted">Ingresa a tu cuenta de ArriendaYa</p>
        </CardHeader>
        <CardBody className="space-y-4">
          {mode === "demo" && (
            <Alert variant="info">
              <span>
                Entorno de demostración activo (<code className="break-all">NEXT_PUBLIC_DEMO_MODE=true</code>). Los datos se almacenan localmente en este navegador.
              </span>
            </Alert>
          )}
          {(mode === "unconfigured" || queryError === "config") && (
            <Alert variant="error">
              Supabase no está configurado. Define las variables de entorno en `.env.local` para iniciar sesión.
            </Alert>
          )}
          {queryError === "auth_callback" && (
            <Alert variant="error">
              El enlace de verificación o recuperación es inválido o expiró.
            </Alert>
          )}
          {queryError === "profile" && (
            <Alert variant="error">
              No se pudo verificar el perfil de tu cuenta. Inicia sesión nuevamente o contacta al administrador.
            </Alert>
          )}
          {queryError === "suspended" && (
            <Alert variant="error">
              Tu cuenta se encuentra suspendida. Contacta al administrador si necesitas más información.
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            <Input
              label="Correo electrónico"
              type="email"
              placeholder="usuario@correo.com"
              error={errors.email?.message}
              success={Boolean(touchedFields.email && !errors.email)}
              required
              {...register("email")}
            />
            <Input
              label="Contraseña"
              type="password"
              showPasswordToggle
              error={errors.password?.message}
              success={Boolean(touchedFields.password && !errors.password)}
              required
              {...register("password")}
            />

            {error && <Alert variant="error">{error}</Alert>}
            <Button type="submit" loading={isSubmitting} className="w-full">
              Entrar
            </Button>
          </form>

          <div className="flex flex-col gap-2 border-t border-border pt-4 text-center text-sm">
            <Link href="/forgot-password" className="text-primary hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
            <p className="text-muted">
              ¿No tienes cuenta?{" "}
              <Link href="/register" className="font-medium text-primary hover:underline">
                Regístrate
              </Link>
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md py-6">
          <div className="h-80 animate-pulse rounded-xl border border-border bg-surface-secondary" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
