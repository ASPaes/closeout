import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/i18n/use-translation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useGestor } from "@/contexts/GestorContext";
import { supabase } from "@/integrations/supabase/client";
import { Package, Tags, Layers, Megaphone, Warehouse, CalendarDays, Banknote, ShoppingCart, Clock, CheckCircle2, AlertTriangle, Beer, UserCheck, DollarSign, CreditCard, TrendingUp, Hourglass } from "lucide-react";
import type { TranslationKey } from "@/i18n/translations/pt-BR";

const cards: { titleKey: TranslationKey; descKey: TranslationKey; icon: any; url: string }[] = [
  { titleKey: "gestor_products", descKey: "gestor_products_desc", icon: Package, url: "/gestor/produtos" },
  { titleKey: "gestor_categories", descKey: "gestor_categories_desc", icon: Tags, url: "/gestor/categorias" },
  { titleKey: "gestor_combos", descKey: "gestor_combos_desc", icon: Layers, url: "/gestor/combos" },
  { titleKey: "gestor_campaigns", descKey: "gestor_campaigns_desc", icon: Megaphone, url: "/gestor/campanhas" },
  { titleKey: "gestor_stock", descKey: "gestor_stock_desc", icon: Warehouse, url: "/gestor/estoque" },
  { titleKey: "events", descKey: "manage_events", icon: CalendarDays, url: "/gestor/eventos" },
];

type FinancialCharge = {
  id: string;
  amount: number;
  billing_type: string;
  asaas_status: string;
  created_at: string;
  order_id: string;
  order_number?: number;
  split_amount: number | null;
  closeout_amount: number | null;
};

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
  const [finTransactions, setFinTransactions] = useState<FinancialCharge[]>([]);
  const [finLoading, setFinLoading] = useState(false);

  useEffect(() => {
    if (!effectiveClientId) return;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Count open registers
    supabase
      .from("cash_registers")
      .select("id", { count: "exact", head: true })
      .eq("client_id", effectiveClientId)
      .eq("status", "open")
      .then(({ count }) => setOpenRegisters(count ?? 0));

    // Sum today's sales
    supabase
      .from("cash_orders")
      .select("total")
      .eq("client_id", effectiveClientId)
      .eq("status", "completed")
      .gte("created_at", todayStart.toISOString())
      .then(({ data }) => {
        const sum = (data ?? []).reduce((acc, o) => acc + Number(o.total), 0);
        setSalesToday(sum);
      });

    // Active waiters
    supabase
      .from("waiter_sessions" as any)
      .select("id", { count: "exact", head: true })
      .eq("client_id", effectiveClientId)
      .is("closed_at", null)
      .then(({ count }) => setActiveWaiters(count ?? 0));

    // Pending cancellations
    supabase
      .from("waiter_cancellation_requests" as any)
      .select("id", { count: "exact", head: true })
      .eq("client_id", effectiveClientId)
      .eq("status", "pending")
      .then(({ count }) => setPendingCancellations(count ?? 0));

    // Bar: queue count
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("client_id", effectiveClientId)
      .in("status", ["pending", "paid", "preparing"])
      .then(({ count }) => setBarQueue(count ?? 0));

    // Bar: ready count
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("client_id", effectiveClientId)
      .eq("status", "ready")
      .then(({ count }) => setBarReady(count ?? 0));

    // Bar: delivered today
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("client_id", effectiveClientId)
      .eq("status", "delivered")
      .gte("delivered_at", todayStart.toISOString())
      .then(({ count }) => setBarDeliveredToday(count ?? 0));

    // Bar: avg prep time (ready_at - paid_at)
    supabase
      .from("orders")
      .select("paid_at, ready_at")
      .eq("client_id", effectiveClientId)
      .eq("status", "delivered")
      .not("paid_at", "is", null)
      .not("ready_at", "is", null)
      .gte("ready_at", todayStart.toISOString())
      .limit(200)
      .then(({ data }) => {
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
    supabase
      .from("orders")
      .select("order_number, ready_at, notes")
      .eq("client_id", effectiveClientId)
      .eq("status", "ready")
      .not("ready_at", "is", null)
      .order("ready_at", { ascending: true })
      .limit(50)
      .then(({ data }) => {
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
  }, [effectiveClientId]);

  // Financial data fetch
  const fetchFinancials = useCallback(async () => {
    if (!effectiveClientId) return;
    setFinLoading(true);

    let query = supabase
      .from("asaas_charges")
      .select("id, amount, billing_type, asaas_status, created_at, order_id, split_amount, closeout_amount")
      .eq("client_id", effectiveClientId)
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

    // Fetch order numbers for last 10
    const last10 = charges.slice(0, 10);
    if (last10.length > 0) {
      const orderIds = [...new Set(last10.map((c) => c.order_id))];
      const { data: orders } = await supabase
        .from("orders")
        .select("id, order_number")
        .in("id", orderIds);
      const orderMap = new Map((orders ?? []).map((o) => [o.id, o.order_number]));
      setFinTransactions(last10.map((c) => ({ ...c, order_number: orderMap.get(c.order_id) })));
    } else {
      setFinTransactions([]);
    }

    setFinLoading(false);
  }, [effectiveClientId, selectedEventId]);

  useEffect(() => { fetchFinancials(); }, [fetchFinancials]);

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  const billingLabel = (type: string) => {
    const map: Record<string, string> = { PIX: "PIX", CREDIT_CARD: "Crédito", DEBIT_CARD: "Débito", BOLETO: "Boleto" };
    return map[type] ?? type;
  };

  const statusBadge = (s: string) => {
    if (s === "CONFIRMED" || s === "RECEIVED") return <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-[10px]">Pago</Badge>;
    if (s === "PENDING") return <Badge variant="secondary" className="bg-yellow-500/15 text-yellow-500 border-yellow-500/30 text-[10px]">Pendente</Badge>;
    if (s === "OVERDUE" || s === "REFUNDED") return <Badge variant="destructive" className="text-[10px]">{s === "REFUNDED" ? "Estornado" : "Vencido"}</Badge>;
    return <Badge variant="outline" className="text-[10px]">{s}</Badge>;
  };

  return (
    <div className="space-y-6">
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
            <CardTitle className="text-sm font-medium">{t("gcx_sales_today")}</CardTitle>
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Financeiro
          </h2>
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

        {/* Recent transactions table */}
        {finTransactions.length > 0 && (
          <Card className="mt-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Últimas Transações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-2 font-medium text-muted-foreground">Pedido</th>
                      <th className="text-left py-2 font-medium text-muted-foreground">Método</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Valor</th>
                      <th className="text-center py-2 font-medium text-muted-foreground">Status</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finTransactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-border/30 last:border-0">
                        <td className="py-2 font-mono text-xs">
                          #{tx.order_number ? String(tx.order_number).padStart(3, "0") : "—"}
                        </td>
                        <td className="py-2">
                          <Badge variant="outline" className="text-[10px]">{billingLabel(tx.billing_type)}</Badge>
                        </td>
                        <td className="py-2 text-right font-medium">{fmt(Number(tx.amount))}</td>
                        <td className="py-2 text-center">{statusBadge(tx.asaas_status)}</td>
                        <td className="py-2 text-right text-muted-foreground text-xs">
                          {new Date(tx.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
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
