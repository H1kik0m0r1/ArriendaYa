"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  Link2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Star,
} from "lucide-react";
import { isDemoMode } from "@/lib/config/env";
import { getBogotaTodayIso } from "@/lib/date/bogota";
import { isValidVideoUrl } from "@/lib/utils";
import { getPropertyById, recordAuthenticatedPropertyView } from "@/modules/properties/repository";
import type { Property } from "@/modules/properties/types";
import { scheduleVisitSchema, type ScheduleVisitValues } from "@/modules/visits/schemas";
import { schedulePropertyVisit } from "@/modules/visits/service";
import RequestButton from "@/components/property/RequestButton";
import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";

const MapView = dynamic(() => import("@/components/property/MapView"), { ssr: false });

interface LiveReview {
  id: string;
  author_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

export default function PropertyDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const toast = useToast();
  const [property, setProperty] = useState<Property | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [visitOpen, setVisitOpen] = useState(false);
  const [reviews, setReviews] = useState<LiveReview[]>([]);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [canReview, setCanReview] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const loading = loadedId !== id;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ScheduleVisitValues>({
    resolver: zodResolver(scheduleVisitSchema),
    mode: "onTouched",
    defaultValues: { name: "", phone: "", date: "" },
  });

  const loadLiveReviews = async (propertyId: string) => {
    if (isDemoMode()) return;
    const res = await fetch(`/api/reviews?propertyId=${encodeURIComponent(propertyId)}`);
    if (!res.ok) return;
    const json = (await res.json()) as {
      reviews?: LiveReview[];
      averageRating?: number | null;
      canReview?: boolean;
      alreadyReviewed?: boolean;
    };
    setReviews(json.reviews ?? []);
    setAverageRating(json.averageRating ?? null);
    setCanReview(Boolean(json.canReview));
    setAlreadyReviewed(Boolean(json.alreadyReviewed));
  };

  useEffect(() => {
    let active = true;
    void getPropertyById(id).then((res) => {
      if (!active) return;
      setProperty(res);
      setLoadedId(id);
      if (res) {
        void recordAuthenticatedPropertyView(res.id);
        if (isDemoMode() && res.reviews?.length) {
          setReviews(
            res.reviews.map((r, i) => ({
              id: `demo-${i}`,
              author_name: r.author,
              rating: r.rating,
              comment: r.comment,
              created_at: "",
            }))
          );
          const avg = res.reviews.reduce((sum, r) => sum + r.rating, 0) / res.reviews.length;
          setAverageRating(Number(avg.toFixed(1)));
        } else {
          void loadLiveReviews(res.id);
        }
      }
    });
    return () => {
      active = false;
    };
  }, [id]);

  const onSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property) return;
    const cleanComment = reviewComment.trim();
    if (cleanComment.length < 5) {
      toast.show("Escribe al menos 5 caracteres en tu reseña", "error");
      return;
    }
    setSubmittingReview(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: property.id,
          rating: reviewRating,
          comment: cleanComment,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.show(json.error || "No se pudo publicar la reseña", "error");
        return;
      }
      toast.show("Reseña publicada", "success");
      setReviewComment("");
      await loadLiveReviews(property.id);
    } finally {
      setSubmittingReview(false);
    }
  };

  const onScheduleVisit = async (values: ScheduleVisitValues) => {
    if (!property) return;
    const res = await schedulePropertyVisit(property.id, property.owner_id, values);
    if (!res.ok) {
      if (res.error === "UNAUTHENTICATED") {
        router.push("/login");
        return;
      }
      toast.show(res.error, "error");
      return;
    }
    toast.show("Visita agendada. El propietario será notificado.", "success");
    setVisitOpen(false);
    reset({ name: "", phone: "", date: "" });
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="h-12 w-72 animate-pulse rounded-lg bg-surface-secondary" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-64 animate-pulse rounded-xl bg-surface-secondary" />
          <div className="h-64 animate-pulse rounded-xl bg-surface-secondary" />
        </div>
        <div className="h-48 animate-pulse rounded-xl border border-border bg-surface-secondary" />
      </div>
    );
  }

  if (!property) {
    return (
      <EmptyState
        title="Propiedad no encontrada"
        message="Este inmueble no está disponible o el enlace no existe."
        action={
          <Link
            href="/"
            className="inline-flex min-h-[40px] items-center rounded-lg bg-primary-btn px-4 py-2 text-sm font-medium text-white hover:bg-primary-btn-hover"
          >
            Explorar catálogo
          </Link>
        }
      />
    );
  }

  const images = property.property_images?.length ? property.property_images.map((i) => i.url) : [];
  const priceSuffix =
    property.price_period === "mes" ? "/mes" : property.price_period === "dia" ? "/día" : "/hora";

  const nameField = register("name");
  const phoneField = register("phone");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={property.name}
        subtitle={`${property.location} · ${property.type}`}
        actions={
          <Link
            href="/"
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-primary-light/60"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Catálogo</span>
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {images.length ? (
          images.map((u, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={u}
              alt={`${property.name} — fotografía ${i + 1}`}
              loading="lazy"
              className="h-64 w-full rounded-xl border border-border object-cover"
            />
          ))
        ) : (
          <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-card text-sm text-muted sm:col-span-2">
            Sin fotografías disponibles
          </div>
        )}
      </div>

      {property.address && (
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span>{property.address}</span>
        </p>
      )}

      <Card>
        <CardBody className="space-y-2 p-3 sm:p-4">
          <MapView latitude={property.latitude} longitude={property.longitude} />
          {property.latitude && property.longitude && (
            <a
              href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=;${property.latitude},${property.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <span>Cómo llegar</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-primary-dark">Descripción y características</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
              {property.description}
            </p>
            <dl className="grid grid-cols-1 gap-2.5 border-t border-border pt-4 text-sm sm:grid-cols-2">
              <div><dt className="inline font-medium text-muted">Máx. personas:</dt> <dd className="inline">{property.max_people}</dd></div>
              <div><dt className="inline font-medium text-muted">Área:</dt> <dd className="inline">{property.area_sqm} m²</dd></div>
              <div><dt className="inline font-medium text-muted">Modalidad:</dt> <dd className="inline">{property.rental_type}</dd></div>
              <div>
                <dt className="inline font-medium text-muted">Máx. tiempo:</dt>{" "}
                <dd className="inline">{property.max_rental_days ? `${property.max_rental_days} días` : "Sin máximo"}</dd>
              </div>
              {property.stratum && <div><dt className="inline font-medium text-muted">Estrato:</dt> <dd className="inline">{property.stratum}</dd></div>}
              {property.condition && <div><dt className="inline font-medium text-muted">Condición:</dt> <dd className="inline">{property.condition}</dd></div>}
              {property.furnished && <div><dt className="inline font-medium text-muted">Amoblado:</dt> <dd className="inline">{property.furnished}</dd></div>}
              {property.pets_allowed != null && (
                <div><dt className="inline font-medium text-muted">Mascotas:</dt> <dd className="inline">{property.pets_allowed ? "Permitidas" : "No permitidas"}</dd></div>
              )}
              {property.parking != null && <div><dt className="inline font-medium text-muted">Parqueaderos:</dt> <dd className="inline">{property.parking}</dd></div>}
              {property.floor_area && <div><dt className="inline font-medium text-muted">Área piso:</dt> <dd className="inline">{property.floor_area} m²</dd></div>}
              {property.available_from && <div><dt className="inline font-medium text-muted">Disponible desde:</dt> <dd className="inline">{property.available_from}</dd></div>}
              {property.nearby_centers && <div className="sm:col-span-2"><dt className="inline font-medium text-muted">Centros cercanos:</dt> <dd className="inline">{property.nearby_centers}</dd></div>}
            </dl>
          </CardBody>
        </Card>

        <div>
          <Card className="md:sticky md:top-24">
            <CardBody className="space-y-4">
              <div>
                <div className="text-2xl font-bold text-primary-dark">
                  ${new Intl.NumberFormat("es-CO").format(property.price)}
                  <span className="text-sm font-normal text-muted"> {priceSuffix}</span>
                </div>
                {property.includes_administration && (
                  <p className="mt-0.5 text-xs text-muted">Incluye administración</p>
                )}
                {!property.includes_administration && property.administration_fee && (
                  <p className="mt-0.5 text-xs text-muted">
                    + Administración: ${new Intl.NumberFormat("es-CO").format(property.administration_fee)}
                  </p>
                )}
                {property.discount_percent > 0 && (
                  <div className="mt-2">
                    <Badge color="red">Descuento {property.discount_percent}%</Badge>
                  </div>
                )}
              </div>

              {(property.contact_phone || property.contact_email || property.contact_social) && (
                <div className="space-y-1.5 border-t border-border pt-3 text-sm">
                  <h3 className="font-semibold text-primary-dark">Contacto directo</h3>
                  {property.contact_phone && (
                    <p className="flex items-center gap-2 text-muted">
                      <Phone className="h-4 w-4 text-primary" aria-hidden="true" />
                      <span>{property.contact_phone}</span>
                    </p>
                  )}
                  {property.contact_email && (
                    <p className="flex items-center gap-2 text-muted break-all">
                      <Mail className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      <span>{property.contact_email}</span>
                    </p>
                  )}
                  {property.contact_social && (
                    <p className="flex items-center gap-2 text-muted break-all">
                      <Link2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      <span>{property.contact_social}</span>
                    </p>
                  )}
                </div>
              )}

              <div className="border-t border-border pt-3">
                <RequestButton propertyId={property.id} ownerId={property.owner_id} />
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {(property.renter_name || property.renter_type) && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-primary-dark">Quién arrienda</h2>
          </CardHeader>
          <CardBody>
            <div className="flex items-center gap-3">
              {property.renter_photo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={property.renter_photo_url}
                  alt={property.renter_name || "Arrendador"}
                  className="h-12 w-12 rounded-full border border-border object-cover"
                />
              )}
              <div>
                <p className="font-medium text-foreground">{property.renter_name || "Arrendador"}</p>
                <p className="text-sm text-muted">{property.renter_type}</p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {(property.requires_cosigner || property.deposit_months) && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-primary-dark">Requisitos del arrendador</h2>
          </CardHeader>
          <CardBody>
            <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
              {property.requires_cosigner && <li>Requiere codeudor/fiador</li>}
              {property.deposit_months && <li>Depósito: {property.deposit_months} mes(es)</li>}
            </ul>
          </CardBody>
        </Card>
      )}

      {property.video_url && isValidVideoUrl(property.video_url) && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-primary-dark">Video / Recorrido</h2>
          </CardHeader>
          <CardBody>
            <div className="aspect-video overflow-hidden rounded-lg border border-border">
              <iframe
                src={property.video_url}
                title={`Recorrido en video de ${property.name}`}
                className="h-full w-full"
                allowFullScreen
              />
            </div>
          </CardBody>
        </Card>
      )}

      {(reviews.length > 0 || canReview || alreadyReviewed) && (
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-primary-dark">Opiniones de inquilinos</h2>
            {averageRating !== null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/70 dark:text-amber-200">
                <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" aria-hidden="true" />
                <span>{averageRating} ({reviews.length})</span>
              </span>
            )}
          </CardHeader>
          <CardBody className="space-y-4">
            {reviews.length === 0 ? (
              <p className="text-sm text-muted">Aún no hay reseñas publicadas para este inmueble.</p>
            ) : (
              <ul className="divide-y divide-border">
                {reviews.map((r) => (
                  <li key={r.id} className="space-y-1 py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{r.author_name}</p>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                        <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" aria-hidden="true" />
                        <span>{r.rating} / 5</span>
                      </span>
                    </div>
                    <p className="text-sm text-muted">{r.comment}</p>
                    {r.created_at && (
                      <p className="text-[11px] text-muted">
                        {new Date(r.created_at).toLocaleDateString("es-CO")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {alreadyReviewed && (
              <Alert variant="info">Ya publicaste una reseña para este inmueble.</Alert>
            )}

            {canReview && !alreadyReviewed && (
              <form onSubmit={onSubmitReview} className="space-y-3 border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-foreground">Escribir reseña</h3>
                <div className="flex items-center gap-1.5">
                  <span className="mr-2 text-xs text-muted">Calificación:</span>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setReviewRating(n)}
                      aria-label={`${n} estrellas`}
                      className="rounded p-1 hover:bg-surface-secondary"
                    >
                      <Star
                        className={`h-5 w-5 ${
                          n <= reviewRating ? "fill-amber-500 text-amber-500" : "text-muted/40"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <Textarea
                  label="Tu experiencia en este inmueble"
                  rows={3}
                  maxLength={1000}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Cuéntanos cómo fue el proceso de arriendo y la experiencia con el inmueble..."
                />
                <Button type="submit" size="sm" loading={submittingReview}>
                  Publicar reseña
                </Button>
              </form>
            )}
          </CardBody>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        {property.whatsapp_contact && (
          <a
            href={`https://wa.me/${property.whatsapp_contact}?text=${encodeURIComponent(
              "Hola, me interesa el inmueble: " + property.name
            )}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            <span>Contactar por WhatsApp</span>
          </a>
        )}
        <Button type="button" onClick={() => setVisitOpen(true)}>
          <Calendar className="h-4 w-4" aria-hidden="true" />
          <span>Agendar visita</span>
        </Button>
      </div>

      <Modal open={visitOpen} onClose={() => setVisitOpen(false)} title="Agendar visita">
        <form onSubmit={handleSubmit(onScheduleVisit)} className="flex flex-col gap-3" noValidate>
          <Input
            label="Tu nombre"
            error={errors.name?.message}
            {...nameField}
            onChange={(e) => {
              const clean = e.target.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ\s]/g, "");
              setValue("name", clean, { shouldValidate: true });
            }}
          />
          <Input
            label="Tu celular"
            maxLength={10}
            error={errors.phone?.message}
            {...phoneField}
            onChange={(e) => {
              const clean = e.target.value.replace(/\D/g, "").slice(0, 10);
              setValue("phone", clean, { shouldValidate: true });
            }}
          />
          <Input label="Fecha de visita" type="date" min={getBogotaTodayIso()} error={errors.date?.message} {...register("date")} />
          <Button type="submit" loading={isSubmitting}>Confirmar visita</Button>
        </form>
      </Modal>
    </div>
  );
}
