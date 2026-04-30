import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { AdminPeriodFilter } from "@/components/AdminPeriodFilter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, ChevronLeft, ChevronRight, HelpCircle, Receipt, CheckCircle2, XCircle, Clock, Eye, ArrowLeft, CalendarDays } from "lucide-react";

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n ?? 0);
const formatInt = (n: number) => new Intl.NumberFormat("pt-BR").format(n ?? 0);
const formatDateTimeBR = (iso: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
};
const formatCPF = (cpf: string | null) => {
  if (!cpf) return "-";
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  processing_payment: "Processando pgto",
  partially_paid: "Parcialmente pago",
  paid: "Pago",
  preparing: "Preparando",
  ready: "Pronto",
  partially_delivered: "Parc. entregue",
  delivered: "Entregue",
  cancelled: "Cancelado",
};
const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  processing_payment: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  partially_paid: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  paid: "bg-green-500/15 text-green-400 border-green-500/30",
  preparing: "bg-primary/15 text-primary border-primary/30",
  ready: "bg-primary/15 text-primary border-primary/30",
  partially_delivered: "bg-primary/15 text-primary border-primary/30",
  delivered: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  cancelled: "bg-red-500/15 text-red-400 border-red-500/30",
};
const originLabels: Record<string, string> = {
  consumer_app: "Consumer App",
  waiter_app: "Garçom",
  cashier: "Caixa",
};
const methodLabels: Record<string, string> = {
  pix: "PIX",
  credit_card: "Crédito",
  debit_card: "Débito",
  cash: "Dinheiro",
};

const eventStatusConfig: Record<string, { label: string; color: string }> = {
  active: { label: "Ativo", color: "text-green-400 bg-green-400/10 border-green-400/30" },
  completed: { label: "Concluído", color: "text-muted-foreground bg-muted/30 border-border" },
  cancelled: { label: "Cancelado", color: "text-red-400 bg-red-400/10 border-red-400/30" },
  draft: { label: "Rascunho", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" },
};

const formatEventDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const ALL_STATUSES = [
  "pending", "processing_payment", "partially_paid", "paid", "preparing",
  "ready", "partially_delivered", "delivered", "cancelled",
];

function KpiCard({ title, value, icon, tooltip, iconClassName }: { title: string; value: string; icon: React.ReactNode; tooltip: string; iconClassName?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            {title}
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3 w-3 text-muted-foreground/50 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs"><p className="text-xs">{tooltip}</p></TooltipContent>
            </Tooltip>
          </CardTitle>
          <div className={iconClassName ?? "text-muted-foreground"}>{icon}</div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-xl font-bold text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function OperacoesPedidos() {
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return { start, end };
  });
  const [statuses, setStatuses] = useState<string[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [originFilter, setOriginFilter] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any | null>(null);
  const [clientsList, setClientsList] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Two-view state
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEventName, setSelectedEventName] = useState<string>("");
  const [eventsData, setEventsData] = useState<any | null>(null);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventSearch, setEventSearch] = useState("");

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchText), 500);
    return () => clearTimeout(t);
  }, [searchText]);

  // Load clients dropdown once
  useEffect(() => {
    const load = async () => {
      const c = await supabase.from("clients").select("id, name").eq("status", "active").order("name");
      if (c.data) setClientsList(c.data as any);
    };
    load();
  }, []);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [dateRange, statuses, originFilter, searchDebounced, selectedEventId]);

  // Events summary fetch (cards view)
  useEffect(() => {
    if (selectedEventId !== null) return;
    const fetchEvents = async () => {
      setEventsLoading(true);
      const { start, end } = dateRange;
      const { data, error } = await supabase.rpc("get_orders_event_summary" as any, {
        p_start_date: start.toISOString(),
        p_end_date: end.toISOString(),
        p_client_id: clientId,
      } as any);
      if (error) { setError(error.message); setEventsLoading(false); return; }
      setEventsData(data); setError(null); setEventsLoading(false);
    };
    fetchEvents();
  }, [dateRange, clientId, selectedEventId]);

  // Orders fetch (only when an event is selected)
  useEffect(() => {
    if (selectedEventId === null) return;
    const fetchData = async () => {
      setLoading(true);
      const { start, end } = dateRange;
      const { data, error } = await supabase.rpc("get_orders_global" as any, {
        p_start_date: start.toISOString(),
        p_end_date: end.toISOString(),
        p_statuses: statuses.length > 0 ? statuses : null,
        p_client_id: clientId,
        p_event_id: selectedEventId,
        p_origin: originFilter,
        p_search: searchDebounced.trim() || null,
        p_page: page,
        p_page_size: 50,
      } as any);
      if (error) { setError(error.message); setLoading(false); return; }
      setData(data); setError(null); setLoading(false);
    };
    fetchData();
  }, [dateRange, statuses, clientId, selectedEventId, originFilter, searchDebounced, page]);

  const loadOrderDetail = async (orderId: string) => {
    setSelectedOrderId(orderId);
    setLoadingDetail(true);
    const { data, error } = await supabase.rpc("get_order_detail" as any, { p_order_id: orderId } as any);
    if (error) { console.error(error); setOrderDetail(null); }
    else { setOrderDetail(data); }
    setLoadingDetail(false);
  };

  const handleBack = () => {
    setSelectedEventId(null);
    setSelectedEventName("");
    setData(null);
    setStatuses([]);
    setOriginFilter(null);
    setSearchText("");
    setSearchDebounced("");
    setPage(1);
  };

  const summary = data?.summary;
  const eventsSummary = eventsData?.summary;
  const eventsList = (eventsData?.events ?? []) as any[];

  const filteredEvents = useMemo(() => {
    if (!eventsData?.events) return [];
    if (!eventSearch.trim()) return eventsData.events;
    const q = eventSearch.toLowerCase().trim();
    return eventsData.events.filter((ev: any) =>
      ev.event_name?.toLowerCase().includes(q) ||
      ev.client_name?.toLowerCase().includes(q)
    );
  }, [eventsData, eventSearch]);

  // ============= EVENTS CARDS VIEW =============
  if (selectedEventId === null) {
    return (
      <TooltipProvider delayDuration={200}>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Pedidos</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Selecione um evento para ver seus pedidos
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={clientId ?? "all"} onValueChange={(v) => setClientId(v === "all" ? null : v)}>
                <SelectTrigger className="w-[200px] h-10"><SelectValue placeholder="Cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos clientes</SelectItem>
                  {clientsList.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <AdminPeriodFilter onRangeChange={(start, end) => setDateRange({ start, end })} />
            </div>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg p-4 flex items-center justify-between">
              <p className="text-sm">{error}</p>
              <Button size="sm" variant="outline" onClick={() => setError(null)}>OK</Button>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {eventsLoading || !eventsSummary ? (
              Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)
            ) : (
              <>
                <KpiCard title="Total" value={formatInt(eventsSummary.total_orders)} icon={<Receipt className="h-4 w-4" />} tooltip="Quantidade total de pedidos no período." />
                <KpiCard title="GMV" value={formatBRL(eventsSummary.gmv)} icon={<Receipt className="h-4 w-4" />} tooltip="Soma dos totais dos pedidos pagos e não cancelados no período." />
                <KpiCard title="Pendentes" value={formatInt(eventsSummary.pending_count)} icon={<Clock className="h-4 w-4" />} iconClassName="text-yellow-400" tooltip="Pedidos em pending, processing_payment ou partially_paid." />
                <KpiCard title="Pagos" value={formatInt(eventsSummary.paid_count)} icon={<CheckCircle2 className="h-4 w-4" />} iconClassName="text-green-400" tooltip="Pedidos com pagamento aprovado e não cancelados." />
                <KpiCard title="Cancelados" value={formatInt(eventsSummary.cancelled_count)} icon={<XCircle className="h-4 w-4" />} iconClassName="text-red-400" tooltip="Pedidos com status='cancelled'." />
                <KpiCard title="Ticket Médio" value={formatBRL(eventsSummary.avg_ticket)} icon={<Receipt className="h-4 w-4" />} tooltip="Valor médio dos pedidos pagos e não cancelados." />
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar evento..."
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                className="pl-9 h-10"
              />
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{filteredEvents.length} evento(s)</span>
          </div>

          {eventsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
            </div>
          ) : eventsList.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>Nenhum evento com pedidos no período</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEvents.map((ev: any) => {
                const cfg = eventStatusConfig[ev.event_status] ?? { label: ev.event_status, color: "text-muted-foreground bg-muted/30 border-border" };
                return (
                  <button
                    key={ev.event_id}
                    onClick={() => { setSelectedEventId(ev.event_id); setSelectedEventName(ev.event_name); }}
                    className="w-full text-left rounded-xl border border-border/60 p-4 hover:border-primary/30 transition-all active:scale-[0.99] bg-card"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-xs text-muted-foreground">{ev.client_name}</p>
                        <h3 className="text-base font-bold text-foreground mt-0.5">{ev.event_name}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{formatEventDate(ev.start_at)}</p>
                      </div>
                      <Badge variant="outline" className={cn("text-[10px] shrink-0", cfg.color)}>
                        {cfg.label}
                      </Badge>
                    </div>
                    <div className="border-t border-border/30 mt-3 pt-3 flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{ev.total_orders} pedidos</span>
                        <span className="text-green-400">{ev.paid_orders} pagos</span>
                        {ev.pending_orders > 0 && <span className="text-yellow-400">{ev.pending_orders} pend.</span>}
                        {ev.cancelled_orders > 0 && <span className="text-red-400">{ev.cancelled_orders} canc.</span>}
                      </div>
                      <span className="text-sm font-bold text-primary">{formatBRL(ev.gmv)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </TooltipProvider>
    );
  }

  // ============= ORDERS LIST VIEW =============
  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-2">
            <Button variant="ghost" size="sm" onClick={handleBack} className="-ml-2 h-8 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Pedidos — {selectedEventName}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Lista de pedidos do evento com filtros e drill-down
              </p>
            </div>
          </div>
          <AdminPeriodFilter onRangeChange={(start, end) => setDateRange({ start, end })} />
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="py-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por # pedido, nome ou CPF…"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="pl-9 h-10"
                />
              </div>

              <Select value={originFilter ?? "all"} onValueChange={(v) => setOriginFilter(v === "all" ? null : v)}>
                <SelectTrigger className="w-[160px] h-10"><SelectValue placeholder="Origem" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas origens</SelectItem>
                  <SelectItem value="consumer_app">Consumer App</SelectItem>
                  <SelectItem value="waiter_app">Garçom</SelectItem>
                  <SelectItem value="cashier">Caixa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground mr-1">Status:</span>
              {ALL_STATUSES.map(s => {
                const active = statuses.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => setStatuses(active ? statuses.filter(x => x !== s) : [...statuses, s])}
                    className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
                      active
                        ? statusColors[s]
                        : "bg-background border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {statusLabels[s] ?? s}
                  </button>
                );
              })}
              {statuses.length > 0 && (
                <button
                  onClick={() => setStatuses([])}
                  className="text-[11px] px-2 py-1 text-muted-foreground hover:text-foreground"
                >
                  Limpar
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg p-4 flex items-center justify-between">
            <p className="text-sm">{error}</p>
            <Button size="sm" variant="outline" onClick={() => { setError(null); setPage(p => p); }}>Tentar novamente</Button>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {loading || !summary ? (
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)
          ) : (
            <>
              <KpiCard title="Total" value={formatInt(summary.total_orders)} icon={<Receipt className="h-4 w-4" />} tooltip="Quantidade total de pedidos no período, considerando todos os filtros aplicados." />
              <KpiCard title="GMV" value={formatBRL(summary.gmv)} icon={<Receipt className="h-4 w-4" />} tooltip="Soma dos totais dos pedidos com paid_at e status diferente de cancelled." />
              <KpiCard title="Pendentes" value={formatInt(summary.pending_count)} icon={<Clock className="h-4 w-4" />} iconClassName="text-yellow-400" tooltip="Pedidos em pending, processing_payment ou partially_paid." />
              <KpiCard title="Pagos" value={formatInt(summary.paid_count)} icon={<CheckCircle2 className="h-4 w-4" />} iconClassName="text-green-400" tooltip="Pedidos com pagamento aprovado e não cancelados." />
              <KpiCard title="Cancelados" value={formatInt(summary.cancelled_count)} icon={<XCircle className="h-4 w-4" />} iconClassName="text-red-400" tooltip="Pedidos com status='cancelled'." />
              <KpiCard title="Ticket Médio" value={formatBRL(summary.avg_ticket)} icon={<Receipt className="h-4 w-4" />} tooltip="Valor médio dos pedidos pagos e não cancelados no período." />
            </>
          )}
        </div>

        {/* Tabela */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Pedidos</CardTitle>
              {data?.pagination && (
                <span className="text-xs text-muted-foreground">
                  {formatInt(data.pagination.total_count)} encontrados · página {data.pagination.page} de {data.pagination.total_pages}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6"><Skeleton className="h-96" /></div>
            ) : !data || data.orders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum pedido encontrado com os filtros aplicados
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Pedido</th>
                      <th className="px-4 py-3 font-medium">Cliente / Evento</th>
                      <th className="px-4 py-3 font-medium">Consumer</th>
                      <th className="px-4 py-3 font-medium">Origem</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">Total</th>
                      <th className="px-4 py-3 font-medium">Criado</th>
                      <th className="px-4 py-3 font-medium text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.orders.map((o: any) => (
                      <tr key={o.order_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-foreground">#{o.order_number ?? "-"}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{o.order_id.slice(0, 8)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{o.client_name}</p>
                          <p className="text-xs text-muted-foreground">{o.event_name ?? "-"}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-foreground">{o.consumer_name ?? "-"}</p>
                          <p className="text-xs text-muted-foreground font-mono">{o.consumer_cpf ? formatCPF(o.consumer_cpf) : "-"}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-[10px]">{originLabels[o.origin] ?? o.origin}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`text-[10px] ${statusColors[o.status] ?? ""}`}>
                            {statusLabels[o.status] ?? o.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground">{formatBRL(o.total)}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDateTimeBR(o.created_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <Button size="icon" variant="ghost" onClick={() => loadOrderDetail(o.order_id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Paginação */}
            {data?.pagination && data.pagination.total_pages > 1 && (
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  {(data.pagination.page - 1) * data.pagination.page_size + 1}–
                  {Math.min(data.pagination.page * data.pagination.page_size, data.pagination.total_count)} de {formatInt(data.pagination.total_count)}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={!data.pagination.has_prev} onClick={() => setPage(p => Math.max(1, p - 1))}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                  </Button>
                  <Button size="sm" variant="outline" disabled={!data.pagination.has_next} onClick={() => setPage(p => p + 1)}>
                    Próxima <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal drill-down */}
        <Dialog open={!!selectedOrderId} onOpenChange={(open) => { if (!open) { setSelectedOrderId(null); setOrderDetail(null); } }}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Pedido #{orderDetail?.order?.order_number ?? "..."}</DialogTitle>
              <DialogDescription>Detalhes completos do pedido</DialogDescription>
            </DialogHeader>

            {loadingDetail || !orderDetail ? (
              <div className="space-y-3 py-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-32" />
                <Skeleton className="h-24" />
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</p>
                    <Badge variant="outline" className={`text-[10px] mt-1 ${statusColors[orderDetail.order.status] ?? ""}`}>
                      {statusLabels[orderDetail.order.status] ?? orderDetail.order.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
                    <p className="font-semibold text-foreground">{formatBRL(orderDetail.order.total)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cliente</p>
                    <p className="text-foreground">{orderDetail.order.client_name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Evento</p>
                    <p className="text-foreground">{orderDetail.order.event_name ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Consumer</p>
                    <p className="text-foreground">{orderDetail.order.consumer_name ?? "-"}</p>
                    <p className="text-xs text-muted-foreground font-mono">{formatCPF(orderDetail.order.consumer_cpf)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Origem</p>
                    <p className="text-foreground">{originLabels[orderDetail.order.origin] ?? orderDetail.order.origin}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Timeline</h3>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Criado</span><span>{formatDateTimeBR(orderDetail.order.created_at)}</span></div>
                    {orderDetail.order.paid_at && (
                      <div className="flex justify-between"><span className="text-muted-foreground">Pago</span><span>{formatDateTimeBR(orderDetail.order.paid_at)}</span></div>
                    )}
                    {orderDetail.order.preparing_at && (
                      <div className="flex justify-between"><span className="text-muted-foreground">Preparando</span><span>{formatDateTimeBR(orderDetail.order.preparing_at)}</span></div>
                    )}
                    {orderDetail.order.ready_at && (
                      <div className="flex justify-between"><span className="text-muted-foreground">Pronto</span><span>{formatDateTimeBR(orderDetail.order.ready_at)}</span></div>
                    )}
                    {orderDetail.order.delivered_at && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Entregue {orderDetail.order.delivered_by_name ? `por ${orderDetail.order.delivered_by_name}` : ""}</span>
                        <span>{formatDateTimeBR(orderDetail.order.delivered_at)}</span>
                      </div>
                    )}
                    {orderDetail.order.cancelled_at && (
                      <div className="flex justify-between text-red-400">
                        <span>Cancelado: {orderDetail.order.cancel_reason ?? "sem motivo"}</span>
                        <span>{formatDateTimeBR(orderDetail.order.cancelled_at)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Itens ({orderDetail.items?.length ?? 0})</h3>
                  <div className="space-y-1.5">
                    {(orderDetail.items ?? []).map((it: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm border border-border/50 rounded px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground">{it.quantity}× {it.name}</span>
                          <Badge variant="outline" className="text-[10px]">{it.type === "product" ? "Produto" : "Combo"}</Badge>
                        </div>
                        <span className="font-semibold text-foreground">{formatBRL(it.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Pagamentos ({orderDetail.payments?.length ?? 0})</h3>
                  <div className="space-y-1.5">
                    {(orderDetail.payments ?? []).map((p: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm border border-border/50 rounded px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground">{methodLabels[p.payment_method] ?? p.payment_method}</span>
                          {p.split_index && p.split_total > 1 && (
                            <Badge variant="outline" className="text-[10px]">{p.split_index}/{p.split_total}</Badge>
                          )}
                          <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                        </div>
                        <span className="font-semibold text-foreground">{formatBRL(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {orderDetail.asaas_charges && orderDetail.asaas_charges.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Asaas Charges ({orderDetail.asaas_charges.length})</h3>
                    <div className="space-y-1.5">
                      {orderDetail.asaas_charges.map((ac: any, i: number) => (
                        <div key={i} className="border border-border/50 rounded px-3 py-2 text-sm space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs text-muted-foreground">{ac.asaas_charge_id}</span>
                            <Badge variant="outline" className="text-[10px]">{ac.asaas_status}</Badge>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{ac.billing_type}</span>
                            <span className="text-muted-foreground">
                              Bruto {formatBRL(ac.amount)} · Net {formatBRL(ac.net_amount ?? 0)} · Fee {formatBRL(ac.closeout_amount ?? 0)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
