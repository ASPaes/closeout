import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCaixa } from "@/contexts/CaixaContext";

export type CatalogProduct = {
  id: string;
  name: string;
  price: number;
  type: "product" | "combo";
  categoryId: string | null;
  categoryName: string | null;
  imageUrl: string | null;
  stockAvailable: number | null; // null = not tracked
};

export function useEventCatalog() {
  const { eventId, clientId } = useCaixa();

  return useQuery({
    queryKey: ["pos-event-catalog", eventId, clientId],
    enabled: !!eventId && !!clientId,
    queryFn: async (): Promise<{ items: CatalogProduct[]; categories: { id: string; name: string }[]; stockControlEnabled: boolean }> => {
      if (!eventId || !clientId) return { items: [], categories: [], stockControlEnabled: false };

      // 1. Get event settings for stock control
      const { data: eventData } = await supabase
        .from("events")
        .select("stock_control_enabled")
        .eq("id", eventId)
        .single();

      const stockControlEnabled = eventData?.stock_control_enabled ?? false;

      // 2. Get catalogs linked to this event
      const { data: eventCatalogs } = await supabase
        .from("event_catalogs")
        .select("catalog_id")
        .eq("event_id", eventId)
        .eq("is_active", true);

      if (!eventCatalogs?.length) return { items: [], categories: [], stockControlEnabled };

      const catalogIds = eventCatalogs.map((ec) => ec.catalog_id);

      // 3. Get catalog items
      const { data: catalogItems } = await supabase
        .from("catalog_items")
        .select("id, item_type, product_id, combo_id")
        .in("catalog_id", catalogIds)
        .eq("is_active", true);

      if (!catalogItems?.length) return { items: [], categories: [], stockControlEnabled };

      const productIds = catalogItems.filter((ci) => ci.item_type === "product" && ci.product_id).map((ci) => ci.product_id!);
      const comboIds = catalogItems.filter((ci) => ci.item_type === "combo" && ci.combo_id).map((ci) => ci.combo_id!);

      // 4. Fetch products and combos in parallel
      const [productsRes, combosRes, categoriesRes, stockRes] = await Promise.all([
        productIds.length
          ? supabase
              .from("products")
              .select("id, name, price, category_id, image_path, is_active, is_sellable")
              .in("id", productIds)
              .eq("is_active", true)
              .eq("is_sellable", true)
          : Promise.resolve({ data: [] }),
        comboIds.length
          ? supabase
              .from("combos")
              .select("id, name, price, is_active")
              .in("id", comboIds)
              .eq("is_active", true)
          : Promise.resolve({ data: [] }),
        supabase
          .from("categories")
          .select("id, name")
          .eq("client_id", clientId)
          .eq("is_active", true)
          .order("name"),
        stockControlEnabled && productIds.length
          ? supabase
              .from("stock_balances")
              .select("product_id, quantity_available")
              .eq("client_id", clientId)
              .in("product_id", productIds)
          : Promise.resolve({ data: [] }),
      ]);

      const categories = (categoriesRes.data ?? []) as { id: string; name: string }[];
      const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
      const stockMap = new Map((stockRes.data ?? []).map((s: any) => [s.product_id, Number(s.quantity_available)]));

      const items: CatalogProduct[] = [];

      for (const p of productsRes.data ?? []) {
        items.push({
          id: p.id,
          name: p.name,
          price: Number(p.price),
          type: "product",
          categoryId: p.category_id,
          categoryName: p.category_id ? (categoryMap.get(p.category_id) ?? null) : null,
          imageUrl: p.image_path
            ? supabase.storage.from("product-images").getPublicUrl(p.image_path).data.publicUrl
            : null,
          stockAvailable: stockControlEnabled ? (stockMap.get(p.id) ?? 0) : null,
        });
      }

      for (const c of combosRes.data ?? []) {
        items.push({
          id: c.id,
          name: c.name,
          price: Number(c.price),
          type: "combo",
          categoryId: null,
          categoryName: null,
          imageUrl: null,
          stockAvailable: null, // combos don't track stock directly
        });
      }

      items.sort((a, b) => a.name.localeCompare(b.name));

      return { items, categories, stockControlEnabled };
    },
  });
}

export function useEventSettings() {
  const { eventId } = useCaixa();

  return useQuery({
    queryKey: ["pos-event-settings", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      if (!eventId) return null;
      const { data } = await supabase
        .from("events")
        .select("max_order_value, stock_control_enabled")
        .eq("id", eventId)
        .single();
      return data;
    },
  });
}
