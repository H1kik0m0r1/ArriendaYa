"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function TenantDocumentsPage() {
  const supabase = createClient();
  const [docs, setDocs] = useState<any[]>([]);
  const [personal, setPersonal] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState("Cédula");

  useEffect(() => {
    const p = JSON.parse(localStorage.getItem("arriendaya_personal_docs") || "[]");
    setPersonal(p);
  }, []);

  const uploadPersonal = async () => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const arr = JSON.parse(localStorage.getItem("arriendaya_personal_docs") || "[]");
      arr.push({ id: Date.now().toString(), type, name: file.name, data: reader.result, uploaded_at: new Date().toISOString() });
      localStorage.setItem("arriendaya_personal_docs", JSON.stringify(arr));
      setPersonal(arr);
      setFile(null);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-primary">Mis documentos</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 font-semibold">Biblioteca personal</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {personal.map((d) => (
              <li key={d.id} className="flex items-center justify-between">
                <span>{d.type} — {d.name}</span>
                <button onClick={() => {
                  const arr = personal.filter((x) => x.id !== d.id);
                  localStorage.setItem("arriendaya_personal_docs", JSON.stringify(arr));
                  setPersonal(arr);
                }} className="text-red-600 text-xs">Eliminar</button>
              </li>
            ))}
            {personal.length === 0 && <li className="text-muted">Sin documentos.</li>}
          </ul>
          <div className="mt-3 flex flex-col gap-2">
            <Input label="Tipo" value={type} onChange={(e) => setType(e.target.value)} />
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm" />
            <Button size="sm" onClick={uploadPersonal} disabled={!file}>Subir</Button>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 font-semibold">Checklist documental</h2>
          <p className="text-sm text-muted">Los requisitos se muestran en cada solicitud. Consulta el detalle de tu solicitud para ver el checklist y el porcentaje de cumplimiento.</p>
        </div>
      </div>
    </div>
  );
}
