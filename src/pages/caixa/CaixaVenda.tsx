import { useState, useMemo, useCallback, useRef } from "react";
import { CaixaEventGuard } from "@/components/CaixaEventGuard";
import { useCaixa } from "@/contexts/CaixaContext";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import { useEventCatalog, useEventSettings, type CatalogProduct } from "@/hooks/usePOSCatalog";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTION } from "@/config/audit-actions";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, Plus, Minus, Trash2, ShoppingCart, Loader2,
  Banknote, CreditCard, Smartphone, Package, LayoutGrid, List,
} from "lucide-react";
import type { Json } from "@/integrations/supabase/types";
import { ThermalReceipt, printThermalReceipt } from "@/components/caixa/ThermalReceipt";

type CartItem = {
  cartId: string;
  id: string;
  name: string;
  price: number;
  quantity: number;
  type: "product" | "combo";
};

let cartIdCounter = 0;
const nextCartId = () => `cart-${++cartIdCounter}-${Date.now()}`;

type PaymentMethod = "cash" | "credit_card" | "debit_card" | "pix";

const PAYMENT_OPTIONS: { method: PaymentMethod; labelKey: string; icon: any }[] = [
  { method: "cash", labelKey: "caixa_cash", icon: Banknote },
  { method: "credit_card", labelKey: "caixa_credit", icon: CreditCard },
  { method: "debit_card", labelKey: "caixa_debit", icon: CreditCard },
  { method: "pix", labelKey: "caixa_pix", icon: Smartphone },
];

function CatalogGrid({
  items,
  categories,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  onAddItem,
  t,
}: {
  items: CatalogProduct[];
  categories: { id: string; name: string }[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategory: string | null;
  setSelectedCategory: (c: string | null) => void;
  onAddItem: (item: CatalogProduct) => void;
  t: any;
}) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const filtered = useMemo(() => {
    let result = items;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((i) => i.name.toLowerCase().includes(q));
    }
    if (selectedCategory) {
      result = result.filter((i) => i.categoryId === selectedCategory);
    }
    return result;
  }, [items, searchQuery, selectedCategory]);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("pos_search_products")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-11"
          autoComplete="off"
        />
      </div>

      {/* View toggle + Category filter */}
      <div className="flex gap-1.5 mb-3 flex-wrap items-center">
        <div className="flex border border-border rounded-md mr-1">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2.5 rounded-l-md transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground focus-visible:text-foreground"}`}
            title={t("pos_view_grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2.5 rounded-r-md transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground focus-visible:text-foreground"}`}
            title={t("pos_view_list")}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
        <Badge
          variant={selectedCategory === null ? "default" : "outline"}
          className="cursor-pointer text-xs py-1.5 px-3"
          onClick={() => setSelectedCategory(null)}
        >
          {t("pos_all_categories")}
        </Badge>
        {categories.map((cat) => (
          <Badge
            key={cat.id}
            variant={selectedCategory === cat.id ? "default" : "outline"}
            className="cursor-pointer text-xs py-1.5 px-3"
            onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
          >
            {cat.name}
          </Badge>
        ))}
      </div>

      {/* Product grid / list */}
      <ScrollArea className="flex-1 min-h-0">
        {viewMode === "grid" ? (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 pr-2 pb-2">
            {filtered.map((item) => {
              const outOfStock = item.stockAvailable !== null && item.stockAvailable <= 0;
              return (
                <button
                  key={`${item.type}-${item.id}`}
                  disabled={outOfStock}
                  onClick={() => onAddItem(item)}
                  className="flex flex-col items-start rounded-md border border-border/60 bg-card text-left transition-all hover:border-primary/40 hover:shadow-sm active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden"
                >
                  {item.imageUrl ? (
                    <div className="w-full aspect-[4/3] bg-muted/30 overflow-hidden">
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  ) : (
                    <div className="w-full aspect-[4/3] bg-muted/20 flex items-center justify-center">
                      <Package className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="p-1.5 w-full flex flex-col gap-0.5">
                    <div className="flex items-center gap-1 w-full">
                      {item.type === "combo" && <Package className="h-2.5 w-2.5 text-primary shrink-0" />}
                      <span className="text-xs font-medium truncate flex-1">{item.name}</span>
                    </div>
                    <div className="flex items-center justify-between w-full">
                      <span className="text-primary font-bold text-sm">{fmt(item.price)}</span>
                      {outOfStock ? (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">{t("pos_out_of_stock")}</Badge>
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                          <Plus className="h-3.5 w-3.5 text-primary" />
                        </div>
                      )}
                    </div>
                    {item.stockAvailable !== null && item.stockAvailable > 0 && (
                      <span className="text-[10px] text-muted-foreground">Estoque: {item.stockAvailable}</span>
                    )}
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="col-span-full text-center text-sm text-muted-foreground py-8">{t("no_results")}</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 pr-2 pb-2">
            {filtered.map((item) => {
              const outOfStock = item.stockAvailable !== null && item.stockAvailable <= 0;
              return (
                <button
                  key={`${item.type}-${item.id}`}
                  disabled={outOfStock}
                  onClick={() => onAddItem(item)}
                  className="flex flex-col items-start justify-between rounded-md border border-border/60 bg-card p-2 text-left transition-all hover:border-primary/40 hover:shadow-sm active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed min-h-[60px]"
                >
                  <div className="flex items-center gap-1 w-full">
                    {item.type === "combo" && <Package className="h-2.5 w-2.5 text-primary shrink-0" />}
                    <span className="text-xs font-medium line-clamp-2 flex-1">{item.name}</span>
                  </div>
                  <div className="flex items-center justify-between w-full mt-1">
                    <span className="text-primary font-bold text-xs">{fmt(item.price)}</span>
                    {outOfStock ? (
                      <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">{t("pos_out_of_stock")}</Badge>
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                        <Plus className="h-3 w-3 text-primary" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="col-span-full text-center text-sm text-muted-foreground py-8">{t("no_results")}</p>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function CartPanel({
  cart,
  updateQty,
  removeItem,
  discount,
  setDiscount,
  paymentMethod,
  setPaymentMethod,
  amountReceived,
  setAmountReceived,
  onFinalize,
  submitting,
  t,
}: {
  cart: CartItem[];
  updateQty: (id: string, delta: number) => void;
  removeItem: (id: string) => void;
  discount: string;
  setDiscount: (v: string) => void;
  paymentMethod: PaymentMethod | null;
  setPaymentMethod: (m: PaymentMethod) => void;
  amountReceived: string;
  setAmountReceived: (v: string) => void;
  onFinalize: () => void;
  submitting: boolean;
  t: any;
}) {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const discountValue = parseFloat(discount) || 0;
  const total = Math.max(subtotal - discountValue, 0);
  const received = parseFloat(amountReceived) || 0;
  const change = paymentMethod === "cash" && received > 0 ? received - total : 0;

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          {t("pos_cart_title")}
          {cart.length > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">{cart.reduce((s, i) => s + i.quantity, 0)}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 gap-3 pt-0">
        {/* Cart items */}
        <ScrollArea className="flex-1 min-h-0">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <ShoppingCart className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">{t("pos_cart_empty")}</p>
              <p className="text-xs text-muted-foreground/60">{t("pos_cart_empty_desc")}</p>
            </div>
          ) : (
            <div className="space-y-2 pr-2">
              {cart.map((item) => (
                <div key={item.cartId} className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/30 p-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{fmt(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive focus-visible:text-destructive" onClick={() => removeItem(item.cartId)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Totals */}
        <div className="space-y-2 border-t border-border/40 pt-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("pos_subtotal")}</span>
            <span>{fmt(subtotal)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground shrink-0">{t("pos_discount")}</Label>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              className="h-11 text-sm text-right"
              placeholder="0,00"
            />
          </div>
          <div className="flex justify-between text-base font-bold">
            <span>{t("pos_total")}</span>
            <span className="text-primary">{fmt(total)}</span>
          </div>
        </div>

        {/* Payment method */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">{t("pos_payment_method")}</Label>
          <div className="grid grid-cols-4 gap-1.5">
            {PAYMENT_OPTIONS.map((opt) => (
              <Button
                key={opt.method}
                variant={paymentMethod === opt.method ? "default" : "outline"}
                size="sm"
                className="text-xs flex flex-col gap-0.5 h-auto py-2.5 min-h-[44px]"
                onClick={() => setPaymentMethod(opt.method)}
              >
                <opt.icon className="h-4 w-4" />
                {t(opt.labelKey as any)}
              </Button>
            ))}
          </div>
        </div>

        {/* Cash received */}
        {paymentMethod === "cash" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground shrink-0">{t("pos_amount_received")}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                className="h-7 text-sm text-right"
              />
            </div>
            {change > 0 && (
              <div className="flex justify-between text-sm bg-green-500/10 text-green-500 rounded-md px-3 py-1.5">
                <span>{t("pos_change")}</span>
                <span className="font-bold">{fmt(change)}</span>
              </div>
            )}
          </div>
        )}

        {/* Finalize */}
        <Button
          className="w-full mt-auto font-semibold text-base h-11 shadow-[0_0_15px_hsl(var(--primary)/0.2)] hover:shadow-[0_0_25px_hsl(var(--primary)/0.35)] transition-shadow"
          disabled={submitting || cart.length === 0 || !paymentMethod}
          onClick={onFinalize}
        >
          {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShoppingCart className="h-4 w-4 mr-2" />}
          {t("pos_finalize")}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function CaixaVenda() {
  const { t } = useTranslation();
  const { eventId, clientId, cashRegisterId } = useCaixa();
  const { session } = useAuth();
  const { data: catalogData, isLoading: catalogLoading } = useEventCatalog();
  const { data: eventSettings } = useEventSettings();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [amountReceived, setAmountReceived] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const items = catalogData?.items ?? [];
  const categories = catalogData?.categories ?? [];
  const stockControlEnabled = catalogData?.stockControlEnabled ?? false;

  const addItem = useCallback((product: CatalogProduct) => {
    // Check stock
    if (product.stockAvailable !== null && product.stockAvailable <= 0) return;

    setCart((prev) => {
      // Stock check: count how many of this product are already in cart
      if (product.stockAvailable !== null) {
        const totalInCart = prev.filter((i) => i.id === product.id).reduce((s, i) => s + i.quantity, 0);
        if (totalInCart >= product.stockAvailable) return prev;
      }
      return [...prev, { cartId: nextCartId(), id: product.id, name: product.name, price: product.price, quantity: 1, type: product.type }];
    });
  }, []);

  const updateQty = useCallback((cartId: string, delta: number) => {
    setCart((prev) => {
      return prev.map((i) => {
        if (i.cartId !== cartId) return i;
        const newQty = i.quantity + delta;
        if (newQty <= 0) return i;
        // Check stock limit for increase
        if (delta > 0) {
          const catalogItem = items.find((ci) => ci.id === i.id);
          if (catalogItem?.stockAvailable !== null && catalogItem?.stockAvailable !== undefined && newQty > catalogItem.stockAvailable) {
            return i;
          }
        }
        return { ...i, quantity: newQty };
      });
    });
  }, [items]);

  const removeItem = useCallback((cartId: string) => {
    setCart((prev) => prev.filter((i) => i.cartId !== cartId));
  }, []);

  const handleFinalize = async () => {
    if (!cart.length) { toast.error(t("pos_no_items")); return; }
    if (!paymentMethod) { toast.error(t("pos_no_payment")); return; }
    if (!cashRegisterId || !eventId || !clientId || !session?.user?.id) return;

    const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const discountValue = parseFloat(discount) || 0;
    const total = Math.max(subtotal - discountValue, 0);

    // Max order value check
    if (eventSettings?.max_order_value && total > Number(eventSettings.max_order_value)) {
      const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      toast.error(t("pos_max_order_exceeded").replace("%s", fmt(Number(eventSettings.max_order_value))));
      return;
    }

    setSubmitting(true);
    try {
      const orderItems: Json = cart.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        type: i.type,
        subtotal: i.price * i.quantity,
      })) as unknown as Json;

      // Get next order number via RPC
      const { data: orderNumber, error: numError } = await supabase.rpc("next_cash_order_number", {
        p_event_id: eventId,
      });
      if (numError) throw numError;

      // Insert cash order
      const { data: order, error: orderError } = await supabase
        .from("cash_orders")
        .insert({
          cash_register_id: cashRegisterId,
          client_id: clientId,
          event_id: eventId,
          operator_id: session.user.id,
          items: orderItems,
          order_number: orderNumber,
          subtotal,
          discount: discountValue,
          total,
          payment_method: paymentMethod,
          status: "completed",
        })
        .select("id, order_number")
        .single();

      if (orderError) throw orderError;

      // Decrement stock for product items (if stock control enabled)
      if (stockControlEnabled) {
        const productItems = cart.filter((i) => i.type === "product");
        if (productItems.length > 0) {
          const stockInserts = productItems.map((item) => ({
            client_id: clientId,
            product_id: item.id,
            entry_type: "remove" as const,
            quantity: item.quantity,
            reason: `Venda #${order.order_number}`,
            created_by: session.user.id,
          }));

          await supabase.from("stock_entries").insert(stockInserts);
        }
      }

      // Audit log
      await logAudit({
        action: AUDIT_ACTION.CASH_ORDER_CREATED,
        entityType: "cash_order",
        entityId: order.id,
        newData: { order_number: order.order_number, total, payment_method: paymentMethod, items_count: cart.length },
      });

      toast.success(t("pos_order_success").replace("%s", String(order.order_number)));

      // Prepare receipt data and trigger print
      setLastSale({
        orderNumber: order.order_number,
        items: cart.map((i) => ({ name: i.name, qty: i.quantity, unitPrice: i.price, total: i.price * i.quantity })),
        subtotal,
        discount: discountValue,
        total,
        paymentMethod: paymentMethod,
      });
      setTimeout(() => printThermalReceipt(), 300);

      // Reset for next sale
      setCart([]);
      setDiscount("");
      setPaymentMethod(null);
      setAmountReceived("");
    } catch (err) {
      console.error("POS order error:", err);
      toast.error(t("pos_order_error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CaixaEventGuard requireRegister>
      {catalogLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Package className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{t("pos_no_catalog")}</h2>
            <p className="text-sm text-muted-foreground max-w-md">{t("pos_no_catalog_desc")}</p>
          </div>
        </div>
      ) : (
        <div className="flex gap-4 h-[calc(100vh-7rem)]">
          {/* Left: Catalog */}
          <div className="flex-1 min-w-0 flex flex-col">
            <CatalogGrid
              items={items}
              categories={categories}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              onAddItem={addItem}
              t={t}
            />
          </div>

          {/* Right: Cart */}
          <div className="w-[340px] shrink-0 flex flex-col">
            <CartPanel
              cart={cart}
              updateQty={updateQty}
              removeItem={removeItem}
              discount={discount}
              setDiscount={setDiscount}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              amountReceived={amountReceived}
              setAmountReceived={setAmountReceived}
              onFinalize={handleFinalize}
              submitting={submitting}
              t={t}
            />
          </div>
        </div>
        )}

        {lastSale && (
          <ThermalReceipt
            ref={receiptRef}
            type="sale"
            data={lastSale}
            operatorName={session?.user?.email ?? undefined}
          />
        )}
      </CaixaEventGuard>
  );
}
