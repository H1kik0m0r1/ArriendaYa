"use client";
import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@/modules/auth/schemas";
import { requestPasswordReset } from "@/modules/auth/service";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Input from "@/components/ui/Input";

export default function ForgotPasswordPage() {
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onTouched",
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setError("");
    const res = await requestPasswordReset(values);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSent(true);
  };

  return (
    <div className="mx-auto max-w-md py-2 sm:py-6">
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-bold text-primary-dark">Recuperar contraseña</h1>
          <p className="mt-1 text-sm text-muted">
            Te enviaremos instrucciones para restablecer el acceso a tu cuenta.
          </p>
        </CardHeader>
        <CardBody>
          {sent ? (
            <div className="space-y-4">
              <Alert variant="success" title="Revisa tu correo">
                Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.
              </Alert>
              <Link
                href="/login"
                className="inline-flex min-h-[40px] w-full items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-primary hover:bg-primary-light/60"
              >
                Volver a iniciar sesión
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
              <Input
                label="Correo electrónico"
                type="email"
                placeholder="usuario@correo.com"
                error={errors.email?.message}
                required
                {...register("email")}
              />
              {error && <Alert variant="error">{error}</Alert>}
              <Button type="submit" loading={isSubmitting} className="w-full">
                Enviar enlace de recuperación
              </Button>
              <Link href="/login" className="text-center text-sm text-primary hover:underline">
                Volver a iniciar sesión
              </Link>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
