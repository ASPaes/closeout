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
import { Package, Tags, Layers, Megaphone, Warehouse, CalendarDays, Banknote, ShoppingCart, Clock, CheckCircle2, AlertTriangle, UserCheck, CalendarIcon } from "lucide-react";
import type { TranslationKey } from "@/i18n/translations/pt-BR";

const cards: { titleKey: TranslationKey; descKey: TranslationKey; icon: any; url: string }[] = [
  { titleKey: "gestor_products", descKey: "gestor_products_desc", icon: Package, url: "/gestor/produtos" },
  { titleKey: "gestor_categories", descKey: "gestor_categories_desc", icon: Tags, url: "/gestor/categorias" },
  { titleKey: "gestor_combos", descKey: "gestor_combos_desc", icon: Layers, url: "/gestor/combos" },
  { titleKey: "gestor_campaigns", descKey: "gestor_campaigns_desc", icon: Megaphone, url: "/gestor/campanhas" },
  { titleKey: "gestor_stock", descKey: "gestor_stock_desc", icon: Warehouse, url: "/gestor/estoque" },
  { titleKey: "events", descKey: "manage_events", icon: CalendarDays, url: "/gestor/eventos" },
];

type ActiveEvent = { id: string; name: string };

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

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">C</div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("gestor_panel")}</h1>
            <p className="text-muted-foreground">
              {t("welcome_back")}, {profile?.name || "Gestor"}
              {clientName && (
                <span className="ml-2 text-sm font-medium text-foreground">
                  — {clientName}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
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

      {/* Hero financial strip */}
      <div className="flex items-stretch rounded-2xl border border-border/30 overflow-hidden">
        <div className="flex-[2] p-6 bg-primary/[0.03] text-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/50 mb-3">
            Faturamento confirmado
          </p>
          {finLoading ? (
            <Skeleton className="h-12 w-48 mx-auto" />
          ) : (
            <p className="text-5xl font-extrabold text-foreground tracking-tight tabular-nums">
              {fmt(finRevenue)}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground/40 mt-2">Pagamentos confirmados</p>
        </div>
        <div className="w-px bg-border/20" />
        <div className="flex-1 p-5 bg-card/30">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2">Recebido líquido</p>
          {finLoading ? <Skeleton className="h-6 w-20" /> : (
            <p className="text-xl font-semibold text-foreground tabular-nums">{fmt(finNet)}</p>
          )}
          <p className="text-[11px] text-muted-foreground/40 mt-1">Valor repassado</p>
        </div>
        <div className="w-px bg-border/20" />
        <div className="flex-1 p-5 bg-card/30">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2">Taxa Close Out</p>
          {finLoading ? <Skeleton className="h-6 w-20" /> : (
            <p className="text-xl font-semibold text-primary tabular-nums">{fmt(finCloseout)}</p>
          )}
          <p className="text-[11px] text-muted-foreground/40 mt-1">Retido pela plataforma</p>
        </div>
        <div className="w-px bg-border/20" />
        <div className="flex-1 p-5 bg-card/30">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2">Taxa Gateway</p>
          {finLoading ? <Skeleton className="h-6 w-20" /> : (
            <p className="text-xl font-semibold text-foreground tabular-nums">{fmt(finAsaasFee)}</p>
          )}
          <p className="text-[11px] text-muted-foreground/40 mt-1">{finAsaasFeePercent}% médio · Asaas</p>
        </div>
        <div className="w-px bg-border/20" />
        <div className="flex-1 p-5 bg-card/30">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2">Pendentes</p>
          {finLoading ? <Skeleton className="h-6 w-20" /> : (
            <p className="text-xl font-semibold text-foreground tabular-nums flex items-center gap-2">
              {finPending}
              {finPending > 0 && <Badge variant="outline" className="bg-yellow-500/15 text-yellow-500 border-yellow-500/30 text-xs">Aguardando</Badge>}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground/40 mt-1">Pagamentos não confirmados</p>
        </div>
      </div>

      {/* Unretrieved orders alert */}
      {unretrievedOrders.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {t("gbar_unretrieved_alert" as any)} ({unretrievedOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {unretrievedOrders.slice(0, 5).map((o) => (
                <div key={o.order_number} className="flex items-center justify-between text-sm">
                  <span className="font-medium">#{String(o.order_number).padStart(3, "0")}</span>
                  <Badge variant="destructive" className="text-xs">{o.minutes} min</Badge>
                </div>
              ))}
              {unretrievedOrders.length > 5 && (
                <p className="text-xs text-muted-foreground">+{unretrievedOrders.length - 5} {t("gbar_more_orders" as any)}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
