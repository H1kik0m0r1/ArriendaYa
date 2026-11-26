"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { getDataSourceMode } from "@/lib/config/env";
import {
  evaluatePasswordStrength,
  registerSchema,
  type RegisterFormValues,
} from "@/modules/auth/schemas";
import { registerAccount } from "@/modules/auth/service";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

export default function RegisterPage() {
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const router = useRouter();
  const toast = useToast();
  const mode = getDataSourceMode();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
    defaultValues: { fullName: "", phone: "", email: "", password: "", terms: false },
  });

  const passwordVal = useWatch({ control, name: "password" }) || "";
  const strength = evaluatePasswordStrength(passwordVal);

  const fullNameField = register("fullName");
  const phoneField = register("phone");

  const onSubmit = async (values: RegisterFormValues) => {
    setError("");
    setInfo("");
    const res = await registerAccount(values);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.data.requiresEmailConfirmation) {
      setInfo("Cuenta creada. Revisa tu correo electrónico para confirmar tu dirección antes de iniciar sesión.");
      toast.show("Revisa tu correo para validar la cuenta", "info");
      return;
    }
    toast.show("Cuenta creada correctamente", "success");
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-md py-2 sm:py-6">
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-bold text-primary-dark">Crear cuenta</h1>
          <p className="mt-1 text-sm text-muted">Regístrate como inquilino para empezar</p>
        </CardHeader>
        <CardBody className="space-y-4">
          {mode === "unconfigured" && (
            <Alert variant="error">
              Supabase no está configurado. Define las variables de entorno en `.env.local` para registrar cuentas.
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            <Input
              label="Nombre completo"
              placeholder="Solo letras"
              error={errors.fullName?.message}
              success={Boolean(touchedFields.fullName && !errors.fullName)}
              required
              {...fullNameField}
              onChange={(e) => {
                const clean = e.target.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ\s]/g, "");
                setValue("fullName", clean, { shouldValidate: Boolean(touchedFields.fullName) });
              }}
            />
            <Input
              label="Teléfono celular"
              placeholder="10 dígitos"
              maxLength={10}
              error={errors.phone?.message}
              success={Boolean(touchedFields.phone && !errors.phone)}
              required
              {...phoneField}
              onChange={(e) => {
                const clean = e.target.value.replace(/\D/g, "").slice(0, 10);
                setValue("phone", clean, { shouldValidate: Boolean(touchedFields.phone) });
              }}
            />
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
              placeholder="Mínimo 8 caracteres, mayúscula, minúscula y número"
              error={errors.password?.message}
              success={Boolean(touchedFields.password && !errors.password)}
              required
              {...register("password")}
            />
            {passwordVal && (
              <p className={`text-xs font-medium ${strength.color}`}>
                Nivel de seguridad: {strength.label}
              </p>
            )}
            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input type="checkbox" className="mt-1" {...register("terms")} />
              <span>
                Acepto los{" "}
                <Link href="/terms" className="font-medium text-primary hover:underline">
                  términos y condiciones
                </Link>
                .
              </span>
            </label>
            {errors.terms?.message && <p className="text-xs text-red-600">{errors.terms.message}</p>}
            {error && <Alert variant="error">{error}</Alert>}
            {info && <Alert variant="success">{info}</Alert>}
            <Button type="submit" loading={isSubmitting} className="w-full">
              Registrarse
            </Button>
          </form>

          <p className="border-t border-border pt-4 text-center text-sm text-muted">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Entrar
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
