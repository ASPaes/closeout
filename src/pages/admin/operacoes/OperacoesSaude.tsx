import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Activity,
  RefreshCw,
  Clock,
  Database,
  Zap,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  CircleDot,
} from "lucide-react";

const formatInt = (n: number) => new Intl.NumberFormat("pt-BR").format(n ?? 0);
const formatPct = (n: number | null) =>
  n === null || n === undefined ? "-" : `${(n * 100).toFixed(1)}%`;
const formatRelativeTime = (iso: string | null | undefined): string => {
  if (!iso) return "-";
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min atrás`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h atrás`;
  return `${Math.floor(diffH / 24)}d atrás`;
};

type SemaphoreStatus = "ok" | "warn" | "error" | "unknown";

const semaphoreConfig: Record<
  SemaphoreStatus,
  { bg: string; text: string; icon: typeof CheckCircle2; label: string }
> = {
  ok: { bg: "bg-green-500/15 border-green-500/30", text: "text-green-400", icon: CheckCircle2, label: "OK" },
  warn: { bg: "bg-yellow-500/15 border-yellow-500/30", text: "text-yellow-400", icon: AlertTriangle, label: "Atenção" },
  error: { bg: "bg-red-500/15 border-red-500/30", text: "text-red-400", icon: XCircle, label: "Problema" },
  unknown: { bg: "bg-muted/30 border-border", text: "text-muted-foreground", icon: CircleDot, label: "Desconhecido" },
};

const pgCronStatus = (data: any): SemaphoreStatus => {
  if (!data?.pg_cron) return "unknown";
  const c = data.pg_cron;
  if (c.active_jobs === 0) return "error";
  if (c.failed_24h > 0) return "warn";
  return "ok";
};

const realtimeStatus = (data: any): SemaphoreStatus => {
  if (!data?.realtime) return "unknown";
  return data.realtime.total_published > 0 ? "ok" : "warn";
};

const databaseStatus = (data: any): SemaphoreStatus => {
  if (!data?.database) return "unknown";
  const gb = data.database.size_bytes / (1024 * 1024 * 1024);
  if (gb > 8) return "error";
  if (gb > 4) return "warn";
  return "ok";
};

const bottlenecksStatus = (data: any): SemaphoreStatus => {
  if (!data?.order_bottlenecks) return "unknown";
  const oldest = Math.max(
    0,
    ...((data.order_bottlenecks.by_status ?? []).map((s: any) => s.oldest_minutes))
  );
  if (oldest > 180) return "error";
  if (oldest > 60) return "warn";
  return "ok";
};

const orderStatusLabels: Record<string, string> = {
  pending: "Pendente",
  processing_payment: "Processando pgto",
  partially_paid: "Parcialmente pago",
  preparing: "Preparando",
  ready: "Pronto",
  partially_delivered: "Parc. entregue",
};

export default function OperacoesSaude() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchHealth = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    const { data: respData, error } = await (supabase.rpc as any)("get_system_health");
    if (error) {
      toast.error("Erro ao carregar saúde: " + error.message);
    } else if (respData) {
      setData(respData);
    }
    setLoading(false);
    if (isManual) {
      setRefreshing(false);
      toast.success("Atualizado");
    }
  };

  useEffect(() => {
    fetchHealth();
    refreshTimerRef.current = setInterval(() => fetchHealth(), 5 * 60 * 1000);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderSemaphore = (status: SemaphoreStatus, label: string) => {
    const cfg = semaphoreConfig[status];
    const Icon = cfg.icon;
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${cfg.bg} ${cfg.text}`}
        aria-label={`${label}: ${cfg.label}`}
      >
        <Icon className="h-3.5 w-3.5" />
        {cfg.label}
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              Saúde do Sistema
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Status operacional dos componentes da plataforma
              {data?.checked_at && (
                <span className="ml-1">
                  · Atualizado {formatRelativeTime(data.checked_at)}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs gap-1">
              <Clock className="h-3 w-3" />
              Auto-refresh 5min
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchHealth(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        ) : !data ? (
          <p className="text-muted-foreground text-sm">Sem dados</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* pg_cron */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    pg_cron (Jobs Agendados)
                  </CardTitle>
                  {renderSemaphore(pgCronStatus(data), "pg_cron")}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {formatInt(data.pg_cron.active_jobs)}
                    </p>
                    <p className="text-xs text-muted-foreground">Ativos</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {formatInt(data.pg_cron.runs_24h)}
                    </p>
                    <p className="text-xs text-muted-foreground">Execuções 24h</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {formatPct(data.pg_cron.success_rate_24h)}
                    </p>
                    <p className="text-xs text-muted-foreground">Sucesso</p>
                  </div>
                </div>
                {data.pg_cron.jobs?.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-border">
                    {data.pg_cron.jobs.map((j: any) => (
                      <div
                        key={j.jobid}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground truncate">{j.jobname}</p>
                          <p className="text-muted-foreground font-mono text-[10px]">
                            {j.schedule}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              j.last_run_status === "succeeded"
                                ? "text-green-400 border-green-500/30"
                                : j.last_run_status === "failed"
                                ? "text-red-400 border-red-500/30"
                                : "text-muted-foreground"
                            }`}
                          >
                            {j.last_run_status ?? "nunca"}
                          </Badge>
                          <span className="text-muted-foreground text-[10px]">
                            {formatRelativeTime(j.last_run_at)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Realtime */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    Realtime
                  </CardTitle>
                  {renderSemaphore(realtimeStatus(data), "Realtime")}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-foreground">
                    {formatInt(data.realtime.total_published)}
                  </span>
                  <span className="text-xs text-muted-foreground">tabelas publicadas</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {data.realtime.tables?.map((t: string) => (
                    <Badge key={t} variant="outline" className="text-[10px] font-mono">
                      {t}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Database */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Database className="h-4 w-4 text-primary" />
                    Database
                  </CardTitle>
                  {renderSemaphore(databaseStatus(data), "Database")}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {data.database.size_pretty}
                  </p>
                  <p className="text-xs text-muted-foreground">tamanho total do banco</p>
                </div>
                <div className="space-y-1.5 pt-2 border-t border-border">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">
                    Top 5 tabelas
                  </p>
                  {data.database.top_tables?.map((t: any) => (
                    <div
                      key={t.name}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="font-mono text-foreground truncate">{t.name}</span>
                      <span className="text-muted-foreground shrink-0 text-[10px]">
                        {t.size_pretty} · {formatInt(t.row_estimate)} rows
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Gargalos */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-primary" />
                    Pedidos em Estados Intermediários
                  </CardTitle>
                  {renderSemaphore(bottlenecksStatus(data), "Gargalos")}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-foreground">
                    {formatInt(data.order_bottlenecks.total_stuck)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    pedidos não concluídos
                  </span>
                </div>
                {data.order_bottlenecks.by_status?.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum pedido travado</p>
                ) : (
                  <div className="space-y-1.5 pt-2 border-t border-border">
                    {data.order_bottlenecks.by_status.map((s: any) => (
                      <div
                        key={s.status}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground">
                            {orderStatusLabels[s.status] ?? s.status}
                          </span>
                          <span className="text-muted-foreground">
                            ({formatInt(s.count)})
                          </span>
                        </div>
                        <span className="text-muted-foreground text-[10px]">
                          mais antigo há{" "}
                          {s.oldest_minutes < 60
                            ? `${s.oldest_minutes}min`
                            : s.oldest_minutes < 1440
                            ? `${Math.floor(s.oldest_minutes / 60)}h`
                            : `${Math.floor(s.oldest_minutes / 1440)}d`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}