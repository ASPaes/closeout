import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AdminPeriodFilter } from "@/components/AdminPeriodFilter";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Building2, UserCheck, UserX, AlertTriangle, Coins, Trophy, HelpCircle } from "lucide-react";

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n ?? 0);
const formatInt = (n: number) => new Intl.NumberFormat("pt-BR").format(n ?? 0);
const formatPct = (n: number) => `${((n ?? 0) * 100).toFixed(1)}%`;
const formatDateBR = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
};
const monthLabel = (m: string) => {
  const [y, mo] = m.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(mo, 10) - 1]}/${y.slice(2)}`;
};

type KpiCardProps = {
  title: string;
  tooltip: string;
  value: string;
  Icon: any;
  badge?: React.ReactNode;
};

function KpiCard({ title, tooltip, value, Icon, badge }: KpiCardProps) {
  return (
    <Card className="hover:border-primary/20 transition-colors group">
      <CardContent className="pt-5 pb-4 px-4">
        <div className="flex items-start justify-between mb-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
            <Icon className="h-[18px] w-[18px] text-primary" />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/40 hover:text-muted-foreground cursor-help transition-colors" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="text-sm">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="space-y-0.5">
          {badge ? (
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-bold text-foreground tracking-tight">{value}</span>
              {badge}
            </div>
          ) : (
            <span className="text-2xl font-bold text-foreground tracking-tight">{value}</span>
          )}
          <p className="text-xs text-muted-foreground/70">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AnaliseClientes() {
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return { start, end };
  });
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const { start, end } = dateRange;
    const { data: rpcData, error: rpcError } = await supabase.rpc("get_client_value_metrics" as any, {
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
  }, [dateRange]);

  const kpis = data?.kpis ?? {};

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Análise de valor e performance dos clientes da plataforma
            </p>
          </div>
          <AdminPeriodFilter onRangeChange={(start, end) => setDateRange({ start, end })} />
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4 flex items-center justify-between">
            <p className="text-sm text-destructive">Erro ao carregar dados: {error}</p>
            <Button variant="outline" size="sm" onClick={fetchData}>Tentar novamente</Button>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {loading || !data ? (
            Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          ) : (
            <>
              <KpiCard
                title="Total Ativos"
                value={formatInt(kpis.total_clients ?? 0)}
                Icon={Building2}
                tooltip="Clientes (bares/estabelecimentos) com status 'active' na plataforma. Independe do período."
              />
              <KpiCard
                title="Com Vendas"
                value={formatInt(kpis.clients_ativos ?? 0)}
                Icon={UserCheck}
                tooltip="Clientes que receberam ao menos 1 pagamento aprovado no período selecionado. Mede atividade operacional real."
              />
              <KpiCard
                title="Sem Vendas"
                value={formatInt(kpis.clients_inativos ?? 0)}
                Icon={UserX}
                tooltip="Clientes ativos no sistema mas sem nenhum pagamento nos últimos 30 dias."
              />
              <KpiCard
                title="Em Risco"
                value={formatInt(kpis.clients_em_risco ?? 0)}
                Icon={AlertTriangle}
                tooltip="Clientes que tinham atividade no período anterior equivalente mas sem vendas no período selecionado. Sinal precoce de churn."
              />
              <KpiCard
                title="LTV Médio"
                value={formatBRL(kpis.ltv_medio ?? 0)}
                Icon={Coins}
                tooltip="Lifetime Value médio — soma histórica de fees capturadas por cliente. ATUAL: apenas fees de pagamentos. Não inclui mensalidades (chega na Fase 4a)."
                badge={
                  kpis.ltv_is_partial ? (
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-yellow-500/40 text-yellow-400">
                      parcial
                    </Badge>
                  ) : undefined
                }
              />
            </>
          )}
        </div>

        {/* Novos Clientes por Mês */}
        <Card className="hover:border-primary/20 transition-colors">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">Novos Clientes por Mês</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Últimos 12 meses — expansão da base</p>
              </div>
              <Badge variant="outline" className="text-[10px]">Independente do filtro</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loading || !data ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (
              <ChartContainer
                config={{ count: { label: "Novos", color: "hsl(24, 100%, 50%)" } }}
                className="h-[260px] w-full"
              >
                <BarChart data={data.new_clients_by_month ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={monthLabel} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => formatInt(v)} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Top LTV + Em Risco */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top LTV */}
          <Card className="hover:border-primary/20 transition-colors">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-primary" />
                    Top 10 por LTV
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Por fees capturadas (histórico total)</p>
                </div>
                <Badge variant="outline" className="text-[10px] border-yellow-500/40 text-yellow-400">
                  parcial até F4a
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {loading || !data ? (
                <Skeleton className="h-[400px] w-full" />
              ) : (data.top_ltv ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {data.top_ltv.map((c: any, idx: number) => (
                    <div
                      key={c.client_id}
                      className="flex items-center gap-3 p-2.5 rounded-md hover:bg-muted/30 transition-colors"
                    >
                      <div className="h-7 w-7 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{c.client_name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {formatInt(c.payments_count)} pgto(s) · GMV {formatBRL(c.gmv_total)} · Cliente desde {formatDateBR(c.client_created_at)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-foreground shrink-0">{formatBRL(c.ltv)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Em Risco */}
          <Card className="hover:border-primary/20 transition-colors">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-400" />
                Clientes em Risco
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Tiveram vendas 30-60d atrás, zero nos últimos 30d</p>
            </CardHeader>
            <CardContent>
              {loading || !data ? (
                <Skeleton className="h-[400px] w-full" />
              ) : (data.clients_at_risk ?? []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <UserCheck className="h-10 w-10 text-green-500 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum cliente em risco no momento</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {data.clients_at_risk.map((c: any) => (
                    <div
                      key={c.client_id}
                      className="flex items-center gap-3 p-2.5 rounded-md bg-yellow-500/5 border border-yellow-500/15 hover:bg-yellow-500/10 transition-colors"
                    >
                      <div className="h-7 w-7 shrink-0 rounded-full bg-yellow-500/15 flex items-center justify-center">
                        <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{c.client_name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          Último pgto há {formatInt(c.days_since_last)} dia(s) · {formatInt(c.total_payments_ever)} pgto(s) histórico
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-foreground shrink-0">{formatBRL(c.ltv)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Receita por Cliente */}
        <Card className="hover:border-primary/20 transition-colors">
          <CardHeader>
            <CardTitle className="text-base">Receita por Cliente</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Todos os clientes com vendas no período selecionado</p>
          </CardHeader>
          <CardContent>
            {loading || !data ? (
              <Skeleton className="h-64 w-full" />
            ) : (data.revenue_by_client ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum cliente com vendas no período</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Cliente</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">GMV</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Fees</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Pgtos</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Eventos</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Consumers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.revenue_by_client.map((c: any) => (
                      <tr key={c.client_id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-foreground font-medium">{c.client_name}</span>
                            {c.status !== "active" && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5">{c.status}</Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right text-foreground">{formatBRL(c.gmv)}</td>
                        <td className="py-2 px-3 text-right text-primary font-medium">{formatBRL(c.fees)}</td>
                        <td className="py-2 px-3 text-right text-muted-foreground">{formatInt(c.payments_count)}</td>
                        <td className="py-2 px-3 text-right text-muted-foreground">{formatInt(c.events_count)}</td>
                        <td className="py-2 px-3 text-right text-muted-foreground">{formatInt(c.consumers_unicos)}</td>
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
