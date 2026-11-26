"use client";
import { memo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { getCurrentAuthUser } from "@/modules/auth/repository";
import { toggleSavedPropertyRecord } from "@/modules/properties/repository";
import type { Property } from "@/modules/properties/types";
import { useToast } from "@/components/ui/Toast";

const PropertyCard = memo(function PropertyCard({
  property,
  saved = false,
  priority = false,
}: {
  property: Property;
  saved?: boolean;
  priority?: boolean;
}) {
  const images = property.property_images?.length
    ? property.property_images.map((i) => i.url)
    : ["/placeholder.svg"];
  const [idx, setIdx] = useState(0);
  const [hover, setHover] = useState(false);
  const [isSaved, setIsSaved] = useState(saved);
  const timer = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();

  const startCarousel = () => {
    setHover(true);
    if (images.length <= 1) return;
    timer.current = setInterval(() => {
      setIdx((i) => (i + 1) % images.length);
    }, 900);
  };

  const stopCarousel = () => {
    setHover(false);
    if (timer.current) clearInterval(timer.current);
    setIdx(0);
  };

  const mutation = useMutation({
    mutationFn: (next: boolean) => toggleSavedPropertyRecord(property.id, next),
    onMutate: async (next) => {
      setIsSaved(next);
    },
    onError: () => {
      setIsSaved(saved);
    },
    onSuccess: (next) => {
      toast.show(next ? "Guardado en favoritos" : "Eliminado de favoritos", "success");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["savedIds"] });
    },
  });

  const toggleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void getCurrentAuthUser().then((user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      mutation.mutate(!isSaved);
    });
  };

  const priceLabel = `${new Intl.NumberFormat("es-CO").format(property.price)} ${
    property.price_period === "mes" ? "/mes" : property.price_period === "dia" ? "/día" : "/hora"
  }`;

  return (
    <div
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
      onMouseEnter={startCarousel}
      onMouseLeave={stopCarousel}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-secondary">
        <Image
          src={images[idx]}
          alt={property.name}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          priority={priority}
          className="object-cover transition"
        />
        {property.discount_percent > 0 && (
          <span className="absolute left-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
            -{property.discount_percent}%
          </span>
        )}
        <button
          onClick={toggleSave}
          className="absolute right-2 top-2 rounded-full bg-card/90 p-1.5 shadow hover:bg-card"
          aria-label="Guardar"
        >
          <Star className={`h-4 w-4 ${isSaved ? "fill-yellow-400 text-yellow-400" : "text-muted"}`} />
        </button>
        {images.length > 1 && hover && (
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
            {images.map((_, i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === idx ? "bg-white" : "bg-white/50"}`} />
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold text-foreground">{property.name}</h3>
          <span className="whitespace-nowrap text-sm font-bold text-primary">
            {property.discount_percent > 0 && (
              <span className="mr-1 text-xs text-muted line-through">
                {new Intl.NumberFormat("es-CO").format(Math.round(property.price / (1 - property.discount_percent / 100)))}
              </span>
            )}
            {priceLabel}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{property.description}</p>
        <div className="mt-2 flex items-center justify-between text-xs text-muted">
          <span>{property.area_sqm} m²</span>
          <span>{property.location}</span>
        </div>
        <Link
          href={`/properties/${property.id}`}
          className="mt-auto inline-block pt-3 text-sm font-medium text-primary hover:underline"
        >
          Ver más →
        </Link>
      </div>
    </div>
  );
});

export default PropertyCard;
