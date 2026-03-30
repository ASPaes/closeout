import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "@/i18n/use-translation";
import { WaiterSessionGuard } from "@/components/WaiterSessionGuard";
import { useWaiter } from "@/contexts/WaiterContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTION } from "@/config/audit-actions";
import { vibrate } from "@/lib/native-bridge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ClipboardList, ScanLine, Loader2, PackageX,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

type OrderRow = {
  id: string;
  order_number: number;
  status: string;
  total: number;
  payment_method: string | null;
  consumer_id: string | null;
  created_at: string;
  items: Array<{ name: string; quantity: number; delivered_quantity: number }>;
  consumer_name: string | null;
};

const FILTERS = ["all", "preparing", "ready", "partial", "delivered"] as const;
type Filter = typeof FILTERS[number];

const FILTER_LABELS: Record<Filter, string> = {
  all: "Todos",
  preparing: "Em Preparo",
  ready: "Prontos",
  partial: "Parciais",
  delivered: "Entregues",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  return `${Math.floor(mins / 60)}h${mins % 60}min`;
}

function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pendente", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25" },
    paid: { label: "Pago", cls: "bg-blue-500/15 text-blue-400 border-blue-500/25" },
    preparing: { label: "Preparando", cls: "bg-orange-500/15 text-orange-400 border-orange-500/25" },
    ready: { label: "Pronto", cls: "bg-green-500/15 text-green-400 border-green-500/25" },
    partially_delivered: { label: "Entrega Parcial", cls: "bg-warning/15 text-warning border-warning/25" },
    delivered: { label: "Entregue", cls: "bg-muted text-muted-foreground border-border" },
    cancelled: { label: "Cancelado", cls: "bg-destructive/15 text-destructive border-destructive/25" },
  };
  const cfg = map[status] || { label: status, cls: "bg-muted text-muted-foreground border-border" };
  return <Badge variant="outline" className={cfg.cls}>{cfg.label}</Badge>;
}

export default function WaiterPedidos() {
  const { t } = useTranslation();
  const { eventId } = useWaiter();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const prevReadyIdsRef = useRef<Set<string>>(new Set());

  const fetchOrders = useCallback(async () => {
    if (!user?.id || !eventId) return;
    const { data } = await supabase
      .from("orders")
      .select("id, order_number, status, total, payment_method, consumer_id, created_at")
      .eq("event_id", eventId)
      .eq("waiter_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!data) { setLoading(false); return; }

    const enriched: OrderRow[] = await Promise.all(
      (data as any[]).map(async (o) => {
        const { data: items } = await supabase
          .from("order_items")
          .select("name, quantity, delivered_quantity")
          .eq("order_id", o.id);

        let consumerName: string | null = null;
        if (o.consumer_id) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("name")
            .eq("id", o.consumer_id)
            .single();
          consumerName = prof?.name || null;
        }

        return {
          ...o,
          items: (items as any[]) || [],
          consumer_name: consumerName,
        };
      })
    );

    // Detect newly ready orders
    const newReadyIds = new Set(enriched.filter(o => o.status === "ready").map(o => o.id));
    for (const id of newReadyIds) {
      if (!prevReadyIdsRef.current.has(id)) {
        const order = enriched.find(o => o.id === id);
        if (order) {
          vibrate(200);
          toast({
            title: `Pedido #${String(order.order_number).padStart(3, "0")} pronto!`,
            description: "Retire no bar",
          });
        }
      }
    }
    prevReadyIdsRef.current = newReadyIds;

    setOrders(enriched);
    setLoading(false);
  }, [user?.id, eventId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Realtime
  useEffect(() => {
    if (!eventId || !user?.id) return;
    const channel = supabase
      .channel("waiter-orders-" + eventId)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "orders",
        filter: `event_id=eq.${eventId}`,
      }, () => fetchOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId, user?.id, fetchOrders]);

  const filtered = orders.filter(o => {
    if (filter === "all") return true;
    if (filter === "preparing") return ["paid", "pending", "preparing"].includes(o.status);
    if (filter === "ready") return o.status === "ready";
    if (filter === "delivered") return o.status === "delivered";
    return true;
  });

  const handleCancel = async () => {
    if (!cancelOrderId || !cancelReason.trim()) return;
    setCancelling(true);
    try {
      const { data, error } = await supabase.rpc("request_waiter_cancellation", {
        p_order_id: cancelOrderId,
        p_reason: cancelReason.trim(),
      });
      if (error) throw error;
      const res = data as any;
      if (res?.ok === false) {
        toast({ title: "Erro", description: res.error || "Não foi possível solicitar", variant: "destructive" });
      } else {
        await logAudit({
          action: AUDIT_ACTION.WAITER_CANCELLATION_REQUESTED,
          entityType: "order",
          entityId: cancelOrderId,
          metadata: { reason: cancelReason.trim() },
        });
        toast({ title: "Solicitação enviada ao gestor" });
        setCancelOrderId(null);
        setCancelReason("");
        fetchOrders();
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  };

  const paymentLabel = (m: string | null) => {
    if (!m) return "";
    const map: Record<string, string> = {
      cash: "Dinheiro", pix: "PIX", pos: "Maquininha",
      credit_card: "Crédito", debit_card: "Débito",
    };
    return map[m] || m;
  };

  return (
    <WaiterSessionGuard>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-foreground">{t("waiter_orders")}</h1>

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/40 text-muted-foreground"
              }`}
            >
              {FILTER_LABELS[f]}
              {f !== "all" && (
                <span className="ml-1 opacity-70">
                  ({orders.filter(o => {
                    if (f === "preparing") return ["paid", "pending", "preparing"].includes(o.status);
                    if (f === "ready") return o.status === "ready";
                    if (f === "delivered") return o.status === "delivered";
                    return false;
                  }).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <ClipboardList className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-sm">Nenhum pedido encontrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(order => {
              const isReady = order.status === "ready";
              const canCancel = ["paid", "pending"].includes(order.status);
              return (
                <Card
                  key={order.id}
                  className={`border ${
                    isReady
                      ? "border-green-500/50 bg-green-500/10"
                      : "border-border/40 bg-card/60"
                  }`}
                >
                  <CardContent className="p-4 space-y-2">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground">
                          #{String(order.order_number).padStart(3, "0")}
                        </span>
                        <OrderStatusBadge status={order.status} />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {timeAgo(order.created_at)}
                      </span>
                    </div>

                    {/* Client */}
                    <p className="text-sm text-muted-foreground">
                      {order.consumer_name || "Avulso"}
                    </p>

                    {/* Items */}
                    <p className="text-sm text-foreground/80 line-clamp-2">
                      {order.items.map(i => `${i.quantity}x ${i.name}`).join(", ")}
                    </p>

                    {/* Total + payment */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-foreground">
                        R$ {Number(order.total).toFixed(2)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {paymentLabel(order.payment_method)}
                      </span>
                    </div>

                    {/* Actions */}
                    {isReady && (
                      <Button
                        className="w-full h-12 mt-1"
                        onClick={() => navigate("/garcom/leitor-qr")}
                      >
                        <ScanLine className="h-4 w-4 mr-2" />
                        Ir Retirar
                      </Button>
                    )}
                    {canCancel && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-destructive border-destructive/30"
                        onClick={() => setCancelOrderId(order.id)}
                      >
                        <PackageX className="h-4 w-4 mr-2" />
                        {t("waiter_request_cancellation")}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Cancel modal */}
        <Dialog open={!!cancelOrderId} onOpenChange={(o) => !o && setCancelOrderId(null)}>
          <DialogContent className="max-w-[360px]">
            <DialogHeader>
              <DialogTitle>{t("waiter_request_cancellation")}</DialogTitle>
            </DialogHeader>
            <Textarea
              placeholder="Motivo do cancelamento (obrigatório)"
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              className="min-h-[100px]"
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => { setCancelOrderId(null); setCancelReason(""); }}
              >
                Voltar
              </Button>
              <Button
                variant="destructive"
                disabled={!cancelReason.trim() || cancelling}
                onClick={handleCancel}
              >
                {cancelling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Solicitar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </WaiterSessionGuard>
  );
}
