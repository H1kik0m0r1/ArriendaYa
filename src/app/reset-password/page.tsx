"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, type ResetPasswordFormValues } from "@/modules/auth/schemas";
import { updateUserPassword } from "@/modules/auth/service";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

export default function ResetPasswordPage() {
  const [error, setError] = useState("");
  const router = useRouter();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onTouched",
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: ResetPasswordFormValues) => {
    setError("");
    const res = await updateUserPassword(values);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.show("Contraseña actualizada correctamente", "success");
    router.push("/login");
  };

  return (
    <div className="mx-auto max-w-md py-2 sm:py-6">
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-bold text-primary-dark">Nueva contraseña</h1>
          <p className="mt-1 text-sm text-muted">Define una contraseña segura para tu cuenta.</p>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            <Input
              label="Nueva contraseña"
              type="password"
              showPasswordToggle
              placeholder="Mínimo 8 caracteres, mayúscula, minúscula y número"
              error={errors.password?.message}
              required
              {...register("password")}
            />
            <Input
              label="Confirmar contraseña"
              type="password"
              showPasswordToggle
              error={errors.confirmPassword?.message}
              required
              {...register("confirmPassword")}
            />
            {error && <Alert variant="error">{error}</Alert>}
            <Button type="submit" loading={isSubmitting} className="w-full">
              Actualizar contraseña
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
