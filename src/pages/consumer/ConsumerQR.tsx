import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, ChefHat, Package, PackageCheck, PartyPopper, ShoppingBag, QrCode, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConsumer } from "@/contexts/ConsumerContext";
import { useTranslation } from "@/i18n/use-translation";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { vibrate } from "@/lib/native-bridge";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const timelineSteps = [
  { key: "paid", label: "Confirmado", icon: CheckCircle2 },
  { key: "preparing", label: "Em Preparo", icon: ChefHat },
  { key: "ready", label: "Pronto", icon: Package },
  { key: "partially_delivered", label: "Entrega Parcial", icon: PackageCheck },
  { key: "delivered", label: "Retirado", icon: PartyPopper },
];

const stepIndex: Record<string, number> = {
  paid: 0,
  preparing: 1,
  ready: 2,
  partially_delivered: 3,
  delivered: 4,
};

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  delivered_quantity: number;
};

type OrderQR = {
  id: string;
  order_number: number;
  status: string;
  total: number;
  qr_token: string;
  items: OrderItem[];
};

export default function ConsumerQR() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const { activeOrder, loadingOrder, refreshActiveOrder } = useConsumer();

  const paramOrderId = searchParams.get("order");

  const [specificOrder, setSpecificOrder] = useState<OrderQR | null>(null);
  const [loadingSpecific, setLoadingSpecific] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [liveItems, setLiveItems] = useState<OrderItem[] | null>(null);
  const prevStatusRef = useRef<string | null>(null);

  const fetchOrderItems = useCallback(async (orderId: string): Promise<OrderItem[]> => {
    const { data } = await supabase
      .from("order_items")
      .select("id, name, quantity, unit_price, delivered_quantity")
      .eq("order_id", orderId);
    return (data as OrderItem[]) || [];
  }, []);

  // Fetch specific order by ID from query param
  useEffect(() => {
    if (!paramOrderId || !user) return;

    setLoadingSpecific(true);
    (async () => {
      const { data: qrData } = await supabase
        .from("qr_tokens")
        .select("token, order_id")
        .eq("order_id", paramOrderId)
        .limit(1);

      const qrToken = qrData?.[0]?.token || paramOrderId;

      const { data: orderData } = await supabase
        .from("orders")
        .select("id, order_number, status, total")
        .eq("id", paramOrderId)
        .eq("consumer_id", user.id)
        .single();

      if (orderData) {
        const items = await fetchOrderItems(orderData.id);
        setSpecificOrder({
          id: orderData.id,
          order_number: orderData.order_number,
          status: orderData.status,
          total: orderData.total,
          qr_token: qrToken,
          items,
        });
      }
      setLoadingSpecific(false);
    })();
  }, [paramOrderId, user, fetchOrderItems]);

  // Determine which order to display
  const displayOrder = paramOrderId ? specificOrder : activeOrder;
  const isLoading = paramOrderId ? loadingSpecific : loadingOrder;

  // Use liveItems if available, otherwise fall back to displayOrder items
  const displayItems: OrderItem[] = liveItems || (displayOrder?.items as OrderItem[]) || [];

  const orderStatus = liveStatus || displayOrder?.status || null;
  const currentStep = orderStatus ? (stepIndex[orderStatus] ?? 0) : 0;
  const isReady = orderStatus === "ready";
  const isPartial = orderStatus === "partially_delivered";
  const isDelivered = orderStatus === "delivered";

  // Realtime subscription
  useEffect(() => {
    if (!displayOrder) return;

    const channel = supabase
      .channel(`consumer-order-${displayOrder.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${displayOrder.id}`,
        },
        async (payload) => {
          const newStatus = (payload.new as any).status;
          if (newStatus) {
            setLiveStatus(newStatus);

            // Refresh items on status change to get updated delivered_quantity
            const freshItems = await fetchOrderItems(displayOrder.id);
            setLiveItems(freshItems);

            if (newStatus === "ready" && prevStatusRef.current !== "ready") {
              vibrate(300);
            }
            if (newStatus === "partially_delivered" && prevStatusRef.current !== "partially_delivered") {
              vibrate(200);
              toast(t("consumer_qr_partial_toast"), { duration: 5000 });
            }
            prevStatusRef.current = newStatus;
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [displayOrder?.id, fetchOrderItems, t]);

  // Sync prevStatusRef
  useEffect(() => {
    if (displayOrder?.status) {
      prevStatusRef.current = displayOrder.status;
    }
  }, [displayOrder?.status]);

  // Reset live status and items when order changes
  useEffect(() => {
    setLiveStatus(null);
    setLiveItems(null);
  }, [displayOrder?.id]);

  // Delivery stats
  const totalQty = displayItems.reduce((s, i) => s + i.quantity, 0);
  const deliveredQty = displayItems.reduce((s, i) => s + (i.delivered_quantity || 0), 0);

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-5 py-8">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-[280px] w-[280px] rounded-3xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  // ── No order ──
  if (!displayOrder) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.04] border border-white/[0.06]">
          <QrCode className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">{t("consumer_qr_no_order")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("consumer_qr_no_order_desc")}</p>
        </div>
        <Button
          onClick={() => navigate("/app")}
          className="rounded-xl h-12 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {t("consumer_qr_explore")}
        </Button>
      </div>
    );
  }

  // ── Delivered state ──
  if (isDelivered) {
    return (
      <div className="flex flex-col items-center gap-6 py-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/10 border border-success/30">
          <PartyPopper className="h-10 w-10 text-success" />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-extrabold text-foreground">{t("consumer_qr_delivered")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("consumer_qr_order")} <span className="font-bold text-primary">#{String(displayOrder.order_number).padStart(3, "0")}</span>
          </p>
        </div>

        {/* Greyed out QR */}
        <div className="rounded-3xl border border-border/40 bg-card/50 p-6 opacity-40 grayscale">
          <div className="rounded-2xl bg-white p-3">
            <QRCodeSVG value={displayOrder.qr_token} size={160} level="H" bgColor="#ffffff" fgColor="#0A0A0A" />
          </div>
        </div>

        <OrderSummary items={displayItems} total={displayOrder.total} showDelivery />

        <Button
          onClick={() => { refreshActiveOrder(); navigate("/app"); }}
          className="w-full h-14 rounded-2xl text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
          style={{ boxShadow: "0 8px 32px hsl(24 100% 50% / 0.35)" }}
        >
          <ShoppingBag className="h-5 w-5 mr-2" />
          {t("consumer_qr_new_order")}
        </Button>
      </div>
    );
  }

  // ── Active order with QR ──
  return (
    <div className="flex flex-col items-center gap-5 pb-4">
      {/* Ready banner */}
      {isReady && (
        <div className="w-full rounded-2xl border border-success/40 bg-success/10 p-4 text-center animate-pulse">
          <Package className="mx-auto h-8 w-8 text-success mb-1" />
          <h1 className="text-lg font-extrabold text-success">{t("consumer_qr_ready_title")}</h1>
          <p className="text-xs text-success/80 mt-0.5">{t("consumer_qr_ready_desc")}</p>
        </div>
      )}

      {/* Partial delivery banner */}
      {isPartial && (
        <div className="w-full rounded-2xl border border-warning/40 bg-warning/10 p-4 text-center">
          <PackageCheck className="mx-auto h-8 w-8 text-warning mb-1" />
          <h1 className="text-lg font-extrabold text-warning">{t("consumer_qr_partial_title")}</h1>
          <p className="text-xs text-warning/80 mt-1">{t("consumer_qr_partial_desc")}</p>
          <p className="text-sm font-bold text-warning mt-2">
            {deliveredQty} {t("consumer_qr_partial_of")} {totalQty} {t("consumer_qr_partial_items_picked")}
          </p>
        </div>
      )}

      {/* Order number */}
      <div className="text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
          {t("consumer_qr_order")}
        </p>
        <p className="text-2xl font-extrabold text-primary">
          #{String(displayOrder.order_number).padStart(3, "0")}
        </p>
      </div>

      {/* QR Code */}
      <div
        className={cn(
          "relative rounded-3xl border bg-card p-6 transition-all",
          isReady
            ? "border-success/40 shadow-[0_0_60px_hsl(145_100%_39%/0.2)]"
            : isPartial
              ? "border-warning/40 shadow-[0_0_40px_hsl(45_100%_50%/0.15)]"
              : "border-border/60"
        )}
      >
        <div className="rounded-2xl bg-white p-4">
          <QRCodeSVG
            value={displayOrder.qr_token}
            size={220}
            level="H"
            bgColor="#ffffff"
            fgColor="#0A0A0A"
          />
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {isPartial ? t("consumer_qr_partial_show_again") : t("consumer_qr_show_counter")}
        </p>
      </div>

      {/* Vertical timeline */}
      <OrderTimeline currentStep={currentStep} orderStatus={orderStatus} />

      {/* Order summary with delivery progress */}
      <OrderSummary
        items={displayItems}
        total={displayOrder.total}
        showDelivery={isPartial || isDelivered || deliveredQty > 0}
      />
    </div>
  );
}

/* ── Timeline Component ── */
function OrderTimeline({ currentStep, orderStatus }: { currentStep: number; orderStatus: string | null }) {
  const isWarningStep = orderStatus === "partially_delivered";

  return (
    <div className="w-full px-2">
      <div className="flex flex-col gap-0">
        {timelineSteps.map((step, i) => {
          const isPast = currentStep > i;
          const isCurrent = currentStep === i;
          const isFuture = currentStep < i;
          const isWarningCurrent = isCurrent && isWarningStep;
          const StepIcon = step.icon;

          return (
            <div key={step.key} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full transition-all shrink-0",
                    isPast && "bg-success/20 border-2 border-success",
                    isCurrent && !isWarningCurrent && "bg-primary/20 border-2 border-primary shadow-[0_0_16px_hsl(24,100%,50%,0.3)] scale-110",
                    isWarningCurrent && "bg-warning/20 border-2 border-warning shadow-[0_0_16px_hsl(45,100%,50%,0.3)] scale-110",
                    isFuture && "bg-secondary border-2 border-white/10"
                  )}
                >
                  <StepIcon
                    className={cn(
                      "h-4 w-4",
                      isPast && "text-success",
                      isCurrent && !isWarningCurrent && "text-primary",
                      isWarningCurrent && "text-warning",
                      isFuture && "text-muted-foreground/40"
                    )}
                  />
                </div>
                {i < timelineSteps.length - 1 && (
                  <div
                    className={cn(
                      "w-0.5 h-8",
                      isPast ? "bg-success/40" : isCurrent && isWarningCurrent ? "bg-warning/30" : isCurrent ? "bg-primary/30" : "bg-white/[0.06]"
                    )}
                  />
                )}
              </div>
              <div className="pt-1.5">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    isPast && "text-success",
                    isCurrent && !isWarningCurrent && "text-primary",
                    isWarningCurrent && "text-warning",
                    isFuture && "text-muted-foreground/40"
                  )}
                >
                  {step.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Order Summary with delivery progress ── */
function OrderSummary({
  items,
  total,
  showDelivery = false,
}: {
  items: OrderItem[];
  total: number;
  showDelivery?: boolean;
}) {
  return (
    <div className="w-full rounded-2xl border border-border/60 bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">Resumo do Pedido</h3>
      <div className="flex flex-col gap-3">
        {items.map((item, i) => {
          const delivered = item.delivered_quantity || 0;
          const qty = item.quantity;
          const isComplete = delivered >= qty;
          const pct = qty > 0 ? Math.round((delivered / qty) * 100) : 0;

          return (
            <div key={item.id || i} className={cn("flex flex-col gap-1.5", isComplete && showDelivery && "opacity-60")}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  {isComplete && showDelivery && <Check className="h-3.5 w-3.5 text-success shrink-0" />}
                  {qty}x {item.name}
                </span>
                <span className="text-sm font-medium text-foreground">
                  R$ {(qty * item.unit_price).toFixed(2)}
                </span>
              </div>

              {showDelivery && (
                <div className="flex items-center gap-2">
                  <Progress
                    value={pct}
                    className={cn(
                      "h-1.5 flex-1",
                      isComplete ? "[&>div]:bg-success" : delivered > 0 ? "[&>div]:bg-warning" : "[&>div]:bg-muted-foreground/20"
                    )}
                  />
                  <span className={cn(
                    "text-xs font-medium whitespace-nowrap",
                    isComplete ? "text-success" : delivered > 0 ? "text-warning" : "text-muted-foreground/60"
                  )}>
                    {isComplete ? "✓ Retirado" : `${delivered} de ${qty}`}
                  </span>
                </div>
              )}
            </div>
          );
        })}
        <div className="mt-2 border-t border-border/40 pt-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Total</span>
          <span className="text-base font-bold text-primary">R$ {total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
