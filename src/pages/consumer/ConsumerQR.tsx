import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, ChefHat, Package, Inbox, PartyPopper, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConsumer } from "@/contexts/ConsumerContext";
import { useTranslation } from "@/i18n/use-translation";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { vibrate } from "@/lib/native-bridge";

const timelineSteps = [
  { key: "paid", label: "Confirmado", icon: CheckCircle2 },
  { key: "preparing", label: "Em Preparo", icon: ChefHat },
  { key: "ready", label: "Pronto", icon: Package },
  { key: "delivered", label: "Retirado", icon: PartyPopper },
];

const stepIndex: Record<string, number> = { paid: 0, preparing: 1, ready: 2, delivered: 3 };

export default function ConsumerQR() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeOrder, loadingOrder, refreshActiveOrder } = useConsumer();
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const prevStatusRef = useRef<string | null>(null);

  const orderStatus = liveStatus || activeOrder?.status || null;
  const currentStep = orderStatus ? (stepIndex[orderStatus] ?? 0) : 0;
  const isReady = orderStatus === "ready";
  const isDelivered = orderStatus === "delivered";

  // Realtime subscription
  useEffect(() => {
    if (!activeOrder) return;

    const channel = supabase
      .channel(`consumer-order-${activeOrder.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${activeOrder.id}`,
        },
        (payload) => {
          const newStatus = (payload.new as any).status;
          if (newStatus) {
            setLiveStatus(newStatus);

            // Vibrate when ready
            if (newStatus === "ready" && prevStatusRef.current !== "ready") {
              vibrate(300);
            }
            prevStatusRef.current = newStatus;
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeOrder?.id]);

  // Sync prevStatusRef
  useEffect(() => {
    if (activeOrder?.status) {
      prevStatusRef.current = activeOrder.status;
    }
  }, [activeOrder?.status]);

  // ── Loading ──
  if (loadingOrder) {
    return (
      <div className="flex flex-col items-center gap-5 py-8">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-[280px] w-[280px] rounded-3xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  // ── No active order ──
  if (!activeOrder) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.04] border border-white/[0.06]">
          <Inbox className="h-8 w-8 text-muted-foreground" />
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
            {t("consumer_qr_order")} <span className="font-bold text-primary">#{String(activeOrder.order_number).padStart(3, "0")}</span>
          </p>
        </div>

        {/* Greyed out QR */}
        <div className="rounded-3xl border border-border/40 bg-card/50 p-6 opacity-40 grayscale">
          <div className="rounded-2xl bg-white p-3">
            <QRCodeSVG value={activeOrder.qr_token} size={160} level="H" bgColor="#ffffff" fgColor="#0A0A0A" />
          </div>
        </div>

        {/* Summary */}
        <OrderSummary items={activeOrder.items} total={activeOrder.total} />

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

      {/* Order number */}
      <div className="text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
          {t("consumer_qr_order")}
        </p>
        <p className="text-2xl font-extrabold text-primary">
          #{String(activeOrder.order_number).padStart(3, "0")}
        </p>
      </div>

      {/* QR Code */}
      <div
        className={cn(
          "relative rounded-3xl border bg-card p-6 transition-all",
          isReady
            ? "border-success/40 shadow-[0_0_60px_hsl(145_100%_39%/0.2)]"
            : "border-border/60"
        )}
      >
        <div className="rounded-2xl bg-white p-4">
          <QRCodeSVG
            value={activeOrder.qr_token}
            size={220}
            level="H"
            bgColor="#ffffff"
            fgColor="#0A0A0A"
          />
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {t("consumer_qr_show_counter")}
        </p>
      </div>

      {/* Vertical timeline */}
      <div className="w-full px-2">
        <div className="flex flex-col gap-0">
          {timelineSteps.map((step, i) => {
            const isPast = currentStep > i;
            const isCurrent = currentStep === i;
            const isFuture = currentStep < i;
            const StepIcon = step.icon;

            return (
              <div key={step.key} className="flex items-start gap-3">
                {/* Line + dot */}
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full transition-all shrink-0",
                      isPast && "bg-success/20 border-2 border-success",
                      isCurrent && "bg-primary/20 border-2 border-primary shadow-[0_0_16px_hsl(24,100%,50%,0.3)] scale-110",
                      isFuture && "bg-secondary border-2 border-white/10"
                    )}
                  >
                    <StepIcon
                      className={cn(
                        "h-4 w-4",
                        isPast && "text-success",
                        isCurrent && "text-primary",
                        isFuture && "text-muted-foreground/40"
                      )}
                    />
                  </div>
                  {i < timelineSteps.length - 1 && (
                    <div
                      className={cn(
                        "w-0.5 h-8",
                        isPast ? "bg-success/40" : isCurrent ? "bg-primary/30" : "bg-white/[0.06]"
                      )}
                    />
                  )}
                </div>

                {/* Label */}
                <div className="pt-1.5">
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      isPast && "text-success",
                      isCurrent && "text-primary",
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

      {/* Order summary */}
      <OrderSummary items={activeOrder.items} total={activeOrder.total} />
    </div>
  );
}

function OrderSummary({ items, total }: { items: { name: string; quantity: number; unit_price: number }[]; total: number }) {
  return (
    <div className="w-full rounded-2xl border border-border/60 bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">Resumo do Pedido</h3>
      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {item.quantity}x {item.name}
            </span>
            <span className="text-sm font-medium text-foreground">
              R$ {(item.quantity * item.unit_price).toFixed(2)}
            </span>
          </div>
        ))}
        <div className="mt-2 border-t border-border/40 pt-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Total</span>
          <span className="text-base font-bold text-primary">R$ {total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
