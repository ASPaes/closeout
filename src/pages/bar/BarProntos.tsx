import { useEffect, useState, useCallback, useRef } from "react";
import { PageHeader } from "@/components/PageHeader";
import { BarEventGuard } from "@/components/BarEventGuard";
import { useBar } from "@/contexts/BarContext";
import { useTranslation } from "@/i18n/use-translation";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PackageCheck, Clock, Smartphone, User, Monitor, AlertTriangle, Volume2, VolumeX, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReadyOrder {
  id: string;
  order_number: number;
  origin: string;
  ready_at: string | null;
  created_at: string;
  event_id: string;
  waiter_id: string | null;
  order_items: { id: string; name: string; quantity: number }[];
}

function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = "sine";
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    setTimeout(() => ctx.close(), 500);
  } catch {
    // Web Audio not supported
  }
}

const originIcons: Record<string, any> = { app: Smartphone, waiter: User, cashier: Monitor };
const originLabels: Record<string, string> = { app: "App", waiter: "Garçom", cashier: "Caixa" };

function getReadySince(readyAt: string | null, createdAt: string) {
  const ref = readyAt || createdAt;
  const diffMs = Date.now() - new Date(ref).getTime();
  const min = Math.floor(diffMs / 60000);
  const sec = Math.floor(diffMs / 1000);
  return { min, sec, diffMs };
}

export default function BarProntos() {
  const { t } = useTranslation();
  const { eventId } = useBar();
  const [orders, setOrders] = useState<ReadyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [, setTick] = useState(0);
  const prevCountRef = useRef(0);
  const alertMinutes = 10; // fallback, could come from event_settings

  // Tick every 15s for time updates
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!eventId) return;
    const { data } = await supabase
      .from("orders")
      .select("id, order_number, origin, ready_at, created_at, event_id, waiter_id, order_items(id, name, quantity)")
      .eq("event_id", eventId)
      .eq("status", "ready")
      .order("ready_at", { ascending: true });
    if (data) {
      const newOrders = data as unknown as ReadyOrder[];
      // Play beep if count increased
      if (soundEnabled && newOrders.length > prevCountRef.current && prevCountRef.current >= 0) {
        playBeep();
      }
      prevCountRef.current = newOrders.length;
      setOrders(newOrders);
    }
    setLoading(false);
  }, [eventId, soundEnabled]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Realtime
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`bar-ready-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `event_id=eq.${eventId}` },
        (payload) => {
          const oldRecord = payload.old as any;
          const newRecord = payload.new as any;
          // Animate out if status changed from ready to delivered
          if (payload.eventType === "UPDATE" && oldRecord?.status === "ready" && newRecord?.status === "delivered") {
            setRemovingIds((prev) => new Set(prev).add(oldRecord.id));
            setTimeout(() => {
              setRemovingIds((prev) => { const n = new Set(prev); n.delete(oldRecord.id); return n; });
              fetchOrders();
            }, 500);
            return;
          }
          fetchOrders();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId, fetchOrders]);

  return (
    <BarEventGuard>
      <div className="space-y-6">
        {/* Header with sound toggle */}
        <div className="flex items-center justify-between">
          <PageHeader title={t("bar_ready")} subtitle={t("bar_ready_desc")} icon={PackageCheck} />
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "gap-2 h-9 border-border/60",
              soundEnabled ? "text-primary border-primary/40" : "text-muted-foreground"
            )}
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            <span className="hidden sm:inline text-xs">
              {soundEnabled ? t("bar_sound_on") : t("bar_sound_off")}
            </span>
          </Button>
        </div>

        {/* Count banner */}
        <div className="flex items-center gap-3 rounded-lg bg-primary/10 border border-primary/20 px-5 py-4">
          <span className="text-3xl font-bold text-primary">{orders.length}</span>
          <span className="text-sm font-medium text-primary/80">{t("bar_ready_waiting")}</span>
        </div>

        {/* Cards grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
              <PackageCheck className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-base font-medium text-muted-foreground">{t("bar_ready_empty")}</p>
            <p className="text-sm text-muted-foreground/60">{t("bar_ready_empty_desc")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {orders.map((order) => (
              <ReadyCard
                key={order.id}
                order={order}
                removing={removingIds.has(order.id)}
                alertMinutes={alertMinutes}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </BarEventGuard>
  );
}

function ReadyCard({ order, removing, alertMinutes, t }: {
  order: ReadyOrder;
  removing: boolean;
  alertMinutes: number;
  t: (key: any) => string;
}) {
  const { min, sec } = getReadySince(order.ready_at, order.created_at);
  const isAlert = min >= alertMinutes;
  const OriginIcon = originIcons[order.origin] || Smartphone;
  const timeText = min > 0 ? `${min} ${t("bar_min")}` : `${sec} ${t("bar_sec")}`;

  return (
    <Card className={cn(
      "p-6 border bg-card border-border/60 transition-all duration-500",
      isAlert && "border-destructive/60 shadow-[0_0_20px_-4px] shadow-destructive/30 animate-pulse",
      removing && "opacity-0 scale-95 translate-y-2"
    )}>
      {/* Order number — large and prominent */}
      <div className="flex items-start justify-between mb-4">
        <span className="text-4xl font-bold text-primary">
          #{String(order.order_number).padStart(3, "0")}
        </span>
        {isAlert && (
          <div className="flex items-center gap-1.5 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
        )}
      </div>

      {/* Origin */}
      <div className="mb-4">
        <Badge variant="outline" className="gap-1.5 text-xs border-border/40 text-muted-foreground">
          <OriginIcon className="h-3.5 w-3.5" />
          {originLabels[order.origin] || order.origin}
        </Badge>
      </div>

      {/* Items */}
      <div className="space-y-1.5 mb-4">
        {order.order_items.map((item) => (
          <div key={item.id} className="flex items-center gap-2 text-sm">
            <span className="text-foreground font-semibold">{item.quantity}x</span>
            <span className="text-muted-foreground truncate">{item.name}</span>
          </div>
        ))}
        {order.order_items.length === 0 && (
          <p className="text-xs text-muted-foreground/50 italic">—</p>
        )}
      </div>

      {/* Time since ready */}
      <div className={cn(
        "flex items-center gap-2 pt-3 border-t border-border/30",
        isAlert ? "text-destructive" : "text-muted-foreground"
      )}>
        <Clock className="h-4 w-4" />
        <span className="text-sm font-medium">
          {t("bar_ready_since")} {timeText}
        </span>
      </div>
    </Card>
  );
}
