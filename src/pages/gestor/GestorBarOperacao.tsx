import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "@/i18n/use-translation";
import { useGestor } from "@/contexts/GestorContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTION } from "@/config/audit-actions";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Beer, Search, XCircle, ShoppingCart, CheckCircle2,
  Clock, Package, Loader2, AlertTriangle, Ban,
} from "lucide-react";

type BarOrder = {
  id: string;
  order_number: number;
  status: string;
  total: number;
  origin: string;
  created_at: string;
  paid_at: string | null;
  preparing_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  notes: string | null;
  payment_method: string | null;
};

const STATUS_MAP: Record<string, { variant: "active" | "inactive" | "draft" | "completed" | "cancelled"; label: string }> = {
  pending: { variant: "draft", label: "Pendente" },
  paid: { variant: "completed", label: "Pago" },
  preparing: { variant: "completed", label: "Preparando" },
  ready: { variant: "active", label: "Pronto" },
  delivered: { variant: "inactive", label: "Entregue" },
  cancelled: { variant: "cancelled", label: "Cancelado" },
};

const ORIGIN_LABELS: Record<string, string> = {
  consumer_app: "App",
  waiter_app: "Garçom",
  cashier: "Caixa",
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function GestorBarOperacao() {
  const { t } = useTranslation();
  const { effectiveClientId } = useGestor();
  const { session } = useAuth();
  const [orders, setOrders] = useState<BarOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [bulkCancelling, setBulkCancelling] = useState(false);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    if (!effectiveClientId) return;
    const { data } = await supabase
      .from("orders")
      .select("id, order_number, status, total, origin, created_at, paid_at, preparing_at, ready_at, delivered_at, cancelled_at, notes, payment_method")
      .eq("client_id", effectiveClientId)
      .order("created_at", { ascending: false })
      .limit(500);
    setOrders((data as BarOrder[]) ?? []);
    setLoading(false);
  }, [effectiveClientId]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Realtime subscription
  useEffect(() => {
    if (!effectiveClientId) return;
    const channel = supabase
      .channel("gestor-bar-orders")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `client_id=eq.${effectiveClientId}`,
      }, () => { fetchOrders(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [effectiveClientId, fetchOrders]);

  // Filtered orders
  const filtered = useMemo(() => {
    let result = orders;
    if (statusFilter !== "all") result = result.filter((o) => o.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((o) =>
        String(o.order_number).includes(q) || o.status.includes(q)
      );
    }
    return result;
  }, [orders, statusFilter, searchQuery]);

  // Metrics
  const queueCount = orders.filter((o) => ["pending", "paid", "preparing"].includes(o.status)).length;
  const readyCount = orders.filter((o) => o.status === "ready").length;
  const deliveredToday = orders.filter((o) => {
    if (o.status !== "delivered" || !o.delivered_at) return false;
    const d = new Date(o.delivered_at);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  // Cancel single order
  const handleCancel = async (order: BarOrder) => {
    if (!session?.user?.id) return;
    setCancellingId(order.id);
    try {
      await supabase.from("orders").update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: session.user.id,
        cancel_reason: "Cancelado pelo gestor",
      }).eq("id", order.id);

      await supabase.from("qr_tokens").update({ status: "cancelled" }).eq("order_id", order.id);
      await supabase.rpc("release_stock_for_order", { p_order_id: order.id });

      await logAudit({
        action: AUDIT_ACTION.BAR_ORDER_CANCELLED,
        entityType: "order",
        entityId: order.id,
        newData: { order_number: order.order_number },
      });

      toast.success(`Pedido #${String(order.order_number).padStart(3, "0")} cancelado`);
      fetchOrders();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao cancelar pedido");
    } finally {
      setCancellingId(null);
    }
  };

  // Bulk cancel open QRs
  const handleBulkCancelQRs = async () => {
    if (!effectiveClientId || !session?.user?.id) return;
    setBulkCancelling(true);
    try {
      // Get all valid QRs for this client's orders
      const { data: validQrs } = await supabase
        .from("qr_tokens")
        .select("id, order_id, token, status")
        .eq("status", "valid");

      if (!validQrs || validQrs.length === 0) {
        toast.info("Nenhum QR em aberto encontrado");
        setBulkCancelling(false);
        return;
      }

      // Filter to only orders belonging to this client
      const orderIds = validQrs.map((q) => q.order_id);
      const { data: clientOrders } = await supabase
        .from("orders")
        .select("id")
        .eq("client_id", effectiveClientId)
        .in("id", orderIds);

      const clientOrderIds = new Set((clientOrders ?? []).map((o) => o.id));
      const qrsToCancel = validQrs.filter((q) => clientOrderIds.has(q.order_id));

      if (qrsToCancel.length === 0) {
        toast.info("Nenhum QR em aberto para este cliente");
        setBulkCancelling(false);
        return;
      }

      for (const qr of qrsToCancel) {
        await supabase.from("qr_tokens").update({ status: "cancelled" }).eq("id", qr.id);
        await supabase.from("orders").update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancelled_by: session.user.id,
          cancel_reason: "Encerramento — QRs cancelados em lote",
        }).eq("id", qr.order_id);
        await supabase.rpc("release_stock_for_order", { p_order_id: qr.order_id });
      }

      await logAudit({
        action: AUDIT_ACTION.BAR_ORDER_CANCELLED,
        entityType: "qr_token",
        entityId: effectiveClientId,
        newData: { cancelled_count: qrsToCancel.length, reason: "bulk_cancel" },
      });

      toast.success(`${qrsToCancel.length} QR(s) cancelado(s) com sucesso`);
      fetchOrders();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao cancelar QRs em lote");
    } finally {
      setBulkCancelling(false);
    }
  };

  const timeSince = (dateStr: string) => {
    const mins = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return "<1 min";
    return `${mins} min`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <PageHeader
          title={t("gbar_ops_title" as any)}
          subtitle={t("gbar_ops_desc" as any)}
          icon={Beer}
        />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={bulkCancelling}>
              {bulkCancelling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Ban className="h-4 w-4 mr-2" />}
              {t("gbar_bulk_cancel_qr" as any)}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("gbar_bulk_cancel_title" as any)}</AlertDialogTitle>
              <AlertDialogDescription>{t("gbar_bulk_cancel_desc" as any)}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleBulkCancelQRs} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {t("confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("gbar_queue" as any)}</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("gbar_ready" as any)}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {readyCount}
              {readyCount > 0 && <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("gbar_delivered_today" as any)}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deliveredToday}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("gbar_search" as any)}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {["all", "pending", "paid", "preparing", "ready", "delivered", "cancelled"].map((s) => (
          <Badge
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            className="cursor-pointer py-1.5 px-3"
            onClick={() => setStatusFilter(s)}
          >
            {s === "all" ? "Todos" : (STATUS_MAP[s]?.label ?? s)}
          </Badge>
        ))}
      </div>

      {/* Orders table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Beer className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p>{t("gbar_no_orders" as any)}</p>
        </div>
      ) : (
        <div className="rounded-md border border-border/60 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/30">
                <th className="text-left p-3 font-medium">#</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">{t("gbar_origin" as any)}</th>
                <th className="text-right p-3 font-medium">{t("total")}</th>
                <th className="text-left p-3 font-medium">{t("gbar_time" as any)}</th>
                <th className="text-right p-3 font-medium">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => {
                const sm = STATUS_MAP[order.status];
                const canCancel = !["delivered", "cancelled"].includes(order.status);
                return (
                  <tr key={order.id} className="border-b border-border/20 hover:bg-muted/20">
                    <td className="p-3 font-bold text-primary">#{String(order.order_number).padStart(3, "0")}</td>
                    <td className="p-3">
                      <StatusBadge status={sm?.variant ?? "default"} label={sm?.label ?? order.status} />
                    </td>
                    <td className="p-3 text-muted-foreground">{ORIGIN_LABELS[order.origin] ?? order.origin}</td>
                    <td className="p-3 text-right">{fmt(order.total)}</td>
                    <td className="p-3 text-muted-foreground">{timeSince(order.created_at)}</td>
                    <td className="p-3 text-right">
                      {canCancel && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={cancellingId === order.id}>
                              {cancellingId === order.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancelar pedido #{String(order.order_number).padStart(3, "0")}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação cancelará o pedido, invalidará o QR Code e liberará o estoque reservado.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleCancel(order)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                {t("confirm")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
