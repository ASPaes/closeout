import { useEffect, useState, createElement } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, Line, XAxis, YAxis, CartesianGrid, ComposedChart } from "recharts";
import { Coins, TrendingUp, TrendingDown, Calendar, Sparkles, HelpCircle, Lock, Minus } from "lucide-react";

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n ?? 0);
const formatInt = (n: number) => new Intl.NumberFormat("pt-BR").format(n ?? 0);
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
  { title: "MRR Realizado", desc: "Soma de invoices mensais pagas no mês" },
  { title: "Receita Total", desc: "Fees + mensalidades + ativações" },
  { title: "Nova vs Recorrente", desc: "Breakdown entre receita nova e existente" },
  { title: "ARPU Real", desc: "Receita média por cliente considerando tudo" },
  { title: "Receita por Modelo", desc: "Breakdown por tipo de contrato do cliente" },
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
          Disponível na Fase 4a
        </Badge>
      </CardContent>
    </Card>
  );
}

export default function AnaliseReceita() {
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const { start, end } = computePeriod(period);
    const { data: rpcData, error: rpcError } = await supabase.rpc("get_revenue_metrics" as any, {
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
  const feesByMonth = data?.fees_by_month ?? [];
  const feesByClient = data?.fees_by_client ?? [];
  const maxFees = feesByClient.length > 0 ? Math.max(...feesByClient.map((c: any) => c.fees)) : 0;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Receita</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Receita capturada pela plataforma — fees, MRR, ARR
            </p>
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
              Receita Atual
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
                title="Fees no Período"
                value={formatBRL(ready.fees_period)}
                Icon={Coins}
                tooltip="Soma das taxas capturadas pela plataforma no período. Crescimento comparando com o período anterior de mesma duração."
                footer={
                  <div className={`flex items-center gap-1 text-xs ${getGrowthColor(ready.fees_mom_growth)}`}>
                    {createElement(getGrowthIcon(ready.fees_mom_growth), { className: "h-3 w-3" })}
                    {formatGrowth(ready.fees_mom_growth)} vs período anterior
                  </div>
                }
              />
              <KpiCard
                title="Fees Anterior"
                value={formatBRL(ready.fees_prev_period)}
                Icon={Calendar}
                tooltip="Fees capturadas no período anterior de mesma duração. Usado pra calcular o crescimento MoM."
              />
              <KpiCard
                title="MRR Esperado"
                value={formatBRL(ready.mrr_expected)}
                Icon={Sparkles}
                tooltip="Monthly Recurring Revenue. Soma das mensalidades ativas configuradas em billing_rules. É a receita recorrente esperada todo mês. Independe do filtro."
                footer={
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0">fixo</Badge>
                }
              />
              <KpiCard
                title="ARR Estimado"
                value={formatBRL(ready.arr_estimated)}
                Icon={TrendingUp}
                tooltip="Annual Recurring Revenue estimado. MRR × 12. Projeção anual baseada nas mensalidades ativas atuais."
              />
              <KpiCard
                title="Crescimento MoM"
                value={formatGrowth(ready.fees_mom_growth)}
                Icon={getGrowthIcon(ready.fees_mom_growth)}
                valueClassName={getGrowthColor(ready.fees_mom_growth)}
                tooltip="Crescimento de fees comparando o período atual com o anterior de mesma duração. Positivo = ganhou receita, negativo = perdeu."
              />
            </div>
          )}
        </div>

        {/* BLOCO 2 — Aguardando F4a */}
        <div className="space-y-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Indicadores Completos
            </h2>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0">
              aguardando Fase 4a
            </Badge>
          </div>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
            {PLACEHOLDERS.map((item) => (
              <PlaceholderCard key={item.title} title={item.title} desc={item.desc} />
            ))}
          </div>
        </div>

        {/* CARD Fees por Mês */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>Fees por Mês</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Últimos 12 meses — receita real capturada
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
                  fees: { label: "Fees", color: "hsl(24, 100%, 50%)" },
                  gmv: { label: "GMV", color: "hsl(24, 100%, 70%)" },
                }}
                className="h-[280px] w-full"
              >
                <ComposedChart data={feesByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tickFormatter={monthLabel} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis yAxisId="left" tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar yAxisId="left" dataKey="fees" fill="var(--color-fees)" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="gmv" stroke="var(--color-gmv)" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* CARD Fees por Cliente */}
        <Card>
          <CardHeader>
            <CardTitle>Fees por Cliente</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Distribuição das fees do período selecionado
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full rounded-md" />
            ) : feesByClient.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem fees no período</p>
            ) : (
              <div className="space-y-3">
                {feesByClient.map((c: any) => {
                  const pct = maxFees > 0 ? c.fees / maxFees : 0;
                  return (
                    <div key={c.client_id} className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-3 flex-wrap">
                        <span className="text-sm font-medium text-foreground truncate">{c.client_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatBRL(c.fees)} · GMV {formatBRL(c.gmv)} · {formatInt(c.payments_count)} pgto(s)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${Math.max(pct * 100, 2)}%` }}
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
