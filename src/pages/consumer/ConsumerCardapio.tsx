import { useState, useEffect, useMemo } from "react";
import { Search, Plus, Minus, ArrowRight, Flame, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useConsumer } from "@/contexts/ConsumerContext";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/i18n/use-translation";
import { Skeleton } from "@/components/ui/skeleton";

type CatalogProduct = {
  id: string;
  type: "product" | "combo";
  name: string;
  description: string | null;
  price: number;
  promo_price: number | null;
  discount_percent: number | null;
  category_name: string | null;
  image_path: string | null;
  is_stock_tracked: boolean;
  stock_available: number | null;
  low_stock_threshold: number;
};

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  ends_at: string;
};

export default function ConsumerCardapio() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeEvent, cart, addToCart, updateQuantity, removeFromCart } = useConsumer();

  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Fetch catalog products for event
  useEffect(() => {
    if (!activeEvent) {
      setLoading(false);
      return;
    }

    const fetchCatalog = async () => {
      setLoading(true);

      // Get event catalogs
      const { data: eventCatalogs } = await supabase
        .from("event_catalogs")
        .select("catalog_id")
        .eq("event_id", activeEvent.id)
        .eq("is_active", true);

      if (!eventCatalogs || eventCatalogs.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      const catalogIds = eventCatalogs.map((ec) => ec.catalog_id);

      // Get catalog items with products
      const { data: catalogItems } = await supabase
        .from("catalog_items")
        .select(`
          id, item_type, product_id, combo_id, is_active,
          products:product_id (id, name, description, price, image_path, category_id, is_stock_tracked, categories:category_id (name)),
          combos:combo_id (id, name, description, price)
        `)
        .in("catalog_id", catalogIds)
        .eq("is_active", true);

      // Get active campaigns for promo prices
      const now = new Date().toISOString();
      const { data: campaignsData } = await supabase
        .from("campaigns")
        .select("id, name, description, ends_at")
        .eq("client_id", activeEvent.client_id)
        .eq("is_active", true)
        .lte("starts_at", now)
        .gte("ends_at", now);

      setCampaigns(campaignsData || []);

      let campaignItemsMap: Record<string, { promo_price: number | null; discount_percent: number | null }> = {};
      if (campaignsData && campaignsData.length > 0) {
        const campaignIds = campaignsData.map((c) => c.id);
        const { data: campItems } = await supabase
          .from("campaign_items")
          .select("product_id, combo_id, promo_price, discount_percent, item_type")
          .in("campaign_id", campaignIds)
          .eq("is_active", true);

        if (campItems) {
          campItems.forEach((ci) => {
            const key = ci.item_type === "product" ? ci.product_id : ci.combo_id;
            if (key) campaignItemsMap[key] = { promo_price: ci.promo_price, discount_percent: ci.discount_percent };
          });
        }
      }

      // Get stock balances
      const { data: stockBalances } = await supabase
        .from("stock_balances")
        .select("product_id, quantity_available, low_stock_threshold, is_enabled")
        .eq("client_id", activeEvent.client_id)
        .eq("is_enabled", true);

      const stockMap: Record<string, { available: number; threshold: number }> = {};
      stockBalances?.forEach((sb) => {
        stockMap[sb.product_id] = { available: sb.quantity_available, threshold: sb.low_stock_threshold };
      });

      // Build product list
      const items: CatalogProduct[] = [];
      const catSet = new Set<string>();

      catalogItems?.forEach((ci: any) => {
        if (ci.item_type === "product" && ci.products) {
          const p = ci.products;
          const catName = p.categories?.name || null;
          if (catName) catSet.add(catName);
          const promo = campaignItemsMap[p.id];
          const stock = stockMap[p.id];

          let finalPromo = promo?.promo_price || null;
          if (!finalPromo && promo?.discount_percent) {
            finalPromo = p.price * (1 - promo.discount_percent / 100);
          }

          items.push({
            id: p.id,
            type: "product",
            name: p.name,
            description: p.description,
            price: p.price,
            promo_price: finalPromo,
            discount_percent: promo?.discount_percent || null,
            category_name: catName,
            image_path: p.image_path,
            is_stock_tracked: p.is_stock_tracked,
            stock_available: stock ? stock.available : null,
            low_stock_threshold: stock?.threshold ?? 5,
          });
        } else if (ci.item_type === "combo" && ci.combos) {
          const c = ci.combos;
          const promo = campaignItemsMap[c.id];
          let finalPromo = promo?.promo_price || null;
          if (!finalPromo && promo?.discount_percent) {
            finalPromo = c.price * (1 - promo.discount_percent / 100);
          }
          catSet.add("Combos");
          items.push({
            id: c.id,
            type: "combo",
            name: c.name,
            description: c.description,
            price: c.price,
            promo_price: finalPromo,
            discount_percent: promo?.discount_percent || null,
            category_name: "Combos",
            image_path: null,
            is_stock_tracked: false,
            stock_available: null,
            low_stock_threshold: 5,
          });
        }
      });

      setCategories(["Todos", ...Array.from(catSet).sort()]);
      setProducts(items);
      setLoading(false);
    };

    fetchCatalog();
  }, [activeEvent]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchCat = activeCategory === "Todos" || p.category_name === activeCategory;
      const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [products, activeCategory, search]);

  const cartItemMap = useMemo(() => {
    const map: Record<string, number> = {};
    cart.items.forEach((i) => { map[i.id] = i.quantity; });
    return map;
  }, [cart.items]);

  const cartCount = cart.items.reduce((s, i) => s + i.quantity, 0);

  const handleAdd = (product: CatalogProduct) => {
    const displayPrice = product.promo_price ?? product.price;
    addToCart({
      id: product.id,
      type: product.type,
      name: product.name,
      price: displayPrice,
      image_path: product.image_path,
    });
  };

  const handleDecrease = (id: string) => {
    const qty = cartItemMap[id] || 0;
    if (qty <= 1) removeFromCart(id);
    else updateQuantity(id, qty - 1);
  };

  const handleIncrease = (id: string) => {
    const qty = cartItemMap[id] || 0;
    updateQuantity(id, qty + 1);
  };

  if (!activeEvent) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <p className="text-muted-foreground text-sm">{t("consumer_no_event_selected")}</p>
        <Button variant="outline" onClick={() => navigate("/app")} className="rounded-xl">
          {t("consumer_tab_events")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-4">
      {/* Header */}
      <div>
        <h1 className="text-[28px] font-extrabold text-foreground leading-tight tracking-tight">
          {t("consumer_menu_title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">{activeEvent.name}</p>
      </div>

      {/* Campaigns carousel */}
      {campaigns.length > 0 && (
        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-5 px-5 snap-x snap-mandatory">
          {campaigns.map((c) => (
            <div
              key={c.id}
              className="shrink-0 w-[260px] snap-start rounded-2xl p-4 border border-primary/20"
              style={{ background: "linear-gradient(135deg, hsl(24 100% 50% / 0.15), hsl(24 100% 50% / 0.05))" }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Flame className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                  {t("consumer_promo_label")}
                </span>
              </div>
              <p className="text-sm font-bold text-foreground line-clamp-1">{c.name}</p>
              {c.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{c.description}</p>
              )}
              <p className="text-[11px] text-muted-foreground/70 mt-1.5">
                {t("consumer_promo_until")} {new Date(c.ends_at).toLocaleDateString("pt-BR")}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("consumer_search_product")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-12 rounded-2xl border-white/[0.08] bg-white/[0.04] pl-11 text-base placeholder:text-muted-foreground/60 focus-visible:ring-primary/30"
        />
      </div>

      {/* Category pills */}
      {categories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-all active:scale-95",
                activeCategory === cat
                  ? "bg-primary text-primary-foreground shadow-[0_0_16px_hsl(24,100%,50%,0.25)]"
                  : "bg-white/[0.06] border border-white/[0.08] text-muted-foreground"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-[72px] w-[72px] rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
          <p className="text-muted-foreground text-sm">{t("consumer_no_products")}</p>
        </div>
      )}

      {/* Product list */}
      {!loading && (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((product) => {
            const qty = cartItemMap[product.id] || 0;
            const hasPromo = product.promo_price !== null && product.promo_price < product.price;
            const displayPrice = hasPromo ? product.promo_price! : product.price;
            const lowStock = product.is_stock_tracked && product.stock_available !== null &&
              product.stock_available <= product.low_stock_threshold && product.stock_available > 0;
            const outOfStock = product.is_stock_tracked && product.stock_available !== null && product.stock_available <= 0;

            return (
              <div
                key={product.id}
                className={cn(
                  "relative flex flex-col rounded-2xl bg-white/[0.04] border border-white/[0.06] overflow-hidden active:scale-[0.98] transition-transform",
                  outOfStock && "opacity-50"
                )}
              >
                {/* Image */}
                <div className="relative aspect-square w-full bg-white/[0.02] overflow-hidden">
                  {product.image_path ? (
                    <img
                      src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/product-images/${product.image_path}`}
                      alt={product.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <span className="text-4xl">{product.type === "combo" ? "🪣" : "🍺"}</span>
                    </div>
                  )}

                  {/* Promo badge */}
                  {hasPromo && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-primary/90 px-2 py-0.5">
                      <Flame className="h-3 w-3 text-primary-foreground" />
                      {product.discount_percent && (
                        <span className="text-[10px] font-bold text-primary-foreground">
                          -{product.discount_percent}%
                        </span>
                      )}
                    </div>
                  )}

                  {/* Low stock badge */}
                  {lowStock && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-yellow-500/90 px-2 py-0.5">
                      <AlertTriangle className="h-3 w-3 text-black" />
                      <span className="text-[10px] font-bold text-black">{product.stock_available}</span>
                    </div>
                  )}

                  {outOfStock && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                      <span className="text-xs font-bold text-destructive">{t("consumer_out_of_stock")}</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex flex-col gap-1 p-3">
                  <h3 className="text-[13px] font-semibold text-foreground line-clamp-2 leading-tight">{product.name}</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[15px] font-bold text-primary">
                      R$ {displayPrice.toFixed(2)}
                    </span>
                    {hasPromo && (
                      <span className="text-[11px] text-muted-foreground line-through">
                        R$ {product.price.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Add/counter bar */}
                {!outOfStock && (
                  <div className="flex items-center justify-between w-full px-2 py-1.5 border-t border-white/[0.06]">
                    {qty === 0 ? (
                      <button
                        onClick={() => handleAdd(product)}
                        className="flex h-9 w-full items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform text-sm font-semibold gap-1.5"
                      >
                        <Plus className="h-4 w-4" />
                        {t("consumer_add_label") || "Adicionar"}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleDecrease(product.id)}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-foreground active:scale-90 transition-transform"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="text-sm font-bold text-foreground">
                          {qty}
                        </span>
                        <button
                          onClick={() => handleIncrease(product.id)}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground active:scale-90 transition-transform"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Checkout bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-[76px] left-0 right-0 z-40 px-5">
          <div className="mx-auto max-w-[480px]">
            <button
              onClick={() => navigate("/app/carrinho")}
              className="flex h-14 w-full items-center justify-between rounded-2xl bg-primary px-5 shadow-xl active:scale-[0.98] transition-transform"
              style={{ boxShadow: "0 8px 32px hsl(24 100% 50% / 0.35)" }}
            >
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-foreground/20 text-xs font-bold text-primary-foreground">
                  {cartCount}
                </div>
                <span className="text-[15px] font-semibold text-primary-foreground">
                  {t("consumer_view_cart")}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[15px] font-bold text-primary-foreground">
                  R$ {cart.total.toFixed(2)}
                </span>
                <ArrowRight className="h-4 w-4 text-primary-foreground/70" />
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
