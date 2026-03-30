import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { BarEventGuard } from "@/components/BarEventGuard";
import { useBar } from "@/contexts/BarContext";
import { useTranslation } from "@/i18n/use-translation";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTION } from "@/config/audit-actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ClipboardList, Clock, Smartphone, User, Monitor, ChefHat,
  PackageCheck, Truck, Loader2, Package, Check, QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type OrderStatus = Database["public"]["Enums"]["order_status"];
type OrderOrigin = Database["public"]["Enums"]["order_origin"];

interface OrderItemWithDelivery {
  id: string;
  name: string;
  quantity: number;
  delivered_quantity: number;
}

interface OrderWithItems {
  id: string;
  order_number: number;
  status: OrderStatus;
  origin: OrderOrigin;
  created_at: string;
  preparing_at: string | null;
  ready_at: string | null;
  event_id: string;
  client_id: string;
  consumer_id: string | null;
  order_items: OrderItemWithDelivery[];
}

const ACTIVE_STATUSES: OrderStatus[] = ["paid", "preparing", "ready", "partially_delivered"];

type FilterStatus = "all" | "paid" | "preparing" | "ready" | "partially_delivered";
type FilterOrigin = "all" | "app" | "waiter" | "cashier";

export default function BarFilaPedidos() {
  const { t } = useTranslation();
  const { eventId } = useBar();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [deliveredCount, setDeliveredCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterOrigin, setFilterOrigin] = useState<FilterOrigin>("all");
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const [, setTick] = useState(0);

  // Force re-render every 30s for waiting time
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!eventId) return;
    const { data } = await supabase
      .from("orders")
      .select("id, order_number, status, origin, created_at, preparing_at, ready_at, event_id, client_id, consumer_id, order_items(id, name, quantity, delivered_quantity)")
      .eq("event_id", eventId)
      .in("status", ACTIVE_STATUSES)
      .order("created_at", { ascending: true });
    if (data) setOrders(data as unknown as OrderWithItems[]);
    setLoading(false);
  }, [eventId]);

  const fetchDeliveredCount = useCallback(async () => {
    if (!eventId) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "delivered")
      .gte("delivered_at", todayStart.toISOString());
    setDeliveredCount(count ?? 0);
  }, [eventId]);

  useEffect(() => {
    fetchOrders();
    fetchDeliveredCount();
  }, [fetchOrders, fetchDeliveredCount]);

  // Realtime subscription
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`bar-orders-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `event_id=eq.${eventId}` },
        (payload) => {
          const newRecord = payload.new as any;
          if (payload.eventType === "INSERT" && ACTIVE_STATUSES.includes(newRecord?.status)) {
            setNewOrderIds((prev) => new Set(prev).add(newRecord.id));
            setTimeout(() => setNewOrderIds((prev) => { const next = new Set(prev); next.delete(newRecord.id); return next; }), 2000);
          }
          fetchOrders();
          fetchDeliveredCount();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId, fetchOrders, fetchDeliveredCount]);

  const updateStatus = async (order: OrderWithItems, newStatus: "preparing" | "ready") => {
    setUpdatingIds((prev) => new Set(prev).add(order.id));
    const updateData: Record<string, unknown> = { status: newStatus };
    if (newStatus === "preparing") updateData.preparing_at = new Date().toISOString();
    if (newStatus === "ready") updateData.ready_at = new Date().toISOString();

    const { error } = await supabase.from("orders").update(updateData).eq("id", order.id);
    if (error) {
      toast.error(error.message);
    } else {
      const auditAction = newStatus === "preparing" ? AUDIT_ACTION.BAR_ORDER_PREPARING : AUDIT_ACTION.BAR_ORDER_READY;
      await logAudit({
        action: auditAction,
        entityType: "order",
        entityId: order.id,
        newData: { status: newStatus, order_number: order.order_number },
      });
      toast.success(newStatus === "preparing" ? t("bar_order_preparing_success") : t("bar_order_ready_success"));
      fetchOrders();
      fetchDeliveredCount();
    }
    setUpdatingIds((prev) => { const next = new Set(prev); next.delete(order.id); return next; });
  };

  // Counts
  const awaitingCount = orders.filter((o) => o.status === "paid").length;
  const preparingCount = orders.filter((o) => o.status === "preparing").length;
  const readyCount = orders.filter((o) => o.status === "ready").length;
  const partialCount = orders.filter((o) => o.status === "partially_delivered").length;

  // Queue orders (exclude partially_delivered from queue tab)
  const queueOrders = orders.filter((o) => o.status !== "partially_delivered");
  const filteredQueue = queueOrders.filter((o) => {
    if (filterStatus !== "all" && filterStatus !== "partially_delivered" && o.status !== filterStatus) return false;
    if (filterOrigin !== "all" && o.origin !== filterOrigin) return false;
    return true;
  });

  // Partial orders
  const partialOrders = orders.filter((o) => o.status === "partially_delivered");

  return (
    <BarEventGuard>
      <div className="space-y-5">
        <PageHeader title={t("bar_queue")} subtitle={t("bar_queue_desc")} icon={ClipboardList} />

        {/* Metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <MetricCard label={t("bar_awaiting")} count={awaitingCount} variant="warning" icon={Clock} />
          <MetricCard label={t("bar_preparing_count")} count={preparingCount} variant="info" icon={ChefHat} />
          <MetricCard label={t("bar_ready_count")} count={readyCount} variant="success" pulse icon={PackageCheck} />
          <MetricCard label={t("bar_partial_tab")} count={partialCount} variant="partial" icon={Package} />
          <MetricCard label={t("bar_delivered_today")} count={deliveredCount} variant="muted" icon={Truck} />
        </div>

        {/* Tabs: Queue / Partial */}
        <Tabs defaultValue="queue" className="w-full">
          <TabsList className="w-full grid grid-cols-2 bg-secondary/50 border border-border/40">
            <TabsTrigger value="queue" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <ClipboardList className="h-4 w-4" />
              {t("bar_queue_tab")}
              {queueOrders.length > 0 && (
                <Badge variant="outline" className="ml-1 h-5 px-1.5 text-[10px] border-current">
                  {queueOrders.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="partial" className="gap-2 data-[state=active]:bg-warning data-[state=active]:text-warning-foreground">
              <Package className="h-4 w-4" />
              {t("bar_partial_tab")}
              {partialCount > 0 && (
                <Badge variant="outline" className="ml-1 h-5 px-1.5 text-[10px] border-current animate-pulse">
                  {partialCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Queue Tab ── */}
          <TabsContent value="queue" className="mt-4 space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <FilterGroup
                options={[
                  { key: "all", label: t("bar_all") },
                  { key: "paid", label: t("bar_awaiting") },
                  { key: "preparing", label: t("bar_preparing") },
                  { key: "ready", label: t("bar_ready_status") },
                ]}
                value={filterStatus}
                onChange={(v) => setFilterStatus(v as FilterStatus)}
              />
              <div className="w-px bg-border/40 mx-1 hidden sm:block" />
              <FilterGroup
                options={[
                  { key: "all", label: t("bar_all") },
                  { key: "app", label: t("bar_origin_app") },
                  { key: "waiter", label: t("bar_origin_waiter") },
                  { key: "cashier", label: t("bar_origin_cashier") },
                ]}
                value={filterOrigin}
                onChange={(v) => setFilterOrigin(v as FilterOrigin)}
              />
            </div>

            {/* Order cards */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredQueue.length === 0 ? (
              <EmptyQueue t={t} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredQueue.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    isNew={newOrderIds.has(order.id)}
                    isUpdating={updatingIds.has(order.id)}
                    onUpdateStatus={updateStatus}
                    t={t}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Partial Deliveries Tab ── */}
          <TabsContent value="partial" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : partialOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">{t("bar_no_partial")}</p>
                <p className="text-xs text-muted-foreground/70">{t("bar_no_partial_desc")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {partialOrders.map((order) => (
                  <PartialOrderCard key={order.id} order={order} t={t} onNavigateQr={() => navigate("/bar/qr")} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </BarEventGuard>
  );
}

/* ─── Sub-components ─── */

function EmptyQueue({ t }: { t: (key: any) => string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
        <ClipboardList className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{t("bar_no_orders")}</p>
      <p className="text-xs text-muted-foreground/70">{t("bar_no_orders_desc")}</p>
    </div>
  );
}

function MetricCard({ label, count, variant, pulse, icon: Icon }: {
  label: string; count: number; variant: "warning" | "info" | "success" | "muted" | "partial"; pulse?: boolean; icon: any;
}) {
  const colorMap = {
    warning: "text-warning bg-warning/10 border-warning/20",
    info: "text-info bg-info/10 border-info/20",
    success: "text-success bg-success/10 border-success/20",
    muted: "text-muted-foreground bg-muted border-border/40",
    partial: "text-warning bg-warning/10 border-warning/20",
  };

  return (
    <Card className={cn("p-4 border bg-card/80 backdrop-blur-sm", colorMap[variant])}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium opacity-80">{label}</p>
          <p className={cn("text-2xl font-bold mt-1", pulse && count > 0 && "animate-pulse")}>{count}</p>
        </div>
        <Icon className="h-5 w-5 opacity-60" />
      </div>
    </Card>
  );
}

function FilterGroup({ options, value, onChange }: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1">
      {options.map((opt) => (
        <Button
          key={opt.key}
          variant={value === opt.key ? "default" : "outline"}
          size="sm"
          className={cn(
            "h-8 text-xs",
            value === opt.key ? "bg-primary text-primary-foreground" : "bg-card/50 border-border/60 text-muted-foreground hover:text-foreground"
          )}
          onClick={() => onChange(opt.key)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}

function getWaitingInfo(createdAt: string) {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffSec = Math.floor(diffMs / 1000);
  const level = diffMin >= 10 ? "danger" : diffMin >= 5 ? "warning" : "ok";
  return { diffMin, diffSec, level };
}

const originIcons: Record<string, any> = {
  app: Smartphone,
  waiter: User,
  cashier: Monitor,
};

const originLabels: Record<string, string> = {
  app: "App",
  waiter: "Garçom",
  cashier: "Caixa",
};

const statusToBadge: Record<string, "draft" | "active" | "completed" | "cancelled" | "inactive"> = {
  pending: "draft",
  paid: "draft",
  preparing: "active",
  ready: "completed",
  partially_delivered: "draft",
};

function OrderCard({ order, isNew, isUpdating, onUpdateStatus, t }: {
  order: OrderWithItems;
  isNew: boolean;
  isUpdating: boolean;
  onUpdateStatus: (order: OrderWithItems, status: "preparing" | "ready") => void;
  t: (key: any) => string;
}) {
  const { diffMin, diffSec, level } = getWaitingInfo(order.created_at);
  const OriginIcon = originIcons[order.origin] || Smartphone;
  const waitText = diffMin > 0
    ? `${t("bar_ago")} ${diffMin} ${t("bar_min")}`
    : `${t("bar_ago")} ${diffSec} ${t("bar_sec")}`;

  const levelColors = {
    ok: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  };

  const statusLabel: Record<string, string> = {
    pending: t("bar_awaiting"),
    paid: t("bar_awaiting"),
    preparing: t("bar_preparing"),
    ready: t("bar_ready_status"),
  };

  return (
    <Card className={cn(
      "p-4 border bg-card border-border/60 transition-all duration-300",
      level === "danger" && "border-destructive/50 shadow-[0_0_12px_-3px] shadow-destructive/20",
      isNew && "animate-in slide-in-from-top-2 fade-in duration-500"
    )}>
      {/* Header: number + origin + time */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-foreground">
            #{String(order.order_number).padStart(3, "0")}
          </span>
          <Badge variant="outline" className="gap-1 text-[10px] border-border/40 text-muted-foreground">
            <OriginIcon className="h-3 w-3" />
            {originLabels[order.origin] || order.origin}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className={cn("h-3.5 w-3.5", levelColors[level])} />
          <span className={cn("text-xs font-medium", levelColors[level])}>
            {waitText}
          </span>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-1 mb-3">
        {order.order_items.map((item) => (
          <div key={item.id} className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="text-foreground font-medium">{item.quantity}x</span>
            <span className="truncate">{item.name}</span>
          </div>
        ))}
        {order.order_items.length === 0 && (
          <p className="text-xs text-muted-foreground/50 italic">—</p>
        )}
      </div>

      {/* Footer: status + action */}
      <div className="flex items-center justify-between pt-2 border-t border-border/30">
        <StatusBadge
          status={statusToBadge[order.status] ?? "inactive"}
          label={statusLabel[order.status] ?? order.status}
        />
        {(order.status === "paid" || order.status === "pending") && (
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => onUpdateStatus(order, "preparing")}
            disabled={isUpdating}
          >
            {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChefHat className="h-3.5 w-3.5" />}
            {t("bar_start_preparing")}
          </Button>
        )}
        {order.status === "preparing" && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5 border-success/40 text-success hover:bg-success/10 hover:text-success"
            onClick={() => onUpdateStatus(order, "ready")}
            disabled={isUpdating}
          >
            {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PackageCheck className="h-3.5 w-3.5" />}
            {t("bar_mark_ready")}
          </Button>
        )}
      </div>
    </Card>
  );
}

/* ── Partial Delivery Card ── */
function PartialOrderCard({ order, t, onNavigateQr }: {
  order: OrderWithItems;
  t: (key: any) => string;
  onNavigateQr: () => void;
}) {
  const OriginIcon = originIcons[order.origin] || Smartphone;
  const totalQty = order.order_items.reduce((s, i) => s + i.quantity, 0);
  const deliveredQty = order.order_items.reduce((s, i) => s + (i.delivered_quantity || 0), 0);
  const pendingQty = totalQty - deliveredQty;

  return (
    <Card className="p-4 border border-warning/40 bg-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-foreground">
            #{String(order.order_number).padStart(3, "0")}
          </span>
          <Badge variant="outline" className="gap-1 text-[10px] border-border/40 text-muted-foreground">
            <OriginIcon className="h-3 w-3" />
            {originLabels[order.origin] || order.origin}
          </Badge>
        </div>
        <Badge className="bg-warning/15 text-warning border-warning/30 text-[10px]">
          {t("bar_partial_tab")}
        </Badge>
      </div>

      {/* Summary */}
      <div className="rounded-xl bg-warning/5 border border-warning/20 p-3 mb-3">
        <p className="text-sm font-semibold text-warning">
          {deliveredQty} {t("bar_of")} {totalQty} {t("bar_partial_items_delivered")}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {pendingQty} {t("bar_partial_items_pending")}
        </p>
      </div>

      {/* Items with progress */}
      <div className="space-y-3 mb-4">
        {order.order_items.map((item) => {
          const del = item.delivered_quantity || 0;
          const qty = item.quantity;
          const isComplete = del >= qty;
          const pct = qty > 0 ? Math.round((del / qty) * 100) : 0;

          return (
            <div key={item.id} className={cn("flex flex-col gap-1.5", isComplete && "opacity-60")}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground flex items-center gap-1.5">
                  {isComplete && <Check className="h-3.5 w-3.5 text-success shrink-0" />}
                  {qty}x {item.name}
                </span>
                <span className={cn(
                  "text-xs font-medium",
                  isComplete ? "text-success" : del > 0 ? "text-warning" : "text-muted-foreground/60"
                )}>
                  {isComplete ? t("bar_qr_fully_delivered_item") : `${del} ${t("bar_of")} ${qty}`}
                </span>
              </div>
              <Progress
                value={pct}
                className={cn(
                  "h-1.5",
                  isComplete ? "[&>div]:bg-success" : del > 0 ? "[&>div]:bg-warning" : "[&>div]:bg-muted-foreground/20"
                )}
              />
            </div>
          );
        })}
      </div>

      {/* Action */}
      <Button
        className="w-full h-10 gap-2 bg-warning/15 text-warning border border-warning/30 hover:bg-warning/25"
        variant="outline"
        onClick={onNavigateQr}
      >
        <QrCode className="h-4 w-4" />
        {t("bar_partial_deliver_rest")}
      </Button>
    </Card>
  );
}
