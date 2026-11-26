"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PRICE_PERIODS, PROPERTY_TYPES, RENTAL_TYPES } from "@/lib/constants";
import { getPropertyById } from "@/modules/properties/repository";
import { propertyEditSchema, type PropertyEditValues } from "@/modules/properties/schemas";
import {
  removeOwnerPropertyImage,
  removeProperty,
  savePropertyUpdates,
  uploadOwnerPropertyImage,
} from "@/modules/properties/service";
import type { PropertyImage } from "@/modules/properties/types";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Input from "@/components/ui/Input";
import PageHeader from "@/components/ui/PageHeader";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";

const MapPicker = dynamic(() => import("@/components/property/MapPicker"), { ssr: false });

export default function EditPropertyPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [images, setImages] = useState<PropertyImage[]>([]);
  const [propertyStatus, setPropertyStatus] = useState<string>("draft");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<PropertyEditValues>({
    resolver: zodResolver(propertyEditSchema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      type: PROPERTY_TYPES[0],
      max_people: "1",
      area_sqm: "",
      location: "",
      description: "",
      rental_type: "vivienda",
      has_max_days: true,
      max_rental_days: "",
      price: "",
      price_period: "mes",
      contact_phone: "",
      contact_email: "",
      contact_social: "",
      discount_percent: "0",
      discount_until: "",
      address: "",
      includes_administration: false,
      administration_fee: "",
      parking: "",
      floor_area: "",
      condition: "usada",
      stratum: "",
      nearby_centers: "",
      available_from: "",
      requires_cosigner: false,
      deposit_months: "",
      renter_type: "dueño directo",
      renter_name: "",
      furnished: "sin amoblar",
      pets_allowed: false,
      for_new: false,
      video_url: "",
      whatsapp_contact: "",
    },
  });

  const hasMax = useWatch({ control, name: "has_max_days" });

  useEffect(() => {
    void getPropertyById(id).then((data) => {
      if (data) {
        setImages(data.property_images || []);
        setPropertyStatus(data.status);
        setLatitude(data.latitude ?? null);
        setLongitude(data.longitude ?? null);
        reset({
          name: data.name,
          type: data.type,
          max_people: String(data.max_people),
          area_sqm: String(data.area_sqm),
          location: data.location,
          address: data.address || "",
          includes_administration: data.includes_administration ?? false,
          administration_fee: data.administration_fee != null ? String(data.administration_fee) : "",
          parking: data.parking != null ? String(data.parking) : "",
          floor_area: data.floor_area != null ? String(data.floor_area) : "",
          condition: data.condition || "usada",
          stratum: data.stratum != null ? String(data.stratum) : "",
          nearby_centers: data.nearby_centers || "",
          available_from: data.available_from || "",
          requires_cosigner: data.requires_cosigner ?? false,
          deposit_months: data.deposit_months != null ? String(data.deposit_months) : "",
          renter_type: data.renter_type || "dueño directo",
          renter_name: data.renter_name || "",
          furnished: data.furnished || "sin amoblar",
          pets_allowed: data.pets_allowed ?? false,
          for_new: data.for_new ?? false,
          video_url: data.video_url || "",
          whatsapp_contact: data.whatsapp_contact || "",
          description: data.description || "",
          rental_type: data.rental_type,
          has_max_days: data.max_rental_days != null,
          max_rental_days: data.max_rental_days != null ? String(data.max_rental_days) : "",
          price: String(data.price),
          price_period: data.price_period,
          contact_phone: data.contact_phone || "",
          contact_email: data.contact_email || "",
          contact_social: data.contact_social || "",
          discount_percent: String(data.discount_percent || 0),
          discount_until: data.discount_until ? data.discount_until.slice(0, 10) : "",
        });
      }
      setLoading(false);
    });
  }, [id, reset]);

  const geocode = async () => {
    const addr = getValues("address").trim();
    if (!addr) return;
    setGeocoding(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&limit=1`);
      const json = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (json && json.length) {
        setLatitude(parseFloat(json[0].lat));
        setLongitude(parseFloat(json[0].lon));
      }
    } catch {}
    setGeocoding(false);
  };

  const onSave = async (values: PropertyEditValues) => {
    setError("");
    const res = await savePropertyUpdates(id, values, { latitude, longitude });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.show("Cambios guardados", "success");
    router.push("/owner/properties");
  };

  const onConfirmRemove = async () => {
    setDeleting(true);
    setError("");
    const res = await removeProperty(id);
    setDeleting(false);
    if (!res.ok) {
      setError(res.error);
      setConfirmDeleteOpen(false);
      return;
    }
    toast.show("Propiedad eliminada", "info");
    router.push("/owner/properties");
  };

  const onUploadPhoto = async (file: File | null) => {
    if (!file) return;
    setUploadingPhoto(true);
    const res = await uploadOwnerPropertyImage(id, file, images.length);
    setUploadingPhoto(false);
    if (!res.ok) {
      toast.show(res.error, "error");
      return;
    }
    setImages((prev) => [...prev, res.data]);
    toast.show("Fotografía agregada al inmueble", "success");
  };

  const onDeletePhoto = async (imageId: string) => {
    if (propertyStatus === "published" && images.length >= 4 && images.length - 1 < 4) {
      toast.show("Un inmueble publicado debe conservar al menos 4 fotografías.", "error");
      return;
    }
    const res = await removeOwnerPropertyImage(imageId);
    if (!res.ok) {
      toast.show(res.error, "error");
      return;
    }
    setImages((prev) => prev.filter((img) => img.id !== imageId));
    toast.show("Fotografía eliminada", "info");
  };

  const numericField = (name: keyof PropertyEditValues, maxLen?: number) => {
    const reg = register(name);
    return {
      ...reg,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const clean = e.target.value.replace(/\D/g, "");
        setValue(name, maxLen ? clean.slice(0, maxLen) : clean, { shouldValidate: true });
      },
    };
  };

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-surface-secondary" />;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Editar inmueble"
        subtitle="Actualiza la información de tu propiedad y notifica cambios a los solicitantes."
      />
      <form onSubmit={handleSubmit(onSave)} className="flex flex-col gap-4" noValidate>
        <Input label="Nombre del lugar" required error={errors.name?.message} {...register("name")} />
        <Select
          label="Tipo de inmueble"
          error={errors.type?.message}
          options={PROPERTY_TYPES.map((t) => ({ value: t, label: t }))}
          {...register("type")}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Máximo de personas"
            inputMode="numeric"
            pattern="[0-9]*"
            required
            error={errors.max_people?.message}
            {...numericField("max_people")}
          />
          <Input
            label="Metros cuadrados"
            inputMode="numeric"
            pattern="[0-9]*"
            required
            error={errors.area_sqm?.message}
            {...numericField("area_sqm")}
          />
        </div>
        <Input label="Lugar" required error={errors.location?.message} {...register("location")} />
        <Textarea label="Descripción" rows={4} error={errors.description?.message} {...register("description")} />
        <Select
          label="Tipo de alquiler"
          error={errors.rental_type?.message}
          options={RENTAL_TYPES.map((r) => ({ value: r.value, label: r.label }))}
          {...register("rental_type")}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register("has_max_days")} />
          Tiene máximo de tiempo para alquilar
        </label>
        {hasMax && (
          <Input
            label="Máximo de días"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Ej: 365"
            error={errors.max_rental_days?.message}
            {...numericField("max_rental_days")}
          />
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Precio"
            inputMode="numeric"
            pattern="[0-9]*"
            required
            error={errors.price?.message}
            {...numericField("price")}
          />
          <Select
            label="Período"
            error={errors.price_period?.message}
            options={PRICE_PERIODS.map((p) => ({ value: p.value, label: p.label }))}
            {...register("price_period")}
          />
        </div>
        <Input
          label="Teléfono de contacto"
          placeholder="10 dígitos"
          maxLength={10}
          error={errors.contact_phone?.message}
          {...numericField("contact_phone", 10)}
        />
        <Input
          label="Correo de contacto"
          placeholder="example@gmail.com"
          type="email"
          error={errors.contact_email?.message}
          {...register("contact_email")}
        />
        <Input label="Redes sociales" error={errors.contact_social?.message} {...register("contact_social")} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Descuento (%)"
            inputMode="numeric"
            pattern="[0-9]*"
            error={errors.discount_percent?.message}
            {...numericField("discount_percent")}
          />
          <Input label="Descuento hasta" type="date" error={errors.discount_until?.message} {...register("discount_until")} />
        </div>
        <Input
          label="Dirección (para mapa)"
          placeholder="Ej: Medellín, El Poblado"
          error={errors.address?.message}
          {...register("address")}
        />
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={geocode} loading={geocoding}>
            Buscar en mapa
          </Button>
        </div>
        <MapPicker
          latitude={latitude}
          longitude={longitude}
          onChange={(lat, lng) => {
            setLatitude(lat);
            setLongitude(lng);
          }}
        />
        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-3 font-semibold text-foreground">Características adicionales</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("includes_administration")} /> Incluye administración
            </label>
            <Input label="Valor administración" inputMode="numeric" {...numericField("administration_fee")} />
            <Input label="Parqueaderos" inputMode="numeric" {...numericField("parking")} />
            <Input label="Área del piso (m²)" inputMode="numeric" {...numericField("floor_area")} />
            <Select
              label="Condición"
              options={[{ value: "nueva", label: "Para estrenar" }, { value: "usada", label: "Usada" }]}
              {...register("condition")}
            />
            <Input label="Estrato" inputMode="numeric" {...numericField("stratum")} />
            <Input label="Centros comerciales cercanos" {...register("nearby_centers")} />
            <Input label="Disponible desde" type="date" {...register("available_from")} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("requires_cosigner")} /> Requiere codeudor
            </label>
            <Input label="Meses de depósito" inputMode="numeric" {...numericField("deposit_months")} />
            <Select
              label="Arrendador"
              options={[{ value: "dueño directo", label: "Dueño directo" }, { value: "inmobiliaria", label: "Inmobiliaria" }]}
              {...register("renter_type")}
            />
            <Input label="Nombre del arrendador" {...register("renter_name")} />
            <Select
              label="Amoblado"
              options={[{ value: "amoblado", label: "Amoblado" }, { value: "semi", label: "Semi" }, { value: "sin amoblar", label: "Sin amoblar" }]}
              {...register("furnished")}
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("pets_allowed")} /> Mascotas permitidas
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("for_new")} /> Para estrenar
            </label>
            <Input
              label="Video / recorrido (URL)"
              placeholder="https://..."
              error={errors.video_url?.message}
              {...register("video_url")}
            />
            <Input
              label="WhatsApp (57...)"
              placeholder="573001234567"
              {...numericField("whatsapp_contact")}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-foreground">Fotografías del inmueble ({images.length}/4 mínimo)</h3>
            {images.length < 4 && (
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                Faltan {4 - images.length} para cumplir el mínimo de publicación
              </span>
            )}
          </div>
          {images.length < 4 && (
            <Alert variant="warning" className="mb-3">
              {propertyStatus === "published"
                ? "Este inmueble heredado tiene menos de 4 fotografías. Conserva su estado actual, pero agrega al menos 4 antes de pausar y republicar."
                : "Agrega al menos 4 fotografías para poder publicar este inmueble."}
            </Alert>
          )}
          {images.length > 0 ? (
            <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map((img) => (
                <div key={img.id} className="overflow-hidden rounded-xl border border-border bg-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="Foto de la propiedad" className="h-28 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => void onDeletePhoto(img.id)}
                    className="w-full border-t border-border py-1.5 text-xs font-medium text-red-700 hover:bg-red-500/10 dark:text-red-400"
                  >
                    Eliminar foto
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mb-3 text-xs text-muted">Aún no hay fotografías cargadas para este inmueble.</p>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Subir fotografía (JPG, PNG o WEBP, máx 8MB)
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploadingPhoto}
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                e.target.value = "";
                void onUploadPhoto(f);
              }}
              className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary-light file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-dark hover:file:bg-primary-light/80"
            />
          </div>
        </div>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={isSubmitting}>Guardar cambios</Button>
          <Button type="button" variant="danger" onClick={() => setConfirmDeleteOpen(true)}>
            Eliminar propiedad
          </Button>
        </div>
      </form>

      <ConfirmModal
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={() => void onConfirmRemove()}
        title="Eliminar propiedad"
        message="¿Estás seguro de eliminar esta propiedad por completo? Esta acción notificará a los solicitantes y no se puede deshacer."
        confirmLabel="Sí, eliminar"
        loading={deleting}
      />
    </div>
  );
}
