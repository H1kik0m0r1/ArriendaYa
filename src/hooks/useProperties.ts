"use client";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Property } from "@/lib/types";

export function useProperties(filters?: { q?: string; type?: string; priceMin?: string; priceMax?: string; page?: number; pageSize?: number }) {
  const supabase = createClient();
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 9;
  return useQuery({
    queryKey: ["properties", filters],
    queryFn: async () => {
      let query = supabase.from("properties").select("*").eq("status", "published");
      if (filters?.q) query = query.or(`name.ilike.%${filters.q}%,location.ilike.%${filters.q}%`);
      if (filters?.type) query = query.eq("type", filters.type);
      if (filters?.priceMin) query = query.gte("price", Number(filters.priceMin));
      if (filters?.priceMax) query = query.lte("price", Number(filters.priceMax));
      // total count
      const { data: all } = await (supabase.from("properties").select("*").eq("status", "published") as any);
      let filtered = (all as Property[]) || [];
      if (filters?.q) filtered = filtered.filter((p) => p.name.toLowerCase().includes(filters.q!.toLowerCase()) || p.location.toLowerCase().includes(filters.q!.toLowerCase()));
      if (filters?.type) filtered = filtered.filter((p) => p.type === filters.type);
      if (filters?.priceMin) filtered = filtered.filter((p) => p.price >= Number(filters.priceMin));
      if (filters?.priceMax) filtered = filtered.filter((p) => p.price <= Number(filters.priceMax));
      const total = filtered.length;
      // range
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = (query as any).range(from, to);
      const { data } = await query;
      const list = (data as Property[]) || [];
      for (const p of list) {
        const { data: imgs } = await supabase.from("property_images").select("*").eq("property_id", p.id);
        p.property_images = imgs || [];
      }
      return { data: list, total };
    },
  });
}

export function useProperty(id: string) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["property", id],
    queryFn: async () => {
      const { data } = await supabase.from("properties").select("*").eq("id", id).single();
      if (!data) return null;
      const { data: imgs } = await supabase.from("property_images").select("*").eq("property_id", id);
      data.property_images = imgs || [];
      return data as Property;
    },
    enabled: !!id,
  });
}

export function useSavedIds() {
  const supabase = createClient();
  return useQuery({
    queryKey: ["savedIds"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return new Set<string>();
      const { data: saved } = await supabase.from("saved_properties").select("property_id").eq("user_id", user.id);
      return new Set<string>((saved || []).map((s: any) => s.property_id));
    },
  });
}
