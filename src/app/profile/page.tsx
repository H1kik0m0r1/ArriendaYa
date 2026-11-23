"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function ProfilePage() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }: { data: any }) => {
      if (!data.user) return;
      setEmail(data.user.email || "");
      const { data: p }: { data: any } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
      if (p) {
        setFullName(p.full_name || "");
        setPhone(p.phone || "");
        setRole(p.role);
      }
    });
  }, [supabase]);

  const save = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ full_name: fullName, phone }).eq("id", user.id);
    setMsg(error ? error.message : "Perfil actualizado.");
    setSaving(false);
  };

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-bold text-primary">Mi perfil</h1>
      <div className="flex flex-col gap-4">
        <Input label="Correo" value={email} disabled />
        <Input label="Rol" value={role} disabled />
        <Input label="Nombre completo" value={fullName} onChange={(e) => { if (/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]*$/.test(e.target.value)) setFullName(e.target.value); }} />
        <Input label="Teléfono celular" value={phone} onChange={(e) => { const v = e.target.value; if (/^\d*$/.test(v) && v.length <= 10) setPhone(v); }} maxLength={10} />
        <Button onClick={save} loading={saving}>Guardar cambios</Button>
        {msg && <p className="text-sm text-muted">{msg}</p>}
      </div>
    </div>
  );
}
