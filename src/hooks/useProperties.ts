"use client";
import { useQuery } from "@tanstack/react-query";
import {
  getPropertyById,
  listPublishedProperties,
  listUserSavedPropertyIds,
} from "@/modules/properties/repository";
import type { PropertyFilters } from "@/modules/properties/types";

export function useProperties(filters?: PropertyFilters) {
  return useQuery({
    queryKey: ["properties", filters],
    queryFn: () => listPublishedProperties(filters),
  });
}

export function useProperty(id: string) {
  return useQuery({
    queryKey: ["property", id],
    queryFn: () => getPropertyById(id),
    enabled: !!id,
  });
}

export function useSavedIds() {
  return useQuery({
    queryKey: ["savedIds"],
    queryFn: () => listUserSavedPropertyIds(),
  });
}
