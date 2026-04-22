import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Bell, AlertTriangle, AlertOctagon, CheckCircle2, Search,
  ChevronLeft, ChevronRight, HelpCircle, Eye, Copy, RefreshCw
} from "lucide-react";

const formatInt = (n: number) => new Intl.NumberFormat("pt-BR").format(n ?? 0);
const formatDateTimeBR = (iso: string | null | undefined) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit"
  });
};
const formatRelativeTime = (iso: string | null | undefined): string => {
  if (!iso) return "-";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min atrás`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h atrás`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d atrás`;
};

const severityLabels: Record<string, string> = {
  critical: "Crítico",
  warning: "Atenção",
  info: "Info"
};
const severityColors: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  warning: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  info: "bg-blue-500/15 text-blue-400 border-blue-500/30"
};
const statusLabels: Record<string, string> = {
  open: "Aberto",
  resolved: "Resolvido",
  auto_resolved: "Auto-resolvido",
  dismissed: "Dispensado"
};
const statusColors: Record<string, string> = {
  open: "bg-primary/15 text-primary border-primary/30",
  resolved: "bg-green-500/15 text-green-400 border-green-500/30",
  auto_resolved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  dismissed: "bg-muted text-muted-foreground border-border"
};
const sourceLabels: Record<string, string> = {
  cron: "Cron (5min)",
  trigger: "Trigger (tempo real)",
  edge_function: "Edge Function"
};
const alertTypeLabels: Record<string, string> = {
  cron_pix_offline: "Cron PIX offline",
  split_divergente: "Split divergente",
  webhook_asaas_failed: "Webhook Asaas falhou",
  edge_function_failed: "Edge Function falhou",
  pix_expire_high: "Taxa alta de PIX expirado",
  payments_failed_burst: "Pagamentos falhando em série",
  order_stuck: "Pedido travado",
  event_no_activity: "Evento sem atividade"
};

const ALL_SEVERITIES = ["critical", "warning", "info"];
const ALL_SOURCES = ["cron", "trigger", "edge_function"];
const ALL_ALERT_TYPES = [
  "cron_pix_offline", "split_divergente", "webhook_asaas_failed", "edge_function_failed",
  "pix_expire_high", "payments_failed_burst", "order_stuck", "event_no_activity"
];

type ChipsProps = {
  options: string[];
  selected: string[];
  onChange: (vals: string[]) => void;
  labelMap: Record<string, string>;
  colorMap?: Record<string, string>;
};

const Chips = ({ options, selected, onChange, labelMap, colorMap }: ChipsProps) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map(opt => {
      const active = selected.includes(opt);
      return (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(active ? selected.filter(v => v !== opt) : [...selected, opt])}
          className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
            active && colorMap?.[opt] ? colorMap[opt] :
            active ? "bg-primary/15 text-primary border-primary/30" :
            "bg-background border-border text-muted-foreground hover:border-primary/50"
          }`}
        >
          {labelMap[opt] ?? opt}
        </button>
      );
    })}
    {selected.length > 0 && (
      <button
        type="button"
        onClick={() => onChange([])}
        className="text-[11px] px-2 py-1 text-muted-foreground hover:text-foreground"
      >
        Limpar
      </button>
    )}
  </div>
);

export default function OperacoesAlertas() {
  const [activeTab, setActiveTab] = useState<"open" | "resolved">("open");
  const [severities, setSeverities] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [alertTypes, setAlertTypes] = useState<string[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<any>(null);
  const [clientsList, setClientsList] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [alertDetail, setAlertDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [resolveNote, setResolveNote] = useState("");
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchText), 500);
    return () => clearTimeout(t);
  }, [searchText]);

  useEffect(() => {
    supabase.from("clients").select("id, name").eq("status", "active").order("name")
      .then(({ data }) => { if (data) setClientsList(data as any); });
  }, []);

  useEffect(() => { setPage(1); }, [activeTab, severities, sources, alertTypes, clientId, searchDebounced]);

  const fetchAlerts = async () => {
    setLoading(true);
    const { data: respData, error: respError } = await (supabase.rpc as any)("get_alerts_list", {
      p_status_filter: activeTab,
      p_severities: severities.length > 0 ? severities : null,
      p_sources: sources.length > 0 ? sources : null,
      p_alert_types: alertTypes.length > 0 ? alertTypes : null,
      p_client_id: clientId,
      p_search: searchDebounced.trim() || null,
      p_page: page,
      p_page_size: 50,
    });
    if (respError) { setError(respError.message); setLoading(false); return; }
    setData(respData); setError(null); setLoading(false);
  };

  useEffect(() => { fetchAlerts(); }, [activeTab, severities, sources, alertTypes, clientId, searchDebounced, page]);

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedRefetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchAlerts(), 300);
    };

    const channel = supabase
      .channel("alerts-page")
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "alerts" },
        (payload: any) => {
          const newAlert = payload.new;
          if (newAlert?.severity === "critical" && newAlert?.status === "open") {
            toast.error(newAlert.title, {
              description: newAlert.message,
              duration: 8000,
            });
          }
          debouncedRefetch();
        }
      )
      .on(
        "postgres_changes" as any,
        { event: "UPDATE", schema: "public", table: "alerts" },
        () => debouncedRefetch()
      )
      .on(
        "postgres_changes" as any,
        { event: "DELETE", schema: "public", table: "alerts" },
        () => debouncedRefetch()
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAlertDetail = async (alertId: string) => {
    setSelectedAlertId(alertId);
    setAlertDetail(null);
    setResolveNote("");
    setLoadingDetail(true);
    const { data: detail, error } = await (supabase.rpc as any)("get_alert_detail", { p_alert_id: alertId });
    if (error) { toast.error("Erro ao carregar detalhes: " + error.message); setSelectedAlertId(null); }
    else { setAlertDetail(detail); }
    setLoadingDetail(false);
  };

  const handleResolve = async () => {
    if (!selectedAlertId) return;
    setResolving(true);
    const { error } = await (supabase.rpc as any)("resolve_alert", {
      p_alert_id: selectedAlertId,
      p_note: resolveNote.trim() || null
    });
    setResolving(false);
    if (error) { toast.error("Erro ao resolver: " + error.message); return; }
    toast.success("Alerta resolvido");
    setSelectedAlertId(null);
    setAlertDetail(null);
    fetchAlerts();
  };

  const handleManualTrigger = async () => {
    const { data: respData, error } = await (supabase.rpc as any)("trigger_generate_system_alerts");
    if (error) { toast.error(error.message); return; }
    toast.success(`Disparo concluído (${(respData as any)?.fingerprints_generated?.length ?? 0} alertas avaliados)`);
    fetchAlerts();
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  const kpis = [
    {
      label: "Abertos",
      value: data?.summary?.open_total ?? 0,
      icon: Bell,
      valueColor: (data?.summary?.open_total ?? 0) > 0 ? "text-foreground" : "text-muted-foreground",
      tooltip: "Alertas com status='open' — condições detectadas e ainda não resolvidas. Reflete estado atual do sistema em tempo real."
    },
    {
      label: "Críticos",
      value: data?.summary?.open_critical ?? 0,
      icon: AlertOctagon,
      valueColor: (data?.summary?.open_critical ?? 0) > 0 ? "text-red-400" : "text-muted-foreground",
      tooltip: "Alertas críticos abertos: webhook Asaas falhou, Edge Function falhou, split divergente entre payment e Asaas, cron PIX offline. Precisam de ação imediata."
    },
    {
      label: "Atenção",
      value: data?.summary?.open_warning ?? 0,
      icon: AlertTriangle,
      valueColor: (data?.summary?.open_warning ?? 0) > 0 ? "text-yellow-400" : "text-muted-foreground",
      tooltip: "Alertas de atenção abertos: taxa alta de PIX expirado, falhas de pagamento em série, pedido travado >30min, evento sem atividade. Avaliar mas sem urgência absoluta."
    },
    {
      label: "Resolvidos 24h",
      value: data?.summary?.resolved_24h ?? 0,
      icon: CheckCircle2,
      valueColor: "text-muted-foreground",
      tooltip: "Alertas resolvidos (manualmente ou automaticamente) nas últimas 24 horas. Indica ritmo de resolução do sistema."
    },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6 p-4 md:p-6">
        {/* HEADER */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Alertas</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Alertas operacionais da plataforma — críticos (tempo real) e atenção (cron 5min)
            </p>
          </div>
          <div>
            <Button variant="outline" size="sm" onClick={handleManualTrigger}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Forçar avaliação
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.label}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">
                        {kpi.label}
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button">
                            <HelpCircle className="h-3 w-3 text-muted-foreground/60 hover:text-muted-foreground" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">{kpi.tooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-muted/40 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-9 w-16" />
                  ) : (
                    <div className={`text-3xl font-semibold ${kpi.valueColor}`}>
                      {formatInt(kpi.value)}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList>
            <TabsTrigger value="open" className="gap-2">
              Abertos
              {(data?.summary?.open_total ?? 0) > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                  {data.summary.open_total}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="resolved">Resolvidos</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4 mt-4">
            {/* Filtros */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por título ou mensagem..."
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="pl-9 h-10"
                    />
                  </div>
                  <Select value={clientId ?? "all"} onValueChange={(v) => setClientId(v === "all" ? null : v)}>
                    <SelectTrigger className="w-[200px] h-10">
                      <SelectValue placeholder="Todos clientes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos clientes</SelectItem>
                      {clientsList.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-start gap-2 flex-wrap">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider mt-1.5 shrink-0">Severidade:</span>
                  <Chips options={ALL_SEVERITIES} selected={severities} onChange={setSeverities} labelMap={severityLabels} colorMap={severityColors} />
                </div>

                <div className="flex items-start gap-2 flex-wrap">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider mt-1.5 shrink-0">Origem:</span>
                  <Chips options={ALL_SOURCES} selected={sources} onChange={setSources} labelMap={sourceLabels} />
                </div>

                <div className="flex items-start gap-2 flex-wrap">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider mt-1.5 shrink-0">Tipo:</span>
                  <Chips options={ALL_ALERT_TYPES} selected={alertTypes} onChange={setAlertTypes} labelMap={alertTypeLabels} />
                </div>
              </CardContent>
            </Card>

            {/* Lista */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base">
                    {activeTab === "open" ? "Alertas Abertos" : "Alertas Resolvidos"}
                  </CardTitle>
                  {data && (
                    <span className="text-xs text-muted-foreground">
                      {formatInt(data.pagination.total_count)} encontrados · página {data.pagination.page} de {data.pagination.total_pages || 1}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                  </div>
                ) : error ? (
                  <div className="py-12 text-center space-y-3">
                    <p className="text-sm text-destructive">{error}</p>
                    <Button variant="outline" size="sm" onClick={fetchAlerts}>Tentar novamente</Button>
                  </div>
                ) : data?.alerts?.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    {activeTab === "open" ? "Nenhum alerta aberto — tudo tranquilo!" : "Nenhum alerta resolvido no histórico"}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.alerts.map((a: any) => {
                      const isCriticalOpen = a.severity === "critical" && a.status === "open";
                      return (
                        <div
                          key={a.id}
                          onClick={() => loadAlertDetail(a.id)}
                          className={`p-3 rounded-md border cursor-pointer hover:bg-muted/20 transition-colors ${
                            isCriticalOpen ? "bg-red-500/5 border-l-2 border-l-red-500/40" : "border-border"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="shrink-0 mt-0.5">
                              {a.severity === "critical" ? <AlertOctagon className="h-4 w-4 text-red-400" /> :
                                a.severity === "warning" ? <AlertTriangle className="h-4 w-4 text-yellow-400" /> :
                                  <Bell className="h-4 w-4 text-blue-400" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-sm font-medium truncate">{a.title}</span>
                                <Badge variant="outline" className={`text-[10px] ${severityColors[a.severity]}`}>
                                  {severityLabels[a.severity] ?? a.severity}
                                </Badge>
                                {a.status !== "open" && (
                                  <Badge variant="outline" className={`text-[10px] ${statusColors[a.status]}`}>
                                    {statusLabels[a.status] ?? a.status}
                                  </Badge>
                                )}
                                {a.occurrence_count > 1 && (
                                  <Badge variant="outline" className="text-[10px]">
                                    {a.occurrence_count}× ocorrências
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2">{a.message}</p>
                              <div className="flex items-center gap-1.5 flex-wrap mt-1.5 text-[10px] text-muted-foreground">
                                <span>{alertTypeLabels[a.alert_type] ?? a.alert_type}</span>
                                <span>·</span>
                                <span>{sourceLabels[a.source] ?? a.source}</span>
                                {a.client_name && (
                                  <>
                                    <span>·</span>
                                    <span>{a.client_name}</span>
                                  </>
                                )}
                                <span>·</span>
                                <span>{formatRelativeTime(a.last_seen_at)}</span>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" className="shrink-0" onClick={(e) => { e.stopPropagation(); loadAlertDetail(a.id); }}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Paginação */}
                {data?.pagination?.total_pages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                      {(data.pagination.page - 1) * data.pagination.page_size + 1}–
                      {Math.min(data.pagination.page * data.pagination.page_size, data.pagination.total_count)} de {formatInt(data.pagination.total_count)}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" disabled={!data.pagination.has_prev} onClick={() => setPage(p => Math.max(1, p - 1))}>
                        <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Anterior
                      </Button>
                      <Button variant="outline" size="sm" disabled={!data.pagination.has_next} onClick={() => setPage(p => p + 1)}>
                        Próxima <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* MODAL DETAIL */}
        <Dialog open={!!selectedAlertId} onOpenChange={(open) => { if (!open) { setSelectedAlertId(null); setAlertDetail(null); setResolveNote(""); } }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{loadingDetail || !alertDetail ? "Carregando..." : alertDetail.title}</DialogTitle>
              {alertDetail && (
                <DialogDescription>
                  {alertTypeLabels[alertDetail.alert_type] ?? alertDetail.alert_type}
                </DialogDescription>
              )}
            </DialogHeader>

            {loadingDetail || !alertDetail ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={`text-[10px] ${severityColors[alertDetail.severity]}`}>
                    {severityLabels[alertDetail.severity]}
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] ${statusColors[alertDetail.status]}`}>
                    {statusLabels[alertDetail.status]}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {sourceLabels[alertDetail.source] ?? alertDetail.source}
                  </Badge>
                  {alertDetail.occurrence_count > 1 && (
                    <Badge variant="outline" className="text-[10px]">
                      {alertDetail.occurrence_count}× ocorrências
                    </Badge>
                  )}
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Mensagem</p>
                  <p className="text-sm">{alertDetail.message}</p>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Timeline</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Primeira ocorrência</span>
                      <span>{formatDateTimeBR(alertDetail.first_seen_at)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Última ocorrência</span>
                      <span>{formatDateTimeBR(alertDetail.last_seen_at)}</span>
                    </div>
                    {alertDetail.resolved_at && (
                      <>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Resolvido</span>
                          <span>{formatDateTimeBR(alertDetail.resolved_at)}</span>
                        </div>
                        {alertDetail.resolved_by_name && (
                          <div className="flex justify-between gap-2">
                            <span className="text-muted-foreground">Por</span>
                            <span>{alertDetail.resolved_by_name}</span>
                          </div>
                        )}
                        {alertDetail.resolution_note && (
                          <div className="flex justify-between gap-2">
                            <span className="text-muted-foreground">Motivo</span>
                            <span className="text-right max-w-[60%]">{alertDetail.resolution_note}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {alertDetail.entity_type && alertDetail.entity_id && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Entidade associada</p>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="outline" className="text-[10px]">{alertDetail.entity_type}</Badge>
                      <code className="font-mono text-[11px] bg-muted/40 px-2 py-0.5 rounded truncate flex-1">{alertDetail.entity_id}</code>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(alertDetail.entity_id, "ID da entidade")}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    {alertDetail.client_name && (
                      <p className="text-[10px] text-muted-foreground mt-1">Cliente: {alertDetail.client_name}</p>
                    )}
                  </div>
                )}

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Fingerprint</p>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-[11px] bg-muted/40 px-2 py-0.5 rounded truncate flex-1">{alertDetail.fingerprint}</code>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(alertDetail.fingerprint, "Fingerprint")}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {alertDetail.metadata && Object.keys(alertDetail.metadata).length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Metadata</p>
                    <pre className="text-[11px] bg-muted/40 p-2 rounded overflow-x-auto max-h-48">
{JSON.stringify(alertDetail.metadata, null, 2)}
                    </pre>
                  </div>
                )}

                {alertDetail.status === "open" && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Resolver manualmente</p>
                    <Textarea
                      placeholder="Motivo / nota de resolução (opcional)"
                      value={resolveNote}
                      onChange={(e) => setResolveNote(e.target.value)}
                      rows={2}
                      className="mb-2"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Ao resolver, o alerta some da lista de abertos. Se a condição ainda
                      existir, o cron pode recriar na próxima rodada.
                    </p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              {alertDetail?.status === "open" ? (
                <>
                  <Button variant="outline" onClick={() => setSelectedAlertId(null)}>Fechar</Button>
                  <Button onClick={handleResolve} disabled={resolving}>
                    {resolving ? "Resolvendo..." : "Resolver"}
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => setSelectedAlertId(null)}>Fechar</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
