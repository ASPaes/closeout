import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  DollarSign,
  Wallet,
  Building2,
  CalendarCheck,
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  Info,
  CheckCircle2,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n ?? 0);
const formatInt = (n: number) =>
  new Intl.NumberFormat("pt-BR").format(n ?? 0);

type Period = "today" | "7d" | "30d" | "month";

type AlertSeverity = "critical" | "warning" | "info";
type LocalAlert = { severity: AlertSeverity; title: string; detail?: string };

function buildLocalAlerts(data: any, health: any): LocalAlert[] {
  const alerts: LocalAlert[] = [];

  if ((data?.frozen_orders_count ?? 0) > 0) {
    alerts.push({
      severity: "critical",
      title: `${data.frozen_orders_count} pedido(s) travado(s)`,
      detail: "Status partially_paid há mais de 30 minutos",
    });
  }

  if ((health?.payments?.pix_expiring_soon ?? 0) > 0) {
    alerts.push({
      severity: "warning",
      title: `${health.payments.pix_expiring_soon} PIX expirando`,
      detail: "Próximos 5 minutos",
    });
  }

  if (health?.events?.active_count === 0 && health?.events?.upcoming_count === 0) {
    alerts.push({
      severity: "info",
      title: "Nenhum evento ativo",
      detail: "Sem eventos em andamento ou nas próximas 24h",
    });
  }

  return alerts;
}

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

export default function Dashboard() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { profile } = useAuth();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { start, end } = computePeriod(period);
    const [metricsRes, healthRes] = await Promise.all([
      supabase.rpc("get_admin_dashboard_metrics" as any, {
        p_start_date: start.toISOString(),
        p_end_date: end.toISOString(),
      } as any),
      supabase.rpc("get_platform_health_summary" as any),
    ]);
    if (metricsRes.error) {
      setError(metricsRes.error.message || "Falha ao carregar métricas do painel.");
    } else {
      setData(metricsRes.data);
    }
    if (!healthRes.error) {
      setHealth(healthRes.data);
    }
    setLoading(false);
  }, [period]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const kpis = data?.kpis ?? {};

  const alerts = useMemo(() => buildLocalAlerts(data, health), [data, health]);

  const cards: Array<{ title: string; value: string; icon: LucideIcon; tooltip: string }> = [
    {
      title: "MRR Esperado",
      value: formatBRL(kpis.mrr_expected),
      icon: TrendingUp,
      tooltip:
        "Monthly Recurring Revenue. Soma das mensalidades fixas ativas dos clientes da plataforma. Receita recorrente que entra todo mês, independente de pedidos.",
    },
    {
      title: "GMV do Período",
      value: formatBRL(kpis.gmv_total_period),
      icon: DollarSign,
      tooltip:
        "Gross Merchandise Value. Volume total transacionado pelos consumidores no período — soma dos pagamentos aprovados, incluindo o que vai pro cliente e o que vira fee da plataforma.",
    },
    {
      title: "Receita (Fees)",
      value: formatBRL(kpis.fees_total_period),
      icon: Wallet,
      tooltip:
        "Valor total que ficou com a plataforma no período. Calculado a partir das taxas configuradas em cada cliente aplicadas sobre os pagamentos aprovados.",
    },
    {
      title: "Novos Clientes",
      value: formatInt(kpis.new_clients_period),
      icon: Building2,
      tooltip:
        "Quantidade de clientes (bares, eventos) que foram cadastrados pela primeira vez na plataforma dentro do período selecionado.",
    },
    {
      title: "Eventos Ativos",
      value: formatInt(kpis.active_events_now),
      icon: CalendarCheck,
      tooltip:
        "Eventos em andamento neste exato momento — com status 'active' e horário atual entre start_at e end_at. Não depende do período selecionado.",
    },
    {
      title: "Alertas Abertos",
      value: formatInt(kpis.alerts_open),
      icon: AlertCircle,
      tooltip:
        "Alertas operacionais que precisam de atenção (pedidos travados, PIX expirando, falhas). Sistema completo de alertas chega na Fase 5.",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel Executivo</h1>
          <p className="text-sm text-muted-foreground mt-1">Visão geral da plataforma</p>
        </div>
        <ToggleGroup
          type="single"
          value={period}
          onValueChange={(v) => v && setPeriod(v as Period)}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="today">Hoje</ToggleGroupItem>
          <ToggleGroupItem value="7d">7 dias</ToggleGroupItem>
          <ToggleGroupItem value="30d">30 dias</ToggleGroupItem>
          <ToggleGroupItem value="month">Mês atual</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive-foreground p-4 rounded-md flex items-center justify-between gap-4">
          <span className="text-sm">{error}</span>
          <Button size="sm" variant="outline" onClick={fetchMetrics}>
            Tentar novamente
          </Button>
        </div>
      )}

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))
          : cards.map((card) => (
              <Card
                key={card.title}
                className="border-border bg-card hover:border-primary/20 transition-colors"
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {card.title}
                  </CardTitle>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <card.icon className="h-5 w-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-foreground tracking-tight">
                    {card.value}
                  </p>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Seção A — Gráfico de Receita */}
      {loading ? (
        <Skeleton className="h-[280px] rounded-lg" />
      ) : (
        <Card className="border-border bg-card hover:border-primary/20 transition-colors">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold text-foreground">
                Tendência de Receita
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                GMV e taxas capturadas por dia — sempre últimos 30 dias
              </p>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] uppercase tracking-wider shrink-0"
            >
              Independente do filtro
            </Badge>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                gmv: { label: "GMV", color: "hsl(24, 100%, 50%)" },
                fees: { label: "Fees", color: "hsl(24, 100%, 70%)" },
              }}
              className="h-[260px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.revenue_timeseries ?? []}>
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
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="gmv"
                    stroke="hsl(24, 100%, 50%)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="fees"
                    stroke="hsl(24, 100%, 70%)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Seção B — Top Clients + Saúde da Plataforma */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {loading ? (
          <>
            <Skeleton className="h-48 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
          </>
        ) : (
          <>
            <Card className="border-border bg-card hover:border-primary/20 transition-colors">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-foreground">
                  Top Clientes (período)
                </CardTitle>
                <p className="text-sm text-muted-foreground">Por volume transacionado</p>
              </CardHeader>
              <CardContent>
                {!data?.top_clients || data.top_clients.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Sem dados no período
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {data.top_clients.map((c: any, idx: number) => (
                      <li
                        key={c.client_id}
                        className="flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-sm font-semibold text-primary">
                              {idx + 1}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">
                              {c.client_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {c.payment_count} pagamento(s)
                            </p>
                          </div>
                        </div>
                        <p className="text-sm font-semibold text-foreground shrink-0">
                          {formatBRL(c.gmv)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="border-border bg-card hover:border-primary/20 transition-colors">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-foreground">
                  Saúde da Plataforma
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {[
                    { key: "platform", label: "Plataforma" },
                    { key: "payments", label: "Pagamentos" },
                    { key: "security", label: "Segurança" },
                    { key: "events", label: "Eventos" },
                  ].map(({ key, label }) => {
                    const item = health?.[key];
                    if (!item) return null;
                    const statusColors: Record<string, string> = {
                      green: "bg-green-500",
                      yellow: "bg-yellow-500",
                      red: "bg-red-500",
                      gray: "bg-muted-foreground",
                    };
                    return (
                      <li key={key} className="flex items-center gap-3">
                        <span
                          className={`h-3 w-3 rounded-full shrink-0 ${
                            statusColors[item.status] || "bg-muted-foreground"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{label}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {item.detail}
                          </p>
                        </div>
                        {item.is_stub && (
                          <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                            stub
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Seção C — Alertas (preview local, será substituído na F5) */}
      {!loading && (
        <Card className="border-border bg-card hover:border-primary/20 transition-colors">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold text-foreground">
                Alertas
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {alerts.length === 0
                  ? "Nenhum alerta ativo"
                  : `${alerts.length} alerta(s) ativo(s)`}
              </p>
            </div>
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider shrink-0">
              preview — sistema completo na fase 5
            </span>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <div className="flex items-center gap-3 text-muted-foreground">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="text-sm">Tudo sob controle.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert, idx) => {
                  const severityConfig = {
                    critical: { icon: AlertOctagon, color: "text-red-500", bg: "bg-red-500/10" },
                    warning: { icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-500/10" },
                    info: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10" },
                  };
                  const cfg = severityConfig[alert.severity];
                  const AlertIcon = cfg.icon;
                  return (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 p-3 rounded-md ${cfg.bg}`}
                    >
                      <AlertIcon className={`h-5 w-5 shrink-0 ${cfg.color}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {alert.title}
                        </p>
                        {alert.detail && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {alert.detail}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
