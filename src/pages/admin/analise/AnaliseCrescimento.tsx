import { useEffect, useState, createElement } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, XAxis, YAxis, CartesianGrid, ComposedChart, Line } from "recharts";
import { UserPlus, Users, Zap, Clock, TrendingUp, TrendingDown, Minus, Info, HelpCircle, Lock } from "lucide-react";

const formatInt = (n: number) => new Intl.NumberFormat("pt-BR").format(n ?? 0);
const formatPct = (n: number) => `${((n ?? 0) * 100).toFixed(1)}%`;
const monthLabel = (m: string) => {
  const [y, mo] = m.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(mo, 10) - 1]}/${y.slice(2)}`;
};

const formatGrowth = (n: number) => {
  const pct = (n ?? 0) * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
};
const getGrowthIcon = (n: number) => {
  if (n > 0.01) return TrendingUp;
  if (n < -0.01) return TrendingDown;
  return Minus;
};
const getGrowthColor = (n: number) => {
  if (n > 0.01) return "text-green-400";
  if (n < -0.01) return "text-red-400";
  return "text-muted-foreground";
};
const getActivationColor = (pct: number) => {
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

type KpiCardProps = {
  title: string;
  tooltip: string;
  value: string;
  Icon: any;
  valueClassName?: string;
  footer?: React.ReactNode;
};

function KpiCard({ title, tooltip, value, Icon, valueClassName, footer }: KpiCardProps) {
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
        <div className={`text-2xl font-bold ${valueClassName ?? "text-foreground"}`}>{value}</div>
        {footer && <div className="mt-1.5">{footer}</div>}
      </CardContent>
    </Card>
  );
}

const PLACEHOLDERS = [
  { title: "Churn Rate", desc: "Taxa mensal de clientes perdidos" },
  { title: "Churn Revenue", desc: "Receita mensal perdida por churn" },
  { title: "NNR (Net New Revenue)", desc: "Receita nova menos receita perdida" },
];

function PlaceholderCard({ title, desc }: { title: string; desc: string }) {
  return (
    <Card className="border-dashed border-border/60 bg-muted/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            <p className="text-xs text-muted-foreground/70 italic mt-1">{desc}</p>
          </div>
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Badge variant="outline" className="text-[10px] text-muted-foreground italic">
          Requer sistema de invoices (F4a)
        </Badge>
      </CardContent>
    </Card>
  );
}

export default function AnaliseCrescimento() {
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const { start, end } = computePeriod(period);
    const { data: rpcData, error: rpcError } = await supabase.rpc("get_growth_metrics" as any, {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const ready = data?.ready ?? {};
  const newClientsByMonth = data?.new_clients_by_month ?? [];
  const activationCohort = data?.activation_cohort ?? [];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Crescimento</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Aquisição, ativação e retenção de clientes
              </p>
            </div>
            <Badge variant="outline" className="gap-1.5 text-xs font-normal">
              <Info className="h-3 w-3" />
              Ativação = cliente com ao menos 1 pagamento aprovado
            </Badge>
          </div>
          <ToggleGroup
            type="single"
            value={period}
            onValueChange={(v) => v && setPeriod(v as Period)}
            className="border border-border rounded-md"
          >
            <ToggleGroupItem value="today" className="text-xs px-3">Hoje</ToggleGroupItem>
            <ToggleGroupItem value="7d" className="text-xs px-3">7d</ToggleGroupItem>
            <ToggleGroupItem value="30d" className="text-xs px-3">30d</ToggleGroupItem>
            <ToggleGroupItem value="month" className="text-xs px-3">Mês</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 flex items-center justify-between gap-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button size="sm" variant="outline" onClick={fetchData}>Tentar novamente</Button>
          </div>
        )}

        {/* BLOCO 1 — Pronto */}
        <div className="space-y-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Aquisição e Ativação
            </h2>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/40 text-primary">
              dados reais
            </Badge>
          </div>
          {loading ? (
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
              <KpiCard
                title="Novos Clientes"
                value={formatInt(ready.new_clients_period)}
                Icon={UserPlus}
                tooltip="Clientes criados no período selecionado. Crescimento compara com período anterior de mesma duração."
                footer={
                  <div className={`flex items-center gap-1 text-xs ${getGrowthColor(ready.new_clients_growth)}`}>
                    {createElement(getGrowthIcon(ready.new_clients_growth), { className: "h-3 w-3" })}
                    {formatGrowth(ready.new_clients_growth)} vs período anterior
                  </div>
                }
              />
              <KpiCard
                title="Base Total"
                value={formatInt(ready.total_clients)}
                Icon={Users}
                tooltip="Total de clientes ativos na plataforma (status='active'). Independe do filtro."
                footer={<Badge variant="outline" className="text-[9px] px-1.5 py-0">fixo</Badge>}
              />
              <KpiCard
                title="Ativação Geral"
                value={formatPct(ready.ativacao_rate_geral)}
                Icon={Zap}
                tooltip="Percentual de clientes ativos na plataforma que já fizeram ao menos 1 pagamento. Mede eficácia geral do onboarding. Independe do filtro."
                footer={
                  <p className="text-xs text-muted-foreground">
                    {formatInt(ready.clients_ativados_total)} de {formatInt(ready.total_clients)} ativos
                  </p>
                }
              />
              <KpiCard
                title="Ativação (período)"
                value={formatPct(ready.ativacao_rate_periodo)}
                Icon={Zap}
                tooltip="Dos clientes criados dentro do período selecionado, quantos já fizeram ao menos 1 pagamento. Muda com o filtro."
                footer={
                  <p className="text-xs text-muted-foreground">Clientes criados no período que já ativaram</p>
                }
              />
              <KpiCard
                title="Tempo até Ativar"
                value={`${formatInt(Math.round(ready.avg_time_to_activate_days ?? 0))} dias`}
                Icon={Clock}
                tooltip="Tempo médio entre o cadastro do cliente e seu primeiro pagamento aprovado. Quanto menor, mais eficiente o onboarding."
                footer={<Badge variant="outline" className="text-[9px] px-1.5 py-0">média histórica</Badge>}
              />
            </div>
          )}
        </div>

        {/* BLOCO 2 — Aguardando F4a */}
        <div className="space-y-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Retenção e Churn
            </h2>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0">
              aguardando Fase 4a
            </Badge>
          </div>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            {PLACEHOLDERS.map((item) => (
              <PlaceholderCard key={item.title} title={item.title} desc={item.desc} />
            ))}
          </div>
        </div>

        {/* CARD Novos Clientes e Ativação por Mês */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>Novos Clientes e Ativação por Mês</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Últimos 12 meses — aquisição e ativação total (acumulada até fim do mês)
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">Independente do filtro</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[280px] w-full rounded-md" />
            ) : (
              <ChartContainer
                config={{
                  new_clients: { label: "Novos", color: "hsl(24, 100%, 50%)" },
                  activated_same_month: { label: "Já ativados", color: "hsl(200, 90%, 55%)" },
                }}
                className="h-[280px] w-full"
              >
                <ComposedChart data={newClientsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tickFormatter={monthLabel} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis tickFormatter={(v) => formatInt(v)} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="new_clients" fill="var(--color-new_clients)" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="activated_same_month" stroke="var(--color-activated_same_month)" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* CARD Cohort de Ativação */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>Cohort de Ativação</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  % de clientes criados que já ativaram em D7 / D30 / D90
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">Últimas 6 cohorts</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full rounded-md" />
            ) : activationCohort.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados de cohort</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Mês do Cadastro</th>
                      <th className="py-2 pr-4 font-medium">Tamanho</th>
                      <th className="py-2 pr-4 font-medium">Ativ. D7</th>
                      <th className="py-2 pr-4 font-medium">Ativ. D30</th>
                      <th className="py-2 font-medium">Ativ. D90</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activationCohort.map((c: any) => (
                      <tr key={c.cohort_month} className="border-b border-border/40 hover:bg-muted/20">
                        <td className="py-2.5 pr-4 font-medium text-foreground">{monthLabel(c.cohort_month)}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground">{formatInt(c.cohort_size)}</td>
                        <td className={`py-2.5 pr-4 ${getActivationColor(c.pct_d7)}`}>
                          {formatPct(c.pct_d7)} <span className="text-xs text-muted-foreground">({c.activated_d7})</span>
                        </td>
                        <td className={`py-2.5 pr-4 ${getActivationColor(c.pct_d30)}`}>
                          {formatPct(c.pct_d30)} <span className="text-xs text-muted-foreground">({c.activated_d30})</span>
                        </td>
                        <td className={`py-2.5 ${getActivationColor(c.pct_d90)}`}>
                          {formatPct(c.pct_d90)} <span className="text-xs text-muted-foreground">({c.activated_d90})</span>
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
    </TooltipProvider>
  );
}
