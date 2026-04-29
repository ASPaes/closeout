import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminPeriodFilter } from "@/components/AdminPeriodFilter";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { DollarSign, Percent, Receipt, ShoppingCart, Users } from "lucide-react";
import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n ?? 0);
const formatInt = (n: number) => new Intl.NumberFormat("pt-BR").format(n ?? 0);
const formatPct = (n: number) => `${((n ?? 0) * 100).toFixed(1)}%`;

const methodLabels: Record<string, string> = {
  pix: "PIX",
  credit_card: "Crédito",
  debit_card: "Débito",
  cash: "Dinheiro",
};
const methodLabel = (m: string) => methodLabels[m] ?? m;

type Granularity = "day" | "hour";

function formatBucket(bucket: string, granularity: Granularity): string {
  const d = new Date(bucket);
  if (granularity === "hour") {
    return `${String(d.getHours()).padStart(2, "0")}:00`;
  }
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function periodSubtitle(granularity: Granularity): string {
  return granularity === "hour" ? "Período selecionado, por hora" : "Período selecionado, por dia";
}

interface ClientItem {
  id: string;
  name: string;
}
interface VenueItem {
  id: string;
  name: string;
  client_id: string;
}

export default function AnaliseGMV() {
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return { start, end };
  });
  const [clientId, setClientId] = useState<string | null>(null);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [data, setData] = useState<any | null>(null);
  const [clientsList, setClientsList] = useState<ClientItem[]>([]);
  const [venuesList, setVenuesList] = useState<VenueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Carrega dropdowns 1x
  useEffect(() => {
    const loadFilters = async () => {
      const [c, v] = await Promise.all([
        supabase.from("clients").select("id, name").eq("status", "active").order("name"),
        supabase
          .from("venues")
          .select("id, name, client_id")
          .eq("status", "active")
          .order("name"),
      ]);
      if (c.data) setClientsList(c.data as ClientItem[]);
      if (v.data) setVenuesList(v.data as VenueItem[]);
    };
    loadFilters();
  }, []);

  const filteredVenues = useMemo(() => {
    if (!clientId) return venuesList;
    return venuesList.filter((v) => v.client_id === clientId);
  }, [venuesList, clientId]);

  const granularity = useMemo<Granularity>(() => {
    const diffMs = dateRange.end.getTime() - dateRange.start.getTime();
    return diffMs <= 86400000 ? "hour" : "day";
  }, [dateRange]);

  // Busca dados quando filtros mudam
  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      const { start, end } = dateRange;
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "get_gmv_metrics" as any,
        {
          p_start_date: start.toISOString(),
          p_end_date: end.toISOString(),
          p_client_id: clientId,
          p_venue_id: venueId,
          p_payment_method: paymentMethod,
          p_granularity: granularity,
        } as any,
      );
      if (cancelled) return;
      if (rpcError) {
        setError(rpcError.message);
        setLoading(false);
        return;
      }
      setData(rpcData);
      setError(null);
      setLoading(false);
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [dateRange, clientId, venueId, paymentMethod, reloadKey, granularity]);

  const chartData = useMemo(() => {
    if (!data?.timeseries) return [];
    return data.timeseries.map((p: any) => ({
      ...p,
      label: formatBucket(p.bucket, granularity),
    }));
  }, [data, granularity]);

  const kpis = data?.kpis ?? {};
  const topClients: any[] = data?.top_clients ?? [];
  const topVenues: any[] = data?.top_venues ?? [];
  const byMethod: any[] = data?.by_payment_method ?? [];

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">GMV & Transações</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Volume financeiro que passa pela plataforma
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:flex-wrap">
          <AdminPeriodFilter onRangeChange={(start, end) => setDateRange({ start, end })} />

          <Select
            value={clientId ?? "all"}
            onValueChange={(v) => {
              const next = v === "all" ? null : v;
              setClientId(next);
              setVenueId(null); // limpa venue ao trocar cliente
            }}
          >
            <SelectTrigger className="w-full lg:w-[200px]">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clientsList.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={venueId ?? "all"}
            onValueChange={(v) => setVenueId(v === "all" ? null : v)}
            disabled={filteredVenues.length === 0}
          >
            <SelectTrigger className="w-full lg:w-[200px]">
              <SelectValue placeholder="Local" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os locais</SelectItem>
              {filteredVenues.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={paymentMethod ?? "all"}
            onValueChange={(v) => setPaymentMethod(v === "all" ? null : v)}
          >
            <SelectTrigger className="w-full lg:w-[180px]">
              <SelectValue placeholder="Método" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os métodos</SelectItem>
              <SelectItem value="pix">PIX</SelectItem>
              <SelectItem value="credit_card">Crédito</SelectItem>
              <SelectItem value="debit_card">Débito</SelectItem>
              <SelectItem value="cash">Dinheiro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive-foreground border border-destructive/30 p-4 flex items-center justify-between">
          <p className="text-sm">{error}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setReloadKey((k) => k + 1)}
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[110px] w-full" />
            ))
          : (
            <>
              <KpiCard
                title="GMV Total"
                value={formatBRL(kpis.gmv_total)}
                icon={<DollarSign className="h-4 w-4 text-primary" />}
                subtitle={`Fees: ${formatBRL(kpis.fees_total)}`}
                tooltip="Volume total de pagamentos aprovados no período, considerando os filtros aplicados. É o 'tamanho' do que passou pela plataforma."
              />
              <KpiCard
                title="Take Rate"
                value={formatPct(kpis.take_rate_medio)}
                icon={<Percent className="h-4 w-4 text-primary" />}
                tooltip="Percentual do GMV que ficou com a plataforma como receita. Calculado como fees ÷ GMV. Quanto maior, mais a plataforma captura por transação."
              />
              <KpiCard
                title="Ticket Médio"
                value={formatBRL(kpis.ticket_medio)}
                icon={<Receipt className="h-4 w-4 text-primary" />}
                tooltip="Valor médio de cada pagamento aprovado no período. Calculado como GMV ÷ total de pagamentos. Não é o mesmo que valor médio por pedido."
              />
              <KpiCard
                title="Total Pedidos"
                value={formatInt(kpis.total_pedidos)}
                icon={<ShoppingCart className="h-4 w-4 text-primary" />}
                tooltip="Quantidade de pedidos distintos (por order_id) que geraram ao menos um pagamento aprovado no período. Um pedido pode ter múltiplos pagamentos (split)."
              />
              <KpiCard
                title="Consumers Únicos"
                value={formatInt(kpis.consumers_unicos)}
                icon={<Users className="h-4 w-4 text-primary" />}
                className="col-span-2 lg:col-span-1"
                tooltip="Consumidores distintos (por consumer_id) que fizeram ao menos um pagamento aprovado no período. Mede base ativa, não transações."
              />
            </>
          )}
      </div>

      {/* GRÁFICO */}
      <Card className="hover:border-primary/20 transition-colors">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Evolução do GMV</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {periodSubtitle(granularity)}
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider shrink-0">
            GMV vs Fees
          </Badge>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[280px] w-full" />
          ) : chartData.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
              Sem dados no período
            </div>
          ) : (
            <ChartContainer
              config={{
                gmv: { label: "GMV", color: "hsl(24, 100%, 50%)" },
                fees: { label: "Fees", color: "hsl(24, 100%, 70%)" },
              }}
              className="h-[280px] w-full"
            >
              <LineChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={70}
                  tickFormatter={(v) => formatBRL(v as number)}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => [
                        formatBRL(value as number),
                        name === "gmv" ? "GMV" : "Fees",
                      ]}
                    />
                  }
                />
                <Line
                  type="monotone"
                  dataKey="gmv"
                  stroke="var(--color-gmv)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="fees"
                  stroke="var(--color-fees)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* TOP CLIENTES + TOP LOCAIS */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="hover:border-primary/20 transition-colors">
          <CardHeader>
            <CardTitle>Top Clientes</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Maior GMV no período</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : topClients.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados no período</p>
            ) : (
              <ul className="space-y-3">
                {topClients.map((c, idx) => (
                  <li
                    key={c.client_id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40 transition-colors"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {c.client_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatInt(c.payment_count)} pedido(s) · Fees: {formatBRL(c.fees)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-foreground shrink-0">
                      {formatBRL(c.gmv)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="hover:border-primary/20 transition-colors">
          <CardHeader>
            <CardTitle>Top Locais</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Venues com maior volume</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : topVenues.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados no período</p>
            ) : (
              <ul className="space-y-3">
                {topVenues.map((v, idx) => (
                  <li
                    key={v.venue_id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40 transition-colors"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {v.venue_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {v.client_name} · {formatInt(v.payment_count)} pedido(s)
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-foreground shrink-0">
                      {formatBRL(v.gmv)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* BREAKDOWN POR MÉTODO */}
      <Card className="hover:border-primary/20 transition-colors">
        <CardHeader>
          <CardTitle>Distribuição por Método de Pagamento</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Volume transacionado em cada método
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : byMethod.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados no período</p>
          ) : (
            <div className="space-y-4">
              {byMethod.map((m) => {
                const pct = Math.max(0, Math.min(1, m.pct_volume ?? 0));
                return (
                  <div key={m.method}>
                    <div className="flex items-center justify-between mb-1.5 text-sm">
                      <span className="font-medium text-foreground">
                        {methodLabel(m.method)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatBRL(m.volume)} · {formatInt(m.count)} pgto(s) ·{" "}
                        {formatPct(m.pct_volume)}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </TooltipProvider>
  );
}

function KpiCard({
  title,
  value,
  icon,
  subtitle,
  className,
  tooltip,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  subtitle?: string;
  className?: string;
  tooltip?: string;
}) {
  return (
    <Card className={`hover:border-primary/20 transition-colors ${className ?? ""}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-1.5">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                  aria-label={`Sobre ${title}`}
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-sm">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}