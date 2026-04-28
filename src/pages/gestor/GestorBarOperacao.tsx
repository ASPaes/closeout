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
  AlertTriangle, CalendarDays, Loader2, Ban, Copy,
} from "lucide-react";

type EventRow = { id: string; name: string; start_at: string | null };

type Counts = {
  total: number;
  delivered: number;
  ready: number;
  late: number;
};

type StationRow = {
  id: string;
  name: string;
  join_code: string;
  bar_station_members: { name: string }[] | null;
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
  const [stations, setStations] = useState<StationRow[]>([]);
  const [stationDeliveries, setStationDeliveries] = useState<Map<string, number>>(new Map());
  const [, setLoadingStations] = useState(false);

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

  // Fetch counts + stations + deliveries per station
  const refetchAll = useCallback(async () => {
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

    // Stations
    setLoadingStations(true);
    const { data: stationsData } = await supabase
      .from("bar_stations")
      .select("id, name, join_code, bar_station_members(name)")
      .eq("event_id", selectedEventId)
      .eq("status", "active")
      .order("created_at");
    const stationList = (stationsData as StationRow[]) ?? [];
    setStations(stationList);

    // Per-station delivery counts
    const counts = await Promise.all(
      stationList.map((s) =>
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("event_id", selectedEventId)
          .eq("status", "delivered")
          .eq("delivered_by_station_id", s.id)
          .then((r) => [s.id, r.count ?? 0] as [string, number])
      )
    );
    setStationDeliveries(new Map(counts));
    setLoadingStations(false);
  }, [selectedEventId]);

  useEffect(() => { refetchAll(); }, [refetchAll]);

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
      }, () => { refetchAll(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedEventId, refetchAll]);

  // Realtime for stations
  useEffect(() => {
    if (!selectedEventId) return;
    const channel = supabase
      .channel(`gestor-bar-stations-${selectedEventId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "bar_stations",
        filter: `event_id=eq.${selectedEventId}`,
      }, () => { refetchAll(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedEventId, refetchAll]);

  // Refresh late count every minute (time-based threshold)
  useEffect(() => {
    if (!selectedEventId) return;
    const interval = setInterval(refetchAll, 60_000);
    return () => clearInterval(interval);
  }, [selectedEventId, refetchAll]);

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
      refetchAll();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao cancelar QRs em lote");
    } finally {
      setBulkCancelling(false);
    }
  };

  const lateActive = counts.late > 0;

  const copyStationLink = (joinCode: string) => {
    const url = `${window.location.origin}/bar?station=${joinCode}`;
    navigator.clipboard.writeText(url);
    toast.success(t("gbar_link_copied" as any));
  };

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

      {/* Bars section */}
      {selectedEventId && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t("gbar_bars_section" as any)}</h2>
          {stations.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground border border-border/60 rounded-lg">
              <p className="text-sm">{t("gbar_no_bars" as any)}</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {stations.map((station) => {
                const delivered = stationDeliveries.get(station.id) ?? 0;
                const members = (station.bar_station_members ?? []).map((m) => m.name).join(", ");
                return (
                  <Card
                    key={station.id}
                    className="border-border/60 hover:bg-muted/30 transition-colors relative"
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-lg font-bold truncate">{station.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {members || t("gbar_no_operators" as any)}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => copyStationLink(station.join_code)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className={`text-3xl font-bold ${delivered > 0 ? "text-primary" : "text-muted-foreground"}`}>
                        {delivered}
                      </div>
                      <div className="text-xs text-muted-foreground">{t("gbar_delivered_by_bar" as any)}</div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
