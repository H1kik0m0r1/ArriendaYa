"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, CheckCircle2, Trash2 } from "lucide-react";
import { PRICE_PERIODS, PROPERTY_TYPES, RENTAL_TYPES } from "@/lib/constants";
import { validateFile } from "@/lib/utils";
import { propertyWizardSchema, type PropertyWizardValues } from "@/modules/properties/schemas";
import { MIN_PROPERTY_PHOTOS, publishPropertyFromWizard } from "@/modules/properties/service";
import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import PageHeader from "@/components/ui/PageHeader";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import Wizard from "@/components/ui/Wizard";
import { useToast } from "@/components/ui/Toast";

const MapPicker = dynamic(() => import("@/components/property/MapPicker"), { ssr: false });

export default function NewPropertyWizardPage() {
  const router = useRouter();
  const toast = useToast();
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);

  const previews = useMemo(
    () => photoFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [photoFiles]
  );

  useEffect(() => {
    return () => {
      for (const p of previews) URL.revokeObjectURL(p.url);
    };
  }, [previews]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<PropertyWizardValues>({
    resolver: zodResolver(propertyWizardSchema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      type: PROPERTY_TYPES[0],
      location: "",
      rental_type: "vivienda",
      max_people: "1",
      description: "",
      area_sqm: "",
      price: "",
      price_period: "mes",
      address: "",
      contact_phone: "",
    },
  });

  const maxPeopleField = register("max_people");
  const areaField = register("area_sqm");
  const priceField = register("price");
  const phoneField = register("contact_phone");

  const onAddPhotos = (fileList: FileList | null) => {
    if (!fileList) return;
    const validToAdd: File[] = [];
    for (const file of Array.from(fileList)) {
      const check = validateFile(file, 8, ["image/jpeg", "image/png", "image/webp"]);
      if (!check.valid) {
        toast.show(`${file.name}: ${check.error || "Imagen inválida"}`, "error");
        continue;
      }
      validToAdd.push(file);
    }
    if (validToAdd.length > 0) {
      setPhotoFiles((prev) => [...prev, ...validToAdd]);
    }
  };

  const onValidSubmit = async (values: PropertyWizardValues) => {
    if (photoFiles.length < MIN_PROPERTY_PHOTOS) {
      toast.show(
        `Debes subir al menos ${MIN_PROPERTY_PHOTOS} fotografías para publicar el inmueble (faltan ${
          MIN_PROPERTY_PHOTOS - photoFiles.length
        }).`,
        "error"
      );
      return;
    }

    setPublishing(true);
    setUploadProgress({ done: 0, total: photoFiles.length });
    const res = await publishPropertyFromWizard(
      values,
      { latitude, longitude },
      photoFiles,
      (done, total) => setUploadProgress({ done, total })
    );
    setPublishing(false);

    if (!res.ok) {
      setUploadProgress(null);
      toast.show(res.error, "error");
      return;
    }

    toast.show("¡Tu inmueble ya está publicado con sus fotografías!", "success");
    router.push("/owner/properties");
  };

  const publish = () => {
    if (publishing) return;
    void handleSubmit(onValidSubmit, () => {
      toast.show("Revisa los campos requeridos antes de publicar.", "error");
    })();
  };

  const missingPhotos = Math.max(0, MIN_PROPERTY_PHOTOS - photoFiles.length);
  const progressPct = Math.min(100, Math.round((photoFiles.length / MIN_PROPERTY_PHOTOS) * 100));

  const steps = [
    {
      title: "Información general",
      content: (
        <div className="flex flex-col gap-3">
          <Input label="Nombre" required error={errors.name?.message} {...register("name")} />
          <Select
            label="Tipo"
            error={errors.type?.message}
            options={PROPERTY_TYPES.map((t) => ({ value: t, label: t }))}
            {...register("type")}
          />
          <Input label="Ubicación" required error={errors.location?.message} {...register("location")} />
          <Select
            label="Tipo de alquiler"
            error={errors.rental_type?.message}
            options={RENTAL_TYPES.map((r) => ({ value: r.value, label: r.label }))}
            {...register("rental_type")}
          />
          <Input
            label="Capacidad máxima"
            inputMode="numeric"
            required
            error={errors.max_people?.message}
            {...maxPeopleField}
            onChange={(e) => setValue("max_people", e.target.value.replace(/\D/g, ""), { shouldValidate: true })}
          />
        </div>
      ),
    },
    {
      title: "Características y descripción",
      content: (
        <div className="flex flex-col gap-3">
          <Textarea label="Descripción" rows={4} error={errors.description?.message} {...register("description")} />
          <Input
            label="Metros cuadrados"
            inputMode="numeric"
            required
            error={errors.area_sqm?.message}
            {...areaField}
            onChange={(e) => setValue("area_sqm", e.target.value.replace(/\D/g, ""), { shouldValidate: true })}
          />
        </div>
      ),
    },
    {
      title: "Precio y ubicación",
      content: (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Precio"
              inputMode="numeric"
              required
              error={errors.price?.message}
              {...priceField}
              onChange={(e) => setValue("price", e.target.value.replace(/\D/g, ""), { shouldValidate: true })}
            />
            <Select
              label="Período"
              error={errors.price_period?.message}
              options={PRICE_PERIODS.map((p) => ({ value: p.value, label: p.label }))}
              {...register("price_period")}
            />
          </div>
          <Input label="Dirección" error={errors.address?.message} {...register("address")} />
          <MapPicker
            latitude={latitude}
            longitude={longitude}
            onChange={(lat, lng) => {
              setLatitude(lat);
              setLongitude(lng);
            }}
          />
        </div>
      ),
    },
    {
      title: "Fotografías (mínimo 4)",
      content: (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-background/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Camera className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>
                  {photoFiles.length} de {MIN_PROPERTY_PHOTOS} fotografías requeridas
                </span>
              </div>
              {missingPhotos === 0 ? (
                <Badge color="green">
                  <CheckCircle2 className="mr-1 inline h-3 w-3" aria-hidden="true" />
                  Mínimo cumplido
                </Badge>
              ) : (
                <Badge color="yellow">Faltan {missingPhotos} fotografías</Badge>
              )}
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="wizard-photos"
              className="mb-1 block text-xs font-medium text-muted"
            >
              Selecciona imágenes JPG, PNG o WEBP (máximo 8 MB c/u)
            </label>
            <input
              id="wizard-photos"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                onAddPhotos(e.target.files);
                e.target.value = "";
              }}
              className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary-light file:px-3 py-1.5 file:text-xs file:font-medium file:text-primary-dark hover:file:bg-primary-light/80"
            />
          </div>

          {previews.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {previews.map((item, idx) => (
                <div
                  key={`${item.file.name}-${idx}`}
                  className="overflow-hidden rounded-xl border border-border bg-card"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt={`Previsualización ${idx + 1}`}
                    className="h-24 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setPhotoFiles((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="flex w-full items-center justify-center gap-1 border-t border-border py-1 text-xs font-medium text-red-700 hover:bg-red-500/10 dark:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                    <span>Quitar</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {uploadProgress && (
            <Alert variant="info">
              Subiendo fotografías ({uploadProgress.done}/{uploadProgress.total}) y publicando inmueble...
            </Alert>
          )}
        </div>
      ),
    },
    {
      title: "Contacto y revisión",
      content: (
        <div className="flex flex-col gap-3">
          <Input
            label="Teléfono de contacto"
            placeholder="10 dígitos"
            maxLength={10}
            error={errors.contact_phone?.message}
            {...phoneField}
            onChange={(e) => setValue("contact_phone", e.target.value.replace(/\D/g, "").slice(0, 10), { shouldValidate: true })}
          />
          {missingPhotos > 0 ? (
            <Alert variant="warning">
              Aún te faltan {missingPhotos} fotografías en el paso anterior antes de poder publicar.
            </Alert>
          ) : (
            <Alert variant="success">
              Tienes {photoFiles.length} fotografías listas. Revisa tus datos y pulsa Finalizar para publicar.
            </Alert>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Publicar inmueble"
        subtitle="Completa los pasos e incluye mínimo 4 fotografías para publicar tu propiedad."
      />
      <Card>
        <CardBody>
          <Wizard steps={steps} onFinish={publish} />
        </CardBody>
      </Card>
    </div>
  );
}
