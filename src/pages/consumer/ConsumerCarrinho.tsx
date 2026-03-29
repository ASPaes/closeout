import { useState, useEffect } from "react";
import { ArrowLeft, Minus, Plus, Trash2, AlertTriangle, ShieldAlert, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useConsumer } from "@/contexts/ConsumerContext";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export default function ConsumerCarrinho() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cart, activeEvent, consumptionLimits, updateQuantity, removeFromCart, clearCart } = useConsumer();

  const [eventSpent, setEventSpent] = useState(0);
  const [eventOrderCount, setEventOrderCount] = useState(0);
  const [eventMaxOrder, setEventMaxOrder] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch event spending and limits
  useEffect(() => {
    if (!user || !activeEvent) return;

    const fetchStats = async () => {
      // Total spent at this event
      const { data: stats } = await supabase
        .from("consumer_event_stats_secure")
        .select("total_spent, order_count")
        .eq("user_id", user.id)
        .eq("event_id", activeEvent.id)
        .maybeSingle();

      if (stats) {
        setEventSpent(stats.total_spent || 0);
        setEventOrderCount(stats.order_count || 0);
      }

      // Event max order value
      const { data: eventSettings } = await supabase
        .from("event_settings")
        .select("max_order_value")
        .eq("event_id", activeEvent.id)
        .maybeSingle();

      if (eventSettings?.max_order_value) {
        setEventMaxOrder(eventSettings.max_order_value);
      } else {
        // fallback to event table
        const { data: evt } = await supabase
          .from("events")
          .select("max_order_value")
          .eq("id", activeEvent.id)
          .single();
        setEventMaxOrder(evt?.max_order_value || null);
      }
    };

    fetchStats();
  }, [user, activeEvent]);

  const cartCount = cart.items.reduce((s, i) => s + i.quantity, 0);

  // Limit checks
  const consumerMaxValue = consumptionLimits?.max_order_value ?? null;
  const consumerMaxOrders = consumptionLimits?.max_orders_per_event ?? null;
  const behavior = consumptionLimits?.limit_behavior ?? "warn";

  const exceedsConsumerMaxValue = consumerMaxValue !== null && cart.total > consumerMaxValue;
  const exceedsEventMaxValue = eventMaxOrder !== null && cart.total > eventMaxOrder;
  const exceedsMaxOrders = consumerMaxOrders !== null && eventOrderCount >= consumerMaxOrders;

  const hasWarning = exceedsConsumerMaxValue || exceedsEventMaxValue || exceedsMaxOrders;
  const isBlocked = hasWarning && behavior === "block";

  if (cart.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.04] text-3xl">
          🛒
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">{t("consumer_cart_empty")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("consumer_cart_empty_desc")}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("/app/cardapio")}
          className="rounded-xl h-12"
        >
          {t("consumer_menu_title")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08] active:scale-95 transition-transform"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold text-foreground">{t("consumer_cart_title")}</h1>
          <p className="text-xs text-muted-foreground">
            {cartCount} {cartCount === 1 ? "item" : "itens"}
          </p>
        </div>
        <button
          onClick={clearCart}
          className="text-xs text-destructive font-medium active:opacity-70 transition-opacity"
        >
          {t("consumer_cart_clear")}
        </button>
      </div>

      {/* Event consumption summary */}
      {eventSpent > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/[0.06] p-3">
          <Info className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{t("consumer_event_spent")}</p>
            <p className="text-sm font-bold text-foreground">
              R$ {eventSpent.toFixed(2)}
              <span className="text-xs font-normal text-muted-foreground ml-1.5">
                · {eventOrderCount} {eventOrderCount === 1 ? "pedido" : "pedidos"}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Items */}
      <div className="flex flex-col gap-3">
        {cart.items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/[0.06] p-3"
          >
            {/* Image placeholder */}
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.06] text-xl select-none overflow-hidden">
              {item.image_path ? (
                <img
                  src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/product-images/${item.image_path}`}
                  alt={item.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{item.type === "combo" ? "🪣" : "🍺"}</span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground truncate">{item.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                R$ {item.price.toFixed(2)} × {item.quantity}
              </p>
              <p className="text-sm font-bold text-primary mt-0.5">
                R$ {(item.price * item.quantity).toFixed(2)}
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              <button
                onClick={() => removeFromCart(item.id)}
                className="text-destructive/70 active:scale-90 transition-transform"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-1 rounded-full bg-white/[0.06] border border-white/[0.08]">
                <button
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-full active:scale-90 transition-transform"
                >
                  <Minus className="h-3 w-3 text-foreground" />
                </button>
                <span className="min-w-[20px] text-center text-sm font-bold text-foreground">
                  {item.quantity}
                </span>
                <button
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-full active:scale-90 transition-transform"
                >
                  <Plus className="h-3 w-3 text-foreground" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Warnings */}
      {exceedsConsumerMaxValue && (
        <div className={cn(
          "flex items-start gap-3 rounded-xl p-3 border",
          behavior === "block"
            ? "bg-destructive/10 border-destructive/30"
            : "bg-yellow-500/10 border-yellow-500/30"
        )}>
          {behavior === "block" ? (
            <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
          )}
          <div>
            <p className="text-sm font-semibold text-foreground">
              {behavior === "block" ? t("consumer_limit_blocked") : t("consumer_limit_warning")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("consumer_max_value_exceeded")} (R$ {consumerMaxValue?.toFixed(2)})
            </p>
          </div>
        </div>
      )}

      {exceedsEventMaxValue && (
        <div className="flex items-start gap-3 rounded-xl p-3 border bg-yellow-500/10 border-yellow-500/30">
          <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-foreground">{t("consumer_event_limit_warning")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("consumer_event_max_value")} R$ {eventMaxOrder?.toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {exceedsMaxOrders && (
        <div className={cn(
          "flex items-start gap-3 rounded-xl p-3 border",
          behavior === "block"
            ? "bg-destructive/10 border-destructive/30"
            : "bg-yellow-500/10 border-yellow-500/30"
        )}>
          {behavior === "block" ? (
            <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
          )}
          <div>
            <p className="text-sm font-semibold text-foreground">
              {behavior === "block" ? t("consumer_orders_blocked") : t("consumer_orders_warning")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("consumer_max_orders_reached")} ({consumerMaxOrders})
            </p>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t("consumer_subtotal")}</span>
          <span className="text-foreground font-medium">R$ {cart.total.toFixed(2)}</span>
        </div>
        {eventSpent > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("consumer_accumulated")}</span>
            <span className="text-muted-foreground">R$ {(eventSpent + cart.total).toFixed(2)}</span>
          </div>
        )}
        <div className="border-t border-white/[0.06] pt-3 flex justify-between">
          <span className="text-base font-bold text-foreground">{t("consumer_total")}</span>
          <span className="text-base font-bold text-primary">R$ {cart.total.toFixed(2)}</span>
        </div>
      </div>

      {/* Pay button */}
      <Button
        onClick={() => navigate("/app/pagamento")}
        disabled={isBlocked || cart.items.length === 0}
        className="h-14 rounded-2xl text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl active:scale-[0.98] transition-transform w-full"
        style={{ boxShadow: isBlocked ? "none" : "0 8px 32px hsl(24 100% 50% / 0.35)" }}
      >
        {t("consumer_pay")} R$ {cart.total.toFixed(2)}
      </Button>
    </div>
  );
}
