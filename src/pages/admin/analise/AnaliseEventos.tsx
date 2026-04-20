import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, Line, XAxis, YAxis, CartesianGrid, ComposedChart } from "recharts";
import { CalendarCheck, XCircle, Activity, Receipt, TrendingUp, Clock, Trophy, HelpCircle } from "lucide-react";

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n ?? 0);
const formatInt = (n: number) =>
  new Intl.NumberFormat("pt-BR").format(n ?? 0);
const formatPct = (n: number) =>
  `${((n ?? 0) * 100).toFixed(1)}%`;
const formatHours = (h: number) => {
  const hours = Math.floor(h ?? 0);
  const minutes = Math.round(((h ?? 0) - hours) * 60);
  return `${hours}h${minutes > 0 ? minutes + "min" : ""}`;
};
const formatDateBR = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
};
const statusLabels: Record<string, string> = {
  active: "Ativo", completed: "Concluído", cancelled: "Cancelado", draft: "Rascunho"
};
const statusColors: Record<string, string> = {
  active: "bg-green-500/15 text-green-400 border-green-500/30",
  completed: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  cancelled: "bg-red-500/15 text-red-400 border-red-500/30",
  draft: "bg-muted text-muted-foreground border-border"
};
const dowLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const monthLabel = (m: string) => {
  const [y, mo] = m.split("-");
  const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${months[parseInt(mo, 10) - 1]}/${y.slice(2)}`;
};

function getCellColor(count: number, max: number): string {
  if (count === 0) return "hsl(var(--muted) / 0.3)";
  const ratio = count / max;
  if (ratio <= 0.25) return "hsl(24, 100%, 50% / 0.4)";
  if (ratio <= 0.5) return "hsl(24, 100%, 50% / 0.6)";
  if (ratio <= 0.75) return "hsl(24, 100%, 50% / 0.8)";
  return "hsl(24, 100%, 55%)";
}

type Period = "today" | "7d" | "30d" | "month";

function computePeriod(period: Period): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  if (period === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (period === "7d") {
    start.setDate(start.getDate() - 7);
  } else if (period === "30d") {
    start.setDate(start.getDate() - 30);
  } else if (period === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }
  return { start, end };
}

interface KpiCardProps {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tooltip: string;
}

function KpiCard({ title, value, icon: Icon, tooltip }: KpiCardProps) {
  return (
    <Card className="hover:border-primary/20 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-sm font-medium text-muted-foreground truncate">
                {title}
              </CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground/60 hover:text-muted-foreground shrink-0">
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-sm">{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          <div className="rounded-full bg-primary/10 p-2 shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-foreground truncate">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function AnaliseEventos() {
  const [period, setPeriod] = useState<Period>("30d");
  const [clientId, setClientId] = useState<string | null>(null);
  const [data, setData] = useState<any | null>(null);
  const [clientsList, setClientsList] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("clients").select("id, name").eq("status", "active").order("name")
      .then(({ data }) => { if (data) setClientsList(data); });
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { start, end } = computePeriod(period);
    const { data: rpcData, error: rpcError } = await supabase.rpc("get_events_analytics" as any, {
      p_start_date: start.toISOString(),
      p_end_date: end.toISOString(),
      p_client_id: clientId,
    } as any);
    if (rpcError) { setError(rpcError.message); setLoading(false); return; }
    setData(rpcData);
    setError(null);
    setLoading(false);
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [period, clientId]);

  const heatmapMatrix = useMemo(() => {
    const cells: Array<{ dow: number; hour: number; count: number }> = data?.heatmap ?? [];
    const max = Math.max(1, ...cells.map((c) => c.count));
    const grid: Array<Array<number>> = Array(7).fill(null).map(() => Array(24).fill(0));
    cells.forEach((c) => {
      if (c.dow >= 0 && c.dow < 7 && c.hour >= 0 && c.hour < 24) {
        grid[c.dow][c.hour] = c.count;
      }
    });
    return { grid, max };
  }, [data]);

  const kpis = data?.kpis ?? {};

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Eventos</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Análise de eventos realizados na plataforma
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <ToggleGroup
              type="single"
              value={period}
              onValueChange={(v) => v && setPeriod(v as Period)}
              className="justify-start"
            >
              <ToggleGroupItem value="today" size="sm">Hoje</ToggleGroupItem>
              <ToggleGroupItem value="7d" size="sm">7 dias</ToggleGroupItem>
              <ToggleGroupItem value="30d" size="sm">30 dias</ToggleGroupItem>
              <ToggleGroupItem value="month" size="sm">Mês atual</ToggleGroupItem>
            </ToggleGroup>

            <Select
              value={clientId ?? "all"}
              onValueChange={(v) => setClientId(v === "all" ? null : v)}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {clientsList.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4 flex items-center justify-between gap-4">
            <p className="text-sm text-destructive">{error}</p>
            <button
              type="button"
              onClick={fetchData}
              className="text-sm font-medium text-destructive hover:underline shrink-0"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* KPIs */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {loading || !data ? (
            Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-[108px] rounded-lg" />
            ))
          ) : (
            <>
              <KpiCard title="Realizados" value={formatInt(kpis.events_realized)} icon={CalendarCheck}
                tooltip="Eventos com status 'completed' cujo horário de início está no período selecionado." />
              <KpiCard title="Cancelados" value={formatInt(kpis.events_cancelled)} icon={XCircle}
                tooltip="Eventos cancelados no período. Eventos podem ser cancelados pelo gestor a qualquer momento." />
              <KpiCard title="Ativos" value={formatInt(kpis.events_active)} icon={Activity}
                tooltip="Eventos com status 'active' cujo horário de início está no período selecionado. Pode incluir eventos já encerrados que não foram marcados como completed." />
              <KpiCard title="Taxa de Sucesso" value={formatPct(kpis.success_rate)} icon={TrendingUp}
                tooltip="Percentual de eventos concluídos com sucesso: completed ÷ (completed + cancelled). Não conta eventos ativos pendentes." />
              <KpiCard title="Ticket Médio" value={formatBRL(kpis.ticket_medio)} icon={Receipt}
                tooltip="Valor médio de cada pedido pago no período. Pedidos cancelados não entram." />
              <KpiCard title="Faturamento/Evento" value={formatBRL(kpis.faturamento_medio_evento)} icon={Receipt}
                tooltip="GMV médio por evento com ao menos 1 pedido pago. Soma pedidos pagos ÷ quantidade de eventos com vendas." />
              <KpiCard title="Duração Média" value={formatHours(kpis.duracao_media_horas)} icon={Clock}
                tooltip="Duração média (end_at - start_at) dos eventos 'completed' no período." />
            </>
          )}
        </div>

        {/* EVOLUÇÃO MENSAL */}
        <Card className="hover:border-primary/20 transition-colors">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle>Eventos Realizados por Mês</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Últimos 12 meses — GMV e quantidade
                </p>
              </div>
              <Badge variant="outline" className="shrink-0 text-[10px] uppercase tracking-wider">
                Independente do filtro
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loading || !data ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ChartContainer
                config={{
                  count: { label: "Eventos", color: "hsl(24, 100%, 70%)" },
                  gmv: { label: "GMV", color: "hsl(24, 100%, 50%)" }
                }}
                className="h-[300px] w-full"
              >
                <ComposedChart data={data.events_by_month ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tickFormatter={monthLabel} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis yAxisId="left" orientation="left" tickFormatter={(v) => formatInt(v)} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar yAxisId="left" dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="gmv" stroke="var(--color-gmv)" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* HEATMAP */}
        <Card className="hover:border-primary/20 transition-colors">
          <CardHeader>
            <CardTitle>Heatmap de Pedidos</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Horário com mais vendas — quanto mais escuro, mais pedidos
            </p>
          </CardHeader>
          <CardContent>
            {loading || !data ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <div className="min-w-[700px]">
                    {/* Header: horas */}
                    <div className="grid gap-0.5" style={{ gridTemplateColumns: "40px repeat(24, minmax(0, 1fr))" }}>
                      <div />
                      {Array.from({ length: 24 }, (_, h) => (
                        <div key={h} className="text-[10px] text-muted-foreground text-center">
                          {h % 3 === 0 ? h : ""}
                        </div>
                      ))}
                    </div>
                    {/* Linhas */}
                    {dowLabels.map((dowName, dowIdx) => (
                      <div
                        key={dowIdx}
                        className="grid gap-0.5 mt-0.5"
                        style={{ gridTemplateColumns: "40px repeat(24, minmax(0, 1fr))" }}
                      >
                        <div className="text-xs text-muted-foreground flex items-center">{dowName}</div>
                        {Array.from({ length: 24 }, (_, h) => {
                          const count = heatmapMatrix.grid[dowIdx][h];
                          return (
                            <Tooltip key={h}>
                              <TooltipTrigger asChild>
                                <div
                                  className={`h-7 rounded-sm transition-all hover:ring-1 hover:ring-primary cursor-help ${
                                    count > 0 ? "ring-1 ring-primary/20" : ""
                                  }`}
                                  style={{ backgroundColor: getCellColor(count, heatmapMatrix.max) }}
                                />
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p className="text-xs">{dowName}, {h}h: {formatInt(count)} pedido(s)</p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Legenda */}
                <div className="flex items-center gap-2 mt-3 justify-end text-xs text-muted-foreground">
                  <span>Menos</span>
                  <div className="flex gap-1">
                    <div className="w-5 h-3 rounded-sm" style={{ backgroundColor: "hsl(var(--muted) / 0.3)" }} />
                    <div className="w-5 h-3 rounded-sm" style={{ backgroundColor: "hsl(24, 100%, 50% / 0.4)" }} />
                    <div className="w-5 h-3 rounded-sm" style={{ backgroundColor: "hsl(24, 100%, 50% / 0.6)" }} />
                    <div className="w-5 h-3 rounded-sm" style={{ backgroundColor: "hsl(24, 100%, 50% / 0.8)" }} />
                    <div className="w-5 h-3 rounded-sm" style={{ backgroundColor: "hsl(24, 100%, 55%)" }} />
                  </div>
                  <span>Mais</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* TOP 10 EVENTOS */}
        <Card className="hover:border-primary/20 transition-colors">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <CardTitle>Top 10 Eventos por GMV</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Eventos com maior volume transacionado no período
            </p>
          </CardHeader>
          <CardContent>
            {loading || !data ? (
              <Skeleton className="h-96 w-full" />
            ) : (data.top_events ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Sem eventos com vendas no período
              </p>
            ) : (
              <div className="space-y-2">
                {data.top_events.map((e: any, idx: number) => (
                  <div
                    key={e.event_id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/20 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground truncate">{e.event_name}</p>
                        <Badge variant="outline" className={`text-[10px] ${statusColors[e.status] ?? statusColors.draft}`}>
                          {statusLabels[e.status] ?? e.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {e.client_name} · {e.venue_name} · {formatDateBR(e.start_at)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-foreground">{formatBRL(e.gmv)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatInt(e.pedidos)} pedido(s) · {formatInt(e.consumers)} consumer(s)
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
