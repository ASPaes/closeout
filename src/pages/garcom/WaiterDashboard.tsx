import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/i18n/use-translation";
import { WaiterSessionGuard } from "@/components/WaiterSessionGuard";
import { useWaiter } from "@/contexts/WaiterContext";
import { supabase } from "@/integrations/supabase/client";
import { vibrate } from "@/lib/native-bridge";
import {
  Bell,
  PlusCircle,
  UserX,
  ScanLine,
  ChefHat,
  Banknote,
  Clock,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Metrics = {
  pendingCalls: number;
  ordersInProgress: number;
  ordersReady: number;
  cashInHand: number;
};

type RecentOrder = {
  id: string;
  order_number: number;
  status: string;
  created_at: string;
  total: number;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  return `${Math.floor(mins / 60)}h`;
}

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  preparing: "Preparando",
  ready: "Pronto",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400",
  paid: "bg-blue-500/20 text-blue-400",
  preparing: "bg-orange-500/20 text-orange-400",
  ready: "bg-green-500/20 text-green-400",
  delivered: "bg-white/10 text-white/60",
  cancelled: "bg-red-500/20 text-red-400",
};

export default function WaiterDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { waiterName, eventName, eventId, waiterId, pendingCallsCount, cashCollected, assignmentType, assignmentValue, sessionId } = useWaiter();

  const [metrics, setMetrics] = useState<Metrics>({
    pendingCalls: 0,
    ordersInProgress: 0,
    ordersReady: 0,
    cashInHand: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const prevReadyRef = useRef(0);

  const fetchMetrics = useCallback(async () => {
    if (!eventId || !waiterId) return;

    // Orders by this waiter in this event
    const { data: orders } = await supabase
      .from("orders")
      .select("id, status, order_number, created_at, total")
      .eq("event_id", eventId)
      .eq("waiter_id", waiterId)
      .not("status", "in", '("cancelled","delivered")');

    const inProgress = orders?.filter((o) => ["pending", "paid", "preparing"].includes(o.status)).length || 0;
    const ready = orders?.filter((o) => o.status === "ready").length || 0;

    // Vibrate when new ready orders appear
    if (ready > prevReadyRef.current && prevReadyRef.current >= 0) {
      vibrate(200);
    }
    prevReadyRef.current = ready;

    setMetrics({
      pendingCalls: pendingCallsCount,
      ordersInProgress: inProgress,
      ordersReady: ready,
      cashInHand: cashCollected,
    });

    // Recent 3 orders
    const { data: recent } = await supabase
      .from("orders")
      .select("id, order_number, status, created_at, total")
      .eq("event_id", eventId)
      .eq("waiter_id", waiterId)
      .order("created_at", { ascending: false })
      .limit(3);

    setRecentOrders((recent as RecentOrder[]) || []);
  }, [eventId, waiterId, pendingCallsCount, cashCollected]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Realtime on orders
  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel("waiter-dash-orders-" + eventId)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `event_id=eq.${eventId}`,
      }, () => {
        fetchMetrics();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId, fetchMetrics]);

  const metricCards = [
    {
      label: t("waiter_pending_calls"),
      value: metrics.pendingCalls,
      icon: Bell,
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10",
      badge: metrics.pendingCalls > 0,
    },
    {
      label: "Em andamento",
      value: metrics.ordersInProgress,
      icon: Clock,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      badge: false,
    },
    {
      label: "Prontos",
      value: metrics.ordersReady,
      icon: ChefHat,
      color: "text-green-400",
      bgColor: "bg-green-500/10",
      badge: metrics.ordersReady > 0,
    },
    {
      label: t("waiter_cash_collected"),
      value: `R$ ${metrics.cashInHand.toFixed(2)}`,
      icon: Banknote,
      color: "text-muted-foreground",
      bgColor: "bg-white/[0.04]",
      badge: false,
      isCurrency: true,
    },
  ];

  const quickActions = [
    { label: t("waiter_new_order"), icon: PlusCircle, path: "/garcom/pedido" },
    { label: t("waiter_anonymous_order"), icon: UserX, path: "/garcom/pedido-avulso" },
    { label: t("waiter_qr_reader"), icon: ScanLine, path: "/garcom/qr" },
    { label: t("waiter_calls"), icon: Bell, path: "/garcom/chamados", badge: metrics.pendingCalls },
  ];

  return (
    <WaiterSessionGuard>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">
              Olá, {waiterName?.split(" ")[0] || "Garçom"} 👋
            </h1>
            {sessionId && (
              <span className="rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-semibold text-success">
                Ativo
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            {eventName && (
              <span className="text-sm text-muted-foreground">{eventName}</span>
            )}
            {assignmentType && (
              <span className="text-xs text-muted-foreground/60">
                •{" "}
                {assignmentType === "tables"
                  ? `${t("waiter_tables")}${assignmentValue ? `: ${assignmentValue}` : ""}`
                  : assignmentType === "sector"
                  ? `${t("waiter_sector")}${assignmentValue ? `: ${assignmentValue}` : ""}`
                  : t("waiter_free")}
              </span>
            )}
          </div>
        </div>

        {/* Metrics 2x2 */}
        <div className="grid grid-cols-2 gap-3">
          {metricCards.map((card) => (
            <div
              key={card.label}
              className="relative rounded-xl border border-white/[0.06] bg-white/[0.03] p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", card.bgColor)}>
                  <card.icon className={cn("h-4 w-4", card.color)} />
                </div>
              </div>
              <p className={cn("text-2xl font-bold", card.isCurrency ? "text-foreground" : card.color)}>
                {card.value}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">{card.label}</p>
              {card.badge && (
                <span className="absolute right-3 top-3 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Ações rápidas
          </p>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className="relative flex h-14 items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 active:scale-[0.97] active:bg-white/[0.06] transition-all"
              >
                <action.icon className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-foreground">{action.label}</span>
                {action.badge && action.badge > 0 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                    {action.badge > 9 ? "9+" : action.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Recent orders */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Últimos pedidos
            </p>
            <button
              onClick={() => navigate("/garcom/pedidos")}
              className="text-xs font-medium text-primary active:opacity-70"
            >
              Ver todos
            </button>
          </div>

          {recentOrders.length === 0 ? (
            <div className="flex h-24 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
              <p className="text-sm text-muted-foreground">Nenhum pedido ainda</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentOrders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => navigate("/garcom/pedidos")}
                  className="flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-foreground">
                      #{String(order.order_number).padStart(3, "0")}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        statusColors[order.status] || "bg-white/10 text-white/60"
                      )}
                    >
                      {statusLabels[order.status] || order.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{timeAgo(order.created_at)}</p>
                      <p className="text-xs font-medium text-foreground">
                        R$ {Number(order.total).toFixed(2)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </WaiterSessionGuard>
  );
}
