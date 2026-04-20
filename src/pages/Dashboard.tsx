import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TrendingUp, DollarSign, Wallet, Building2, CalendarCheck, AlertCircle, type LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n ?? 0);
const formatInt = (n: number) =>
  new Intl.NumberFormat("pt-BR").format(n ?? 0);

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

export default function Dashboard() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { profile } = useAuth();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { start, end } = computePeriod(period);
    const { data: result, error: rpcError } = await supabase.rpc(
      "get_admin_dashboard_metrics" as any,
      {
        p_start_date: start.toISOString(),
        p_end_date: end.toISOString(),
      } as any
    );
    if (rpcError) {
      setError(rpcError.message || "Falha ao carregar métricas do painel.");
      setLoading(false);
      return;
    }
    setData(result);
    setLoading(false);
  }, [period]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const kpis = data?.kpis ?? {};

  const cards: Array<{ title: string; value: string; icon: LucideIcon }> = [
    { title: "MRR Esperado", value: formatBRL(kpis.mrr_expected), icon: TrendingUp },
    { title: "GMV do Período", value: formatBRL(kpis.gmv_total_period), icon: DollarSign },
    { title: "Receita (Fees)", value: formatBRL(kpis.fees_total_period), icon: Wallet },
    { title: "Novos Clientes", value: formatInt(kpis.new_clients_period), icon: Building2 },
    { title: "Eventos Ativos", value: formatInt(kpis.active_events_now), icon: CalendarCheck },
    { title: "Alertas Abertos", value: formatInt(kpis.alerts_open), icon: AlertCircle },
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
    </div>
  );
}
