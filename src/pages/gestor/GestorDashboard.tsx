import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/i18n/use-translation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Package, Tags, Layers, Megaphone, Warehouse, CalendarDays, Banknote, ShoppingCart, Clock, CheckCircle2, AlertTriangle, Beer, UserCheck, DollarSign, CreditCard, TrendingUp, Hourglass, CalendarIcon } from "lucide-react";
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
  const [finPending, setFinPending] = useState(0);
  const [finLoading, setFinLoading] = useState(false);

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

    let query = supabase
      .from("asaas_charges")
      .select("id, amount, billing_type, asaas_status, created_at, order_id, split_amount, closeout_amount")
      .eq("client_id", effectiveClientId)
      .gte("created_at", filterStart.toISOString())
      .lte("created_at", filterEnd.toISOString())
      .order("created_at", { ascending: false });

    if (selectedEventId !== "all") {
      query = query.eq("event_id", selectedEventId);
    }

    const { data } = await query.limit(500);
    const charges = data ?? [];

    // Metrics
    const confirmed = charges.filter((c) => ["CONFIRMED", "RECEIVED"].includes(c.asaas_status));
    const revenue = confirmed.reduce((acc, c) => acc + Number(c.amount), 0);
    const net = confirmed.reduce((acc, c) => acc + Number(c.split_amount ?? 0), 0);
    const closeout = confirmed.reduce((acc, c) => acc + Number(c.closeout_amount ?? 0), 0);
    const pending = charges.filter((c) => c.asaas_status === "PENDING").length;

    setFinRevenue(revenue);
    setFinNet(net);
    setFinCloseout(closeout);
    setFinPending(pending);

    setFinLoading(false);
  }, [effectiveClientId, selectedEventId, filterStart.getTime(), filterEnd.getTime()]);

  useEffect(() => { fetchFinancials(); }, [fetchFinancials]);

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
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

      {/* Live metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("gcx_open_registers")}</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openRegisters}</div>
            <p className="text-xs text-muted-foreground">{t("gcx_open_registers_desc")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas no Caixa</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(salesToday)}</div>
            <p className="text-xs text-muted-foreground">{t("gcx_sales_today_desc")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("gw_active_waiters" as any)}</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeWaiters}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("gw_pending_cancellations" as any)}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {pendingCancellations}
              {pendingCancellations > 0 && (
                <Badge variant="destructive" className="text-xs">{pendingCancellations}</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial metrics */}
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <DollarSign className="h-5 w-5 text-primary" />
          Financeiro
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Faturamento</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {finLoading ? <Skeleton className="h-8 w-24" /> : (
                <div className="text-2xl font-bold">{fmt(finRevenue)}</div>
              )}
              <p className="text-xs text-muted-foreground">Pagamentos confirmados</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recebido (líquido)</CardTitle>
              <Banknote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {finLoading ? <Skeleton className="h-8 w-24" /> : (
                <div className="text-2xl font-bold">{fmt(finNet)}</div>
              )}
              <p className="text-xs text-muted-foreground">Valor repassado ao estabelecimento</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa Close Out</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {finLoading ? <Skeleton className="h-8 w-24" /> : (
                <div className="text-2xl font-bold">{fmt(finCloseout)}</div>
              )}
              <p className="text-xs text-muted-foreground">Retido pela plataforma</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Hourglass className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {finLoading ? <Skeleton className="h-8 w-24" /> : (
                <div className="text-2xl font-bold flex items-center gap-2">
                  {finPending}
                  {finPending > 0 && <Badge variant="outline" className="bg-yellow-500/15 text-yellow-500 border-yellow-500/30 text-xs">Aguardando</Badge>}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Pagamentos não confirmados</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bar metrics */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Beer className="h-5 w-5 text-primary" />
          {t("gbar_section_title" as any)}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("gbar_queue" as any)}</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                {barQueue}
                {barQueue > 10 && <Badge variant="outline" className="bg-yellow-500/15 text-yellow-500 border-yellow-500/30 text-xs">Alto</Badge>}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("gbar_ready" as any)}</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                {barReady}
                {barReady > 0 && <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("gbar_avg_prep" as any)}</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {barAvgPrepMin !== null ? `${barAvgPrepMin} min` : "—"}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("gbar_delivered_today" as any)}</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{barDeliveredToday}</div>
            </CardContent>
          </Card>
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

      {/* Feature cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.titleKey} className="cursor-pointer transition-colors hover:border-primary/40 hover:bg-accent/50" onClick={() => navigate(c.url)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t(c.titleKey)}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{t(c.descKey)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
