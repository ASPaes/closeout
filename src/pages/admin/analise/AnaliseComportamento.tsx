import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Line, Bar, XAxis, YAxis, CartesianGrid, ComposedChart } from "recharts";
import { Users, Activity, Repeat, HelpCircle, Info, UserCheck } from "lucide-react";

const formatInt = (n: number) => new Intl.NumberFormat("pt-BR").format(n ?? 0);
const formatPct = (n: number) => `${((n ?? 0) * 100).toFixed(1)}%`;

const monthLabel = (m: string) => {
  const [y, mo] = m.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(mo, 10) - 1]}/${y.slice(2)}`;
};

const getCohortColor = (pct: number) => {
  if (pct >= 0.5) return "text-green-400 font-medium";
  if (pct >= 0.25) return "text-yellow-400";
  if (pct >= 0.1) return "text-orange-400";
  return "text-muted-foreground";
};

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
  } else {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }
  return { start, end };
}

type KpiTooltipProps = { title: string; tooltip: string; value: string; Icon: any };
function KpiCard({ title, tooltip, value, Icon }: KpiTooltipProps) {
  return (
    <Card className="hover:border-primary/20 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-sm">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function AnaliseComportamento() {
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const { start, end } = computePeriod(period);
    const { data: rpcData, error: rpcError } = await supabase.rpc("get_behavior_metrics" as any, {
      p_start_date: start.toISOString(),
      p_end_date: end.toISOString(),
    } as any);
    if (rpcError) {
      setError(rpcError.message);
      setLoading(false);
      return;
    }
    setData(rpcData);
    setError(null);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [period]);

  const kpis = data?.kpis ?? {};

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="space-y-2">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Comportamento</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Engajamento e retenção de consumidores na plataforma
              </p>
            </div>
            <Badge variant="outline" className="gap-1.5 font-normal">
              <Info className="h-3 w-3" />
              <span className="text-xs">Ativo = consumidor que criou pelo menos 1 pedido no período</span>
            </Badge>
          </div>
          <ToggleGroup
            type="single"
            value={period}
            onValueChange={(v) => v && setPeriod(v as Period)}
            className="justify-start"
          >
            <ToggleGroupItem value="today">Hoje</ToggleGroupItem>
            <ToggleGroupItem value="7d">7 dias</ToggleGroupItem>
            <ToggleGroupItem value="30d">30 dias</ToggleGroupItem>
            <ToggleGroupItem value="month">Mês atual</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4 flex items-center justify-between">
            <p className="text-sm text-destructive">Erro ao carregar dados: {error}</p>
            <Button variant="outline" size="sm" onClick={fetchData}>Tentar novamente</Button>
          </div>
        )}

        {/* KPIs — Engajamento Geral (fixo 30d) */}
        <div className="space-y-3">
          <div className="flex items-baseline gap-2">
            {loading || !data ? (
              <Skeleton className="h-4 w-40" />
            ) : (
              <>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Engajamento Geral
                </h2>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                  últimos 30 dias
                </Badge>
              </>
            )}
          </div>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {loading || !data ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
            ) : (
              <>
                <KpiCard
                  title="DAU Médio"
                  value={formatInt(Math.round(kpis.dau_avg ?? 0))}
                  Icon={Users}
                  tooltip="Daily Active Users. Média diária de consumidores únicos que criaram ao menos 1 pedido nos últimos 30 dias. SEMPRE 30 dias — não muda com o filtro de período."
                />
                <KpiCard
                  title="WAU Médio"
                  value={formatInt(Math.round(kpis.wau_avg ?? 0))}
                  Icon={Users}
                  tooltip="Weekly Active Users. Média semanal de consumidores únicos nas últimas 4 semanas rolantes. Métrica fixa, não muda com o filtro."
                />
                <KpiCard
                  title="MAU"
                  value={formatInt(kpis.mau ?? 0)}
                  Icon={Users}
                  tooltip="Monthly Active Users. Consumidores únicos que criaram ao menos 1 pedido nos últimos 30 dias. Fixo em 30 dias por definição (é o que o 'M' significa)."
                />
                <KpiCard
                  title="Stickiness"
                  value={formatPct(kpis.stickiness ?? 0)}
                  Icon={Activity}
                  tooltip="DAU ÷ MAU. Mede engajamento: quanto maior, mais gente volta todo dia. Benchmarks: >20% é bom, >50% é excepcional. Métrica fixa em 30 dias."
                />
              </>
            )}
          </div>
        </div>

        {/* KPIs — Do Período Selecionado (dinâmico) */}
        <div className="space-y-3">
          <div className="flex items-baseline gap-2">
            {loading || !data ? (
              <Skeleton className="h-4 w-40" />
            ) : (
              <>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Do Período Selecionado
                </h2>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/40 text-primary">
                  reage ao filtro
                </Badge>
              </>
            )}
          </div>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-2">
            {loading || !data ? (
              Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-28" />)
            ) : (
              <>
                <KpiCard
                  title="Consumers no Período"
                  value={formatInt(kpis.total_consumers_period ?? 0)}
                  Icon={UserCheck}
                  tooltip="Consumidores únicos que criaram ao menos 1 pedido dentro do período selecionado no filtro. Muda quando você troca o período."
                />
                <KpiCard
                  title="Pedidos/Consumer"
                  value={(kpis.orders_per_consumer ?? 0).toFixed(1)}
                  Icon={Repeat}
                  tooltip="Média de pedidos criados por consumidor único no período selecionado. Métrica de frequência de compra. Muda com o filtro."
                />
              </>
            )}
          </div>
        </div>

        {/* Atividade Diária */}
        <Card className="hover:border-primary/20 transition-colors">
          <CardHeader>
            <CardTitle className="text-base">Atividade Diária</CardTitle>
            <p className="text-xs text-muted-foreground">Consumidores ativos e novos por dia no período</p>
          </CardHeader>
          <CardContent>
            {loading || !data ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ChartContainer
                config={{
                  active_consumers: { label: "Ativos", color: "hsl(24, 100%, 50%)" },
                  new_consumers: { label: "Novos", color: "hsl(200, 90%, 55%)" },
                  orders_count: { label: "Pedidos", color: "hsl(24, 100%, 70%)" },
                }}
                className="h-[300px] w-full"
              >
                <ComposedChart data={data.daily_actives ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={(v) => {
                      const d = new Date(v);
                      return `${d.getDate()}/${d.getMonth() + 1}`;
                    }}
                  />
                  <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => formatInt(v)} />
                  <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => formatInt(v)} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar yAxisId="right" dataKey="orders_count" fill="var(--color-orders_count)" fillOpacity={0.5} radius={[3, 3, 0, 0]} />
                  <Line yAxisId="left" type="monotone" dataKey="active_consumers" stroke="var(--color-active_consumers)" strokeWidth={2} dot={false} />
                  <Line yAxisId="left" type="monotone" dataKey="new_consumers" stroke="var(--color-new_consumers)" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Frequência + Cohort */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Frequência */}
          <Card className="hover:border-primary/20 transition-colors">
            <CardHeader>
              <CardTitle className="text-base">Frequência de Compra</CardTitle>
              <p className="text-xs text-muted-foreground">Distribuição de consumidores por quantidade de pedidos no período</p>
            </CardHeader>
            <CardContent>
              {loading || !data ? (
                <Skeleton className="h-64 w-full" />
              ) : (data.frequency_buckets ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados no período</p>
              ) : (
                <div className="space-y-4">
                  {data.frequency_buckets.map((b: any) => (
                    <div key={b.bucket} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground font-medium">{b.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatInt(b.consumers_count)} consumidor(es) · {formatPct(b.pct)}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${(b.pct ?? 0) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cohort */}
          <Card className="hover:border-primary/20 transition-colors">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Retenção por Cohort</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Últimas 6 cohorts mensais</p>
                </div>
                <Badge variant="outline" className="text-[10px]">Primeiros pedidos</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {loading || !data ? (
                <Skeleton className="h-64 w-full" />
              ) : (data.cohort_retention ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados suficientes pra cohort</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[400px]">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Cohort</th>
                        <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">Tamanho</th>
                        <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">D7</th>
                        <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">D30</th>
                        <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">D90</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.cohort_retention.map((c: any) => (
                        <tr key={c.cohort_month} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="py-2 px-2 text-foreground font-medium">{monthLabel(c.cohort_month)}</td>
                          <td className="py-2 px-2 text-right text-muted-foreground">{formatInt(c.cohort_size)}</td>
                          <td className={`py-2 px-2 text-right ${getCohortColor(c.pct_d7 ?? 0)}`}>
                            {formatPct(c.pct_d7 ?? 0)}
                            <span className="text-[10px] text-muted-foreground/70 ml-1">({c.retained_d7 ?? 0})</span>
                          </td>
                          <td className={`py-2 px-2 text-right ${getCohortColor(c.pct_d30 ?? 0)}`}>
                            {formatPct(c.pct_d30 ?? 0)}
                            <span className="text-[10px] text-muted-foreground/70 ml-1">({c.retained_d30 ?? 0})</span>
                          </td>
                          <td className={`py-2 px-2 text-right ${getCohortColor(c.pct_d90 ?? 0)}`}>
                            {formatPct(c.pct_d90 ?? 0)}
                            <span className="text-[10px] text-muted-foreground/70 ml-1">({c.retained_d90 ?? 0})</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}
