"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileCheck2, FolderOpen, Trash2 } from "lucide-react";
import {
  addPersonalDocument,
  deletePersonalDocument,
  loadPersonalDocuments,
} from "@/modules/rental-requests/personal-docs";
import { personalDocSchema, type PersonalDocFormValues } from "@/modules/rental-requests/schemas";
import type { PersonalDocumentItem } from "@/modules/rental-requests/types";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import ConfirmModal from "@/components/ui/ConfirmModal";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import PageHeader from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";

export default function TenantDocumentsPage() {
  const [personal, setPersonal] = useState<PersonalDocumentItem[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PersonalDocumentItem | null>(null);
  const toast = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PersonalDocFormValues>({
    resolver: zodResolver(personalDocSchema),
    mode: "onTouched",
    defaultValues: { type: "Cédula" },
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setPersonal(loadPersonalDocuments());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const onUpload = async (values: PersonalDocFormValues) => {
    if (!file) return;
    const res = await addPersonalDocument(values.type, file);
    if (!res.ok) {
      toast.show(res.error, "error");
      return;
    }
    setPersonal(res.data);
    setFile(null);
    toast.show("Documento guardado en tu biblioteca", "success");
  };

  const confirmRemove = () => {
    if (!pendingDelete) return;
    setPersonal(deletePersonalDocument(pendingDelete.id));
    toast.show("Documento eliminado", "info");
    setPendingDelete(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mis documentos"
        subtitle="Guarda copias frecuentes en tu biblioteca personal y consulta el estado de tu checklist."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 className="font-semibold text-primary-dark">Biblioteca personal</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            {personal.length === 0 ? (
              <EmptyState
                title="Biblioteca vacía"
                message="Sube tu cédula o soportes frecuentes para tenerlos a la mano."
              />
            ) : (
              <ul className="divide-y divide-border text-sm">
                {personal.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{d.type}</p>
                      <p className="truncate text-xs text-muted">{d.name}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingDelete(d)}
                      aria-label={`Eliminar ${d.type}`}
                      className="shrink-0 text-red-700 hover:bg-red-500/10 dark:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      <span>Eliminar</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={handleSubmit(onUpload)} className="flex flex-col gap-3 border-t border-border pt-4" noValidate>
              <Input label="Tipo de documento" error={errors.type?.message} {...register("type")} />
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Archivo (PDF, JPG o PNG)
                </label>
                <input
                  type="file"
                  accept=".pdf,image/jpeg,image/png"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary-light file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-dark hover:file:bg-primary-light/80"
                />
              </div>
              <Button type="submit" size="sm" loading={isSubmitting} disabled={!file}>
                Subir documento
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 className="font-semibold text-primary-dark">Checklist documental</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            <Alert variant="info" title="Requisitos por solicitud">
              Los documentos exigidos dependen del tipo de propiedad (vivienda o recreativo), tu perfil laboral y si cuentas con codeudor.
            </Alert>
            <p className="text-sm text-muted">
              Consulta el detalle de cada solicitud en <strong>Mis solicitudes</strong> para ver el checklist completo y el estado de revisión del propietario.
            </p>
          </CardBody>
        </Card>
      </div>

      <ConfirmModal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmRemove}
        title="Eliminar documento"
        message={
          pendingDelete
            ? `¿Seguro que deseas eliminar "${pendingDelete.type} — ${pendingDelete.name}" de tu biblioteca personal?`
            : ""
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
      />
    </div>
  );
}
