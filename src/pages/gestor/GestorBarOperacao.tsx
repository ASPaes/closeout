import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@/i18n/use-translation";
import { useGestor } from "@/contexts/GestorContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTION } from "@/config/audit-actions";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Beer, ShoppingCart, CheckCircle2, Package,
  AlertTriangle, CalendarDays, Loader2, Ban,
} from "lucide-react";

type EventRow = { id: string; name: string; start_at: string | null };

type Counts = {
  total: number;
  delivered: number;
  ready: number;
  late: number;
};

export default function GestorBarOperacao() {
  const { t } = useTranslation();
  const { effectiveClientId } = useGestor();
  const { session } = useAuth();

  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Counts>({ total: 0, delivered: 0, ready: 0, late: 0 });
  const [, setLateOrdersOpen] = useState(false);
  const [bulkCancelling, setBulkCancelling] = useState(false);

  // Load events for current client
  useEffect(() => {
    if (!effectiveClientId) return;
    supabase
      .from("events")
      .select("id, name, start_at")
      .eq("client_id", effectiveClientId)
      .eq("status", "active")
      .order("start_at", { ascending: false })
      .then(({ data }) => setEvents((data as EventRow[]) ?? []));
  }, [effectiveClientId]);

  // Fetch counts for selected event
  const fetchCounts = useCallback(async () => {
    if (!selectedEventId) return;
    const lateThreshold = new Date(Date.now() - 35 * 60 * 1000).toISOString();

    const [totalRes, deliveredRes, readyRes, lateRes] = await Promise.all([
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("event_id", selectedEventId)
        .not("status", "in", "(cancelled,pending,processing_payment)"),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("event_id", selectedEventId)
        .eq("status", "delivered"),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("event_id", selectedEventId)
        .in("status", ["ready", "partially_delivered"]),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("event_id", selectedEventId)
        .not("paid_at", "is", null)
        .lt("paid_at", lateThreshold)
        .not("status", "in", "(delivered,cancelled)"),
    ]);

    setCounts({
      total: totalRes.count ?? 0,
      delivered: deliveredRes.count ?? 0,
      ready: readyRes.count ?? 0,
      late: lateRes.count ?? 0,
    });
  }, [selectedEventId]);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  // Realtime
  useEffect(() => {
    if (!selectedEventId) return;
    const channel = supabase
      .channel(`gestor-bar-orders-${selectedEventId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `event_id=eq.${selectedEventId}`,
      }, () => { fetchCounts(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedEventId, fetchCounts]);

  // Refresh late count every minute (time-based threshold)
  useEffect(() => {
    if (!selectedEventId) return;
    const interval = setInterval(fetchCounts, 60_000);
    return () => clearInterval(interval);
  }, [selectedEventId, fetchCounts]);

  // Bulk cancel open QRs (preserved from previous version)
  const handleBulkCancelQRs = async () => {
    if (!effectiveClientId || !session?.user?.id) return;
    setBulkCancelling(true);
    try {
      const { data: validQrs } = await supabase
        .from("qr_tokens")
        .select("id, order_id, token, status")
        .eq("status", "valid");

      if (!validQrs || validQrs.length === 0) {
        toast.info("Nenhum QR em aberto encontrado");
        setBulkCancelling(false);
        return;
      }

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
      fetchCounts();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao cancelar QRs em lote");
    } finally {
      setBulkCancelling(false);
    }
  };

  const lateActive = counts.late > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("gbar_ops_title" as any)}
        subtitle={t("gbar_ops_desc" as any)}
        icon={Beer}
        actions={
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
        }
      />

      {/* Event selector */}
      <div className="max-w-md">
        <Select
          value={selectedEventId ?? undefined}
          onValueChange={(v) => setSelectedEventId(v)}
        >
          <SelectTrigger className="h-12">
            <SelectValue placeholder={t("gbar_select_event" as any)} />
          </SelectTrigger>
          <SelectContent>
            {events.map((ev) => (
              <SelectItem key={ev.id} value={ev.id}>{ev.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Empty state */}
      {!selectedEventId ? (
        <div className="text-center py-20 text-muted-foreground">
          <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{t("gbar_select_event_empty" as any)}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("gbar_total_orders" as any)}</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{counts.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("gbar_delivered" as any)}</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{counts.delivered}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("gbar_ready_pickup" as any)}</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{counts.ready}</div>
            </CardContent>
          </Card>

          <Card
            onClick={() => setLateOrdersOpen(true)}
            className={`cursor-pointer transition-colors ${lateActive ? "border-destructive/50" : ""}`}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("gbar_late_orders" as any)}</CardTitle>
              <AlertTriangle className={`h-4 w-4 ${lateActive ? "text-destructive animate-pulse" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${lateActive ? "text-destructive" : ""}`}>{counts.late}</div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
