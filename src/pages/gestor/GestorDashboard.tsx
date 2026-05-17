import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "@/i18n/use-translation";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useGestor } from "@/contexts/GestorContext";
import { supabase } from "@/integrations/supabase/client";
import { Package, Tags, Layers, Megaphone, Warehouse, CalendarDays, Banknote, ShoppingCart, Clock, CheckCircle2, AlertTriangle, UserCheck, CalendarIcon, Beer, Smartphone, Users } from "lucide-react";
import { format } from "date-fns";
import type { TranslationKey } from "@/i18n/translations/pt-BR";

const cards: { titleKey: TranslationKey; descKey: TranslationKey; icon: any; url: string }[] = [
  { titleKey: "gestor_products", descKey: "gestor_products_desc", icon: Package, url: "/gestor/produtos" },
  { titleKey: "gestor_categories", descKey: "gestor_categories_desc", icon: Tags, url: "/gestor/categorias" },
  { titleKey: "gestor_combos", descKey: "gestor_combos_desc", icon: Layers, url: "/gestor/combos" },
  { titleKey: "gestor_campaigns", descKey: "gestor_campaigns_desc", icon: Megaphone, url: "/gestor/campanhas" },
  { titleKey: "gestor_stock", descKey: "gestor_stock_desc", icon: Warehouse, url: "/gestor/estoque" },
  { titleKey: "events", descKey: "manage_events", icon: CalendarDays, url: "/gestor/eventos" },
];

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);
  return <span className="tabular-nums">{now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>;
}

type ActiveEvent = { id: string; name: string };

type EventOpsRow = {
  eventId: string;
  eventName: string;
  eventDate: string;
  fatCaixa: number;
  fatBar: number;
  fatTotal: number;
  caixasAbertos: number;
  caixasTotal: number;
  baresAtivos: number;
  baresTotal: number;
  isActive: boolean;
};

export default function GestorDashboard() {
  const { profile } = useAuth();
  const { clientName, effectiveClientId } = useGestor();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [openRegisters, setOpenRegisters] = useState(0);
  const [salesToday, setSalesToday] = useState(0);
  const [activeWaiters, setActiveWaiters] = useState(0);
  const [pendingCancellations, setPendingCancellations] = useState(0);

  // Bar metrics
  const [barQueue, setBarQueue] = useState(0);
  const [barReady, setBarReady] = useState(0);
  const [barAvgPrepMin, setBarAvgPrepMin] = useState<number | null>(null);
  const [barDeliveredToday, setBarDeliveredToday] = useState(0);
  const [unretrievedOrders, setUnretrievedOrders] = useState<{ order_number: number; minutes: number; items: string }[]>([]);

  // Financial metrics
  const [activeEvents, setActiveEvents] = useState<ActiveEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("all");
  const [finRevenue, setFinRevenue] = useState(0);
  const [finNet, setFinNet] = useState(0);
  const [finCloseout, setFinCloseout] = useState(0);
  const [finAsaasFee, setFinAsaasFee] = useState(0);
  const [finAsaasFeePercent, setFinAsaasFeePercent] = useState(0);
  const [finPending, setFinPending] = useState(0);
  const [finLoading, setFinLoading] = useState(false);
  const [feeBreakdown, setFeeBreakdown] = useState<any>(null);

  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [topProductsLoading, setTopProductsLoading] = useState(false);

  const [eventOps, setEventOps] = useState<EventOpsRow[]>([]);
  const [eventOpsLoading, setEventOpsLoading] = useState(false);

  const [fatApp, setFatApp] = useState(0);
  const [fatWaiter, setFatWaiter] = useState(0);
  const [fatPaidNotDelivered, setFatPaidNotDelivered] = useState(0);
  const [countPaidNotDelivered, setCountPaidNotDelivered] = useState(0);
  const [fatChannelLoading, setFatChannelLoading] = useState(false);

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: (() => { const d = new Date(); d.setDate(d.getDate() - 30); d.setHours(0,0,0,0); return d; })(),
    to: new Date(),
  });
  const [calendarOpen, setCalendarOpen] = useState(false);

  const filterStart = dateRange?.from ?? (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })();
  const filterEnd = dateRange?.to ?? new Date();

  useEffect(() => {
    if (!effectiveClientId) return;

    // Count open registers
    let regQuery = supabase
      .from("cash_registers")
      .select("id", { count: "exact", head: true })
      .eq("client_id", effectiveClientId)
      .eq("status", "open");
    if (selectedEventId !== "all") regQuery = regQuery.eq("event_id", selectedEventId);
    regQuery.then(({ count }) => setOpenRegisters(count ?? 0));

    // Sum sales in range
    let salesQuery = supabase
      .from("cash_orders")
      .select("total")
      .eq("client_id", effectiveClientId)
      .eq("status", "completed")
      .gte("created_at", filterStart.toISOString())
      .lte("created_at", filterEnd.toISOString());
    if (selectedEventId !== "all") salesQuery = salesQuery.eq("event_id", selectedEventId);
    salesQuery.then(({ data }) => {
      const sum = (data ?? []).reduce((acc, o) => acc + Number(o.total), 0);
      setSalesToday(sum);
    });

    // Active waiters
    let waitQuery = supabase
      .from("waiter_sessions" as any)
      .select("id", { count: "exact", head: true })
      .eq("client_id", effectiveClientId)
      .is("closed_at", null);
    if (selectedEventId !== "all") waitQuery = waitQuery.eq("event_id", selectedEventId);
    waitQuery.then(({ count }) => setActiveWaiters(count ?? 0));

    // Pending cancellations
    let cancQuery = supabase
      .from("waiter_cancellation_requests" as any)
      .select("id", { count: "exact", head: true })
      .eq("client_id", effectiveClientId)
      .eq("status", "pending");
    if (selectedEventId !== "all") cancQuery = cancQuery.eq("event_id", selectedEventId);
    cancQuery.then(({ count }) => setPendingCancellations(count ?? 0));

    // Bar: queue count
    let queueQuery = supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("client_id", effectiveClientId)
      .in("status", ["pending", "paid", "preparing"]);
    if (selectedEventId !== "all") queueQuery = queueQuery.eq("event_id", selectedEventId);
    queueQuery.then(({ count }) => setBarQueue(count ?? 0));

    // Bar: ready count
    let readyQuery = supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("client_id", effectiveClientId)
      .eq("status", "ready");
    if (selectedEventId !== "all") readyQuery = readyQuery.eq("event_id", selectedEventId);
    readyQuery.then(({ count }) => setBarReady(count ?? 0));

    // Bar: delivered in range
    let deliveredQuery = supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("client_id", effectiveClientId)
      .eq("status", "delivered")
      .gte("delivered_at", filterStart.toISOString())
      .lte("delivered_at", filterEnd.toISOString());
    if (selectedEventId !== "all") deliveredQuery = deliveredQuery.eq("event_id", selectedEventId);
    deliveredQuery.then(({ count }) => setBarDeliveredToday(count ?? 0));

    // Bar: avg prep time (ready_at - paid_at)
    let avgQuery = supabase
      .from("orders")
      .select("paid_at, ready_at")
      .eq("client_id", effectiveClientId)
      .eq("status", "delivered")
      .not("paid_at", "is", null)
      .not("ready_at", "is", null)
      .gte("ready_at", filterStart.toISOString())
      .lte("ready_at", filterEnd.toISOString())
      .limit(200);
    if (selectedEventId !== "all") avgQuery = avgQuery.eq("event_id", selectedEventId);
    avgQuery.then(({ data }) => {
        if (!data || data.length === 0) { setBarAvgPrepMin(null); return; }
        const diffs = data.map((o) => {
          const paid = new Date(o.paid_at!).getTime();
          const ready = new Date(o.ready_at!).getTime();
          return (ready - paid) / 60000;
        }).filter((d) => d > 0);
        if (diffs.length === 0) { setBarAvgPrepMin(null); return; }
        setBarAvgPrepMin(Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length));
      });

    // Bar: unretrieved orders (ready for too long)
    let unretrievedQuery = supabase
      .from("orders")
      .select("order_number, ready_at, notes")
      .eq("client_id", effectiveClientId)
      .eq("status", "ready")
      .not("ready_at", "is", null)
      .order("ready_at", { ascending: true })
      .limit(50);
    if (selectedEventId !== "all") unretrievedQuery = unretrievedQuery.eq("event_id", selectedEventId);
    unretrievedQuery.then(({ data }) => {
        if (!data) return;
        const nowMs = Date.now();
        const alerts = data
          .filter((o) => {
            const readyMs = new Date(o.ready_at!).getTime();
            return (nowMs - readyMs) / 60000 > 10;
          })
          .map((o) => ({
            order_number: o.order_number,
            minutes: Math.round((nowMs - new Date(o.ready_at!).getTime()) / 60000),
            items: o.notes || "",
          }));
        setUnretrievedOrders(alerts);
      });

    // Fetch active events for financial filter
    supabase
      .from("events")
      .select("id, name")
      .eq("client_id", effectiveClientId)
      .in("status", ["active", "completed"])
      .order("start_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setActiveEvents(data ?? []));
  }, [effectiveClientId, selectedEventId, filterStart.getTime(), filterEnd.getTime()]);

  // Financial data fetch
  const fetchFinancials = useCallback(async () => {
    if (!effectiveClientId) return;
    setFinLoading(true);
    const { data: breakdown } = await (supabase.rpc as any)("get_gestor_fee_breakdown", {
      p_client_id: effectiveClientId,
      p_start_date: filterStart.toISOString(),
      p_end_date: filterEnd.toISOString(),
      p_event_id: selectedEventId !== "all" ? selectedEventId : null,
    });

    if (breakdown) {
      setFinRevenue(Number(breakdown.total_bruto) || 0);
      setFinNet(Number(breakdown.total_liquido_cliente) || 0);
      setFinCloseout(Number(breakdown.total_taxa_closeout) || 0);
      setFinAsaasFee(Number(breakdown.total_taxa_asaas) || 0);
      setFinAsaasFeePercent(Number(breakdown.taxa_asaas_percent) || 0);
      setFeeBreakdown(breakdown);
    }

    let pendQuery = supabase
      .from("asaas_charges")
      .select("id", { count: "exact", head: true })
      .eq("client_id", effectiveClientId)
      .eq("asaas_status", "PENDING")
      .gte("created_at", filterStart.toISOString())
      .lte("created_at", filterEnd.toISOString());
    if (selectedEventId !== "all") pendQuery = pendQuery.eq("event_id", selectedEventId);
    const { count: pendCount } = await pendQuery;
    setFinPending(pendCount ?? 0);

    setFinLoading(false);
  }, [effectiveClientId, selectedEventId, filterStart.getTime(), filterEnd.getTime()]);

  useEffect(() => { fetchFinancials(); }, [fetchFinancials]);

  useEffect(() => {
    const fetchEventOps = async () => {
      if (!effectiveClientId) return;
      setEventOpsLoading(true);

      const { data: evts } = await supabase
        .from("events")
        .select("id, name, start_at, status")
        .eq("client_id", effectiveClientId)
        .in("status", ["active", "completed"])
        .order("start_at", { ascending: false })
        .limit(20);

      if (!evts || evts.length === 0) { setEventOps([]); setEventOpsLoading(false); return; }

      const eventIds = evts.map((e) => e.id);

      const [cashOrdersRes, cashRegsRes, ordersRes, barStationsRes] = await Promise.all([
        supabase
          .from("cash_orders")
          .select("event_id, total")
          .eq("client_id", effectiveClientId)
          .eq("status", "completed")
          .in("event_id", eventIds),
        supabase
          .from("cash_registers")
          .select("event_id, status")
          .eq("client_id", effectiveClientId)
          .in("event_id", eventIds),
        supabase
          .from("orders")
          .select("event_id, total")
          .eq("client_id", effectiveClientId)
          .eq("status", "delivered")
          .in("event_id", eventIds),
        supabase
          .from("bar_stations")
          .select("event_id, status")
          .eq("client_id", effectiveClientId)
          .in("event_id", eventIds),
      ]);

      const cashByEvent = new Map<string, number>();
      (cashOrdersRes.data ?? []).forEach((co: any) => {
        cashByEvent.set(co.event_id, (cashByEvent.get(co.event_id) || 0) + Number(co.total));
      });

      const ordersByEvent = new Map<string, number>();
      (ordersRes.data ?? []).forEach((o: any) => {
        ordersByEvent.set(o.event_id, (ordersByEvent.get(o.event_id) || 0) + Number(o.total));
      });

      const caixasByEvent = new Map<string, { total: number; abertos: number }>();
      (cashRegsRes.data ?? []).forEach((cr: any) => {
        const prev = caixasByEvent.get(cr.event_id) || { total: 0, abertos: 0 };
        caixasByEvent.set(cr.event_id, {
          total: prev.total + 1,
          abertos: prev.abertos + (cr.status === "open" ? 1 : 0),
        });
      });

      const baresByEvent = new Map<string, { total: number; ativos: number }>();
      (barStationsRes.data ?? []).forEach((bs: any) => {
        const prev = baresByEvent.get(bs.event_id) || { total: 0, ativos: 0 };
        baresByEvent.set(bs.event_id, {
          total: prev.total + 1,
          ativos: prev.ativos + (bs.status === "active" ? 1 : 0),
        });
      });

      const rows: EventOpsRow[] = evts
        .map((e: any) => {
          const fatCaixa = Math.round((cashByEvent.get(e.id) || 0) * 100) / 100;
          const fatBar = Math.round((ordersByEvent.get(e.id) || 0) * 100) / 100;
          const cx = caixasByEvent.get(e.id) || { total: 0, abertos: 0 };
          const bs = baresByEvent.get(e.id) || { total: 0, ativos: 0 };
          return {
            eventId: e.id,
            eventName: e.name,
            eventDate: e.start_at,
            fatCaixa,
            fatBar,
            fatTotal: Math.round((fatCaixa + fatBar) * 100) / 100,
            caixasAbertos: cx.abertos,
            caixasTotal: cx.total,
            baresAtivos: bs.ativos,
            baresTotal: bs.total,
            isActive: e.status === "active",
          };
        })
        .filter((r) => r.fatTotal > 0 || r.caixasTotal > 0 || r.baresTotal > 0)
        .sort((a, b) => b.fatTotal - a.fatTotal)
        .slice(0, 3);

      setEventOps(rows);
      setEventOpsLoading(false);
    };

    fetchEventOps();
  }, [effectiveClientId]);

  useEffect(() => {
    const fetchTopProducts = async () => {
      if (!effectiveClientId) return;
      setTopProductsLoading(true);
      const { data } = await (supabase.rpc as any)("get_gestor_top_products", {
        p_client_id: effectiveClientId,
        p_start_date: filterStart.toISOString(),
        p_end_date: filterEnd.toISOString(),
        p_event_id: selectedEventId !== "all" ? selectedEventId : null,
        p_limit: 3,
      });
      setTopProducts(data ?? []);
      setTopProductsLoading(false);
    };
    fetchTopProducts();
  }, [effectiveClientId, selectedEventId, filterStart.getTime(), filterEnd.getTime()]);

  useEffect(() => {
    const fetchChannelRevenue = async () => {
      if (!effectiveClientId) return;
      setFatChannelLoading(true);

      let query = supabase
        .from("orders")
        .select("origin, total, status, paid_at")
        .eq("client_id", effectiveClientId)
        .not("status", "in", "(pending,cancelled,processing_payment)")
        .gte("created_at", filterStart.toISOString())
        .lte("created_at", filterEnd.toISOString());
      if (selectedEventId !== "all") query = query.eq("event_id", selectedEventId);

      const { data } = await query;

      let appTotal = 0;
      let waiterTotal = 0;
      let paidNotDeliveredTotal = 0;
      let paidNotDeliveredCount = 0;

      (data ?? []).forEach((o) => {
        const val = Number(o.total);
        const isDelivered = o.status === "delivered";
        // Só conta como "pago não entregue" se paid_at existe (exclui splits abandonados)
        const isPaidNotDelivered = o.paid_at && ["paid", "ready", "partially_delivered"].includes(o.status);

        if (isDelivered) {
          if (o.origin === "consumer_app") appTotal += val;
          else if (o.origin === "waiter_app") waiterTotal += val;
        }

        if (isPaidNotDelivered) {
          paidNotDeliveredTotal += val;
          paidNotDeliveredCount++;
        }
      });

      setFatApp(Math.round(appTotal * 100) / 100);
      setFatWaiter(Math.round(waiterTotal * 100) / 100);
      setFatPaidNotDelivered(Math.round(paidNotDeliveredTotal * 100) / 100);
      setCountPaidNotDelivered(paidNotDeliveredCount);
      setFatChannelLoading(false);
    };

    fetchChannelRevenue();
  }, [effectiveClientId, selectedEventId, filterStart.getTime(), filterEnd.getTime()]);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-extrabold text-sm">C</div>
          <div>
            <h1 className="text-base font-semibold text-foreground">
              <span className="font-bold">{clientName || "Close Out"}</span>
              <span className="text-muted-foreground font-normal"> · Painel</span>
            </h1>
            <p className="text-xs text-muted-foreground">
              {t("welcome_back")}, {profile?.name || "Gestor"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 px-3 rounded-lg border border-border/40 bg-card/30 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
            </span>
            <LiveClock />
          </div>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "h-9 justify-start text-left font-normal w-[260px]",
                  !dateRange?.from && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from && dateRange?.to
                  ? `${dateRange.from.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} — ${dateRange.to.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`
                  : <span>Selecionar período</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={(range) => {
                  setDateRange(range);
                  if (range?.from && range?.to) setCalendarOpen(false);
                }}
                numberOfMonths={2}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger className="w-[220px] h-9">
              <SelectValue placeholder="Todos os eventos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os eventos</SelectItem>
              {activeEvents.map((ev) => (
                <SelectItem key={ev.id} value={ev.id}>{ev.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Eventos em operação — ticker */}
      {!eventOpsLoading && eventOps.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {eventOps.map((ev) => {
            const isSelected = selectedEventId === ev.eventId;
            const evDate = (() => {
              try { return format(new Date(ev.eventDate), "dd/MM"); } catch { return ""; }
            })();
            return (
              <button
                key={ev.eventId}
                onClick={() => setSelectedEventId(isSelected ? "all" : ev.eventId)}
                className={cn(
                  "relative rounded-xl border p-4 text-left transition-all overflow-hidden",
                  isSelected
                    ? "border-primary/30 bg-primary/[0.04]"
                    : "border-border/30 bg-card/20 hover:border-border/50 hover:bg-card/30"
                )}
              >
                <div className="absolute top-[-30px] right-[-30px] w-[80px] h-[80px] rounded-full bg-primary/[0.03] pointer-events-none" />
                <div className="flex items-start justify-between gap-2 mb-3 relative">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{ev.eventName}</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">{evDate}</p>
                  </div>
                  {ev.isActive && (
                    <span className="shrink-0 text-[9px] font-semibold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 uppercase tracking-wide flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                      Ativo
                    </span>
                  )}
                </div>
                <p className="text-xl font-bold text-primary tabular-nums tracking-tight relative">
                  {fmt(ev.fatTotal)}
                </p>
                <div className="flex items-center gap-3 mt-2.5 text-[10px] text-muted-foreground/50 relative">
                  <span className="flex items-center gap-1">
                    <Banknote className="h-3 w-3" />
                    {ev.caixasTotal > 0 ? `${ev.caixasTotal} cx` : "—"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Beer className="h-3 w-3" />
                    {ev.baresTotal > 0 ? `${ev.baresTotal} bar${ev.baresTotal > 1 ? "es" : ""}` : "—"}
                  </span>
                  {isSelected && (
                    <span className="ml-auto text-[9px] font-semibold text-primary">Filtrado ✓</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {eventOpsLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-border/20 bg-card/10 p-4 space-y-3">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-12 rounded-full" />
              </div>
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      )}

      {/* Faturamento hero */}
      <div className="relative py-10 text-center overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[250px] rounded-full bg-primary/[0.06] blur-3xl pointer-events-none" />
        <p className="relative text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/50 mb-4">
          Faturamento confirmado
        </p>
        {finLoading ? (
          <Skeleton className="h-16 w-72 mx-auto" />
        ) : (
          <p className="relative text-7xl font-extrabold text-foreground tracking-tighter tabular-nums leading-none">
            {fmt(finRevenue)}
          </p>
        )}
        <p className="relative text-xs text-muted-foreground/30 mt-3">Pagamentos confirmados</p>
      </div>

      {/* Métricas financeiras */}
      <div className="flex items-center justify-center gap-0 border-y border-border/20 py-0">
        {[
          { label: "Recebido líquido", value: fmt(finNet), sub: "Valor repassado" },
          { label: "Taxa Close Out", value: fmt(finCloseout), sub: "Retido pela plataforma", accent: true },
          { label: "Taxa Gateway", value: fmt(finAsaasFee), sub: `${finAsaasFeePercent}% médio · Asaas` },
          { label: "Pendentes", value: finPending, sub: "Pagamentos não confirmados", badge: finPending > 0 },
        ].map((m, i) => (
          <div key={m.label} className={cn("flex-1 py-5 text-center", i < 3 && "border-r border-border/20")}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-2">{m.label}</p>
            {finLoading ? (
              <Skeleton className="h-5 w-20 mx-auto" />
            ) : (
              <p className={cn("text-lg font-semibold tabular-nums", (m as any).accent ? "text-primary" : "text-foreground")}>
                {typeof m.value === "number" ? (
                  <span className="flex items-center justify-center gap-2">
                    {m.value}
                    {(m as any).badge && <Badge variant="outline" className="bg-yellow-500/15 text-yellow-500 border-yellow-500/30 text-xs">Aguardando</Badge>}
                  </span>
                ) : m.value}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Unretrieved orders alert */}
      {unretrievedOrders.length > 0 && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/[0.03] p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
            </span>
            <span className="text-sm font-semibold text-destructive">{t("gbar_unretrieved_alert" as any)}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-destructive/12 text-destructive">{unretrievedOrders.length}</span>
          </div>
          <div className="space-y-2">
            {unretrievedOrders.slice(0, 5).map((o) => (
              <div key={o.order_number} className="flex items-center justify-between rounded-xl bg-destructive/[0.04] border border-destructive/10 px-4 py-3">
                <span className="text-sm font-bold text-destructive/80">#{String(o.order_number).padStart(3, "0")}</span>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-destructive/12 text-destructive tabular-nums">{o.minutes} min</span>
              </div>
            ))}
            {unretrievedOrders.length > 5 && (
              <p className="text-xs text-muted-foreground text-center pt-1">+{unretrievedOrders.length - 5} {t("gbar_more_orders" as any)}</p>
            )}
          </div>
        </div>
      )}

      {/* Faturamento por Canal */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-[3px] h-3.5 rounded-full bg-primary" />
          <h2 className="text-sm font-semibold text-muted-foreground">Faturamento por Canal</h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {/* App */}
          <div className="rounded-xl border border-border/40 bg-card/30 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Smartphone className="h-4 w-4 text-primary" />
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">App</span>
              </div>
            </div>
            {fatChannelLoading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <p className="text-2xl font-bold text-primary tabular-nums">{fmt(fatApp)}</p>
            )}
            <p className="text-[10px] text-muted-foreground/40 mt-1">Pedidos pelo consumidor</p>
          </div>

          {/* Garçom */}
          <div className="rounded-xl border border-border/40 bg-card/30 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-blue-400" />
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Garçom</span>
              </div>
            </div>
            {fatChannelLoading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <p className="text-2xl font-bold text-foreground tabular-nums">{fmt(fatWaiter)}</p>
            )}
            <p className="text-[10px] text-muted-foreground/40 mt-1">Pedidos pelo garçom</p>
          </div>

          {/* Caixa */}
          <div className="rounded-xl border border-border/40 bg-card/30 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Banknote className="h-4 w-4 text-green-400" />
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Caixa</span>
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums">{fmt(salesToday)}</p>
            <p className="text-[10px] text-muted-foreground/40 mt-1">Vendas no caixa físico</p>
          </div>
        </div>

        {/* Banner pago não entregue */}
        {!fatChannelLoading && fatPaidNotDelivered > 0 && (
          <div className="mt-3 rounded-xl border border-yellow-500/15 bg-yellow-500/[0.03] p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Clock className="h-4 w-4 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-yellow-400">
                  Pago, aguardando entrega
                </p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                  {countPaidNotDelivered} pedido{countPaidNotDelivered !== 1 ? "s" : ""} pago{countPaidNotDelivered !== 1 ? "s" : ""} que ainda não foram entregues pelo bar
                </p>
              </div>
            </div>
            <p className="text-xl font-bold text-yellow-400 tabular-nums">{fmt(fatPaidNotDelivered)}</p>
          </div>
        )}
      </div>

      {/* Two-column grid: Operacional + Bar (left) | Top Products + Pagamentos (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          {/* Operacional */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-[3px] h-3.5 rounded-full bg-green-500" />
              <h2 className="text-sm font-semibold text-muted-foreground">Operacional</h2>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-border/40 bg-card/30 p-4">
                <div className="flex justify-between items-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60 mb-2">
                  <span>Caixas abertos</span>
                  <Banknote className="h-3.5 w-3.5" />
                </div>
                <div className="text-2xl font-bold">{openRegisters}</div>
                <p className="text-[10px] text-muted-foreground/40 mt-1">Em operação agora</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-card/30 p-4">
                <div className="flex justify-between items-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60 mb-2">
                  <span>Vendas no caixa</span>
                  <ShoppingCart className="h-3.5 w-3.5" />
                </div>
                <div className="text-2xl font-bold text-primary tabular-nums">{fmt(salesToday)}</div>
                <p className="text-[10px] text-muted-foreground/40 mt-1">No período selecionado</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-card/30 p-4">
                <div className="flex justify-between items-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60 mb-2">
                  <span>Garçons ativos</span>
                  <UserCheck className="h-3.5 w-3.5" />
                </div>
                <div className="text-2xl font-bold">{activeWaiters}</div>
                <p className="text-[10px] text-muted-foreground/40 mt-1">Sessões abertas</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-card/30 p-4">
                <div className="flex justify-between items-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60 mb-2">
                  <span>Cancelamentos</span>
                  <AlertTriangle className="h-3.5 w-3.5" />
                </div>
                <div className="text-2xl font-bold flex items-center gap-2">
                  {pendingCancellations}
                  {pendingCancellations > 0 && (
                    <Badge variant="destructive" className="text-xs">{pendingCancellations}</Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground/40 mt-1">Aguardando aprovação</p>
              </div>
            </div>
          </div>

          {/* Operação do Bar */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-[3px] h-3.5 rounded-full bg-primary" />
              <h2 className="text-sm font-semibold text-muted-foreground">Operação do Bar</h2>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-border/40 bg-card/30 p-4">
                <div className="flex justify-between items-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60 mb-2">
                  <span>Na fila</span>
                  <ShoppingCart className="h-3.5 w-3.5" />
                </div>
                <div className="text-2xl font-bold flex items-center gap-2">
                  {barQueue}
                  {barQueue > 10 && <Badge variant="outline" className="bg-yellow-500/15 text-yellow-500 border-yellow-500/30 text-xs">Alto</Badge>}
                </div>
              </div>
              <div className="rounded-xl border border-border/40 bg-card/30 p-4">
                <div className="flex justify-between items-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60 mb-2">
                  <span>Prontos</span>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
                <div className="text-2xl font-bold flex items-center gap-2">
                  {barReady}
                  {barReady > 0 && <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />}
                </div>
              </div>
              <div className="rounded-xl border border-border/40 bg-card/30 p-4">
                <div className="flex justify-between items-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60 mb-2">
                  <span>Tempo médio</span>
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <div className="text-2xl font-bold">
                  {barAvgPrepMin !== null ? `${barAvgPrepMin} min` : "—"}
                </div>
              </div>
              <div className="rounded-xl border border-border/40 bg-card/30 p-4">
                <div className="flex justify-between items-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60 mb-2">
                  <span>Entregues</span>
                  <Package className="h-3.5 w-3.5" />
                </div>
                <div className="text-2xl font-bold">{barDeliveredToday}</div>
              </div>
            </div>

            {/* Ring gauge — taxa de entrega */}
            {(() => {
              const totalPedidos = barDeliveredToday + barQueue + barReady;
              const pctEntregue = totalPedidos > 0 ? Math.round((barDeliveredToday / totalPedidos) * 100) : 0;
              const radius = 22;
              const circumference = 2 * Math.PI * radius;
              const dash = (pctEntregue / 100) * circumference;
              return (
                <div className="mt-2.5 rounded-xl border border-border/40 bg-card/30 p-4 flex items-center gap-4">
                  <svg width="52" height="52" viewBox="0 0 52 52" className="shrink-0">
                    <circle cx="26" cy="26" r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth="4" opacity="0.3" />
                    <circle
                      cx="26"
                      cy="26"
                      r={radius}
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={`${dash} ${circumference}`}
                      transform="rotate(-90 26 26)"
                    />
                  </svg>
                  <div className="flex flex-col">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">Taxa de entrega</p>
                    <p className="text-lg font-bold tabular-nums">
                      {pctEntregue}% <span className="text-sm font-normal text-muted-foreground">· {barDeliveredToday}/{totalPedidos}</span>
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Top vendidos */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-[3px] h-3.5 rounded-full bg-purple-500" />
              <h2 className="text-sm font-semibold text-muted-foreground">Mais vendidos</h2>
            </div>
            {topProductsLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
              </div>
            ) : topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma venda no período</p>
            ) : (
              <div className="space-y-0">
                {topProducts.map((p: any, idx: number) => {
                  const maxRev = topProducts[0]?.gmv || 1;
                  const pct = Math.round((Number(p.gmv) / Number(maxRev)) * 100);
                  return (
                    <div key={p.item_id} className="flex items-center gap-3 py-3 border-b border-border/30 last:border-none">
                      <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                        idx === 0 ? "bg-primary/12 text-primary" :
                        idx === 1 ? "bg-muted text-muted-foreground" :
                        "bg-muted/40 text-muted-foreground/50"
                      )}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{p.item_name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[8px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {p.item_type === "combo" ? "Combo" : "Produto"}
                          </span>
                          <span className="text-[10px] text-muted-foreground/50">{p.units_sold} un.</span>
                        </div>
                        <div className="mt-1.5 h-[2px] rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%`, opacity: idx === 0 ? 1 : 0.3 }} />
                        </div>
                      </div>
                      <span className="text-sm font-bold text-primary tabular-nums shrink-0">{fmt(Number(p.gmv))}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pagamentos */}
          {feeBreakdown && !finLoading && (Number(feeBreakdown.pix_count) > 0 || Number(feeBreakdown.credit_count) > 0 || Number(feeBreakdown.debit_count) > 0) && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-[3px] h-3.5 rounded-full bg-blue-500" />
                <h2 className="text-sm font-semibold text-muted-foreground">Pagamentos</h2>
              </div>
              <div className="space-y-2.5">
                {Number(feeBreakdown.pix_count) > 0 && (
                  <div className="rounded-xl border border-border/40 bg-card/30 p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-foreground">PIX</span>
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {feeBreakdown.pix_count} transações
                      </span>
                    </div>
                    <p className="text-xl font-bold text-foreground tabular-nums mb-2">
                      {fmt(Number(feeBreakdown.pix_bruto))}
                    </p>
                    <p className="text-[10px] text-muted-foreground/50">
                      Asaas: <span className="text-muted-foreground">{fmt(Number(feeBreakdown.pix_taxa_asaas))}</span>
                      {" · "}Close Out: <span className="text-muted-foreground">{fmt(Number(feeBreakdown.pix_taxa_closeout))}</span>
                    </p>
                  </div>
                )}
                {Number(feeBreakdown.credit_count) > 0 && (
                  <div className="rounded-xl border border-border/40 bg-card/30 p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-foreground">Cartão de Crédito</span>
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {feeBreakdown.credit_count} transações
                      </span>
                    </div>
                    <p className="text-xl font-bold text-foreground tabular-nums mb-2">
                      {fmt(Number(feeBreakdown.credit_bruto))}
                    </p>
                    <p className="text-[10px] text-muted-foreground/50">
                      Asaas: <span className="text-muted-foreground">{fmt(Number(feeBreakdown.credit_taxa_asaas))}</span>
                      {" · "}Close Out: <span className="text-muted-foreground">{fmt(Number(feeBreakdown.credit_taxa_closeout))}</span>
                    </p>
                  </div>
                )}
                {Number(feeBreakdown.debit_count) > 0 && (
                  <div className="rounded-xl border border-border/40 bg-card/30 p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-foreground">Cartão de Débito</span>
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {feeBreakdown.debit_count} transações
                      </span>
                    </div>
                    <p className="text-xl font-bold text-foreground tabular-nums mb-2">
                      {fmt(Number(feeBreakdown.debit_bruto))}
                    </p>
                    <p className="text-[10px] text-muted-foreground/50">
                      Asaas: <span className="text-muted-foreground">{fmt(Number(feeBreakdown.debit_taxa_asaas))}</span>
                      {" · "}Close Out: <span className="text-muted-foreground">{fmt(Number(feeBreakdown.debit_taxa_closeout))}</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Feature cards — quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {cards.map((c) => (
          <div
            key={c.titleKey}
            onClick={() => navigate(c.url)}
            className="rounded-xl border border-border/30 bg-card/20 p-4 cursor-pointer transition-all hover:border-primary/20 hover:bg-card/40 text-center"
          >
            <c.icon className="h-4 w-4 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-xs font-medium text-muted-foreground">{t(c.titleKey)}</p>
            <p className="text-[10px] text-muted-foreground/30 mt-0.5">{t(c.descKey)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
