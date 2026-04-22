import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Bell, AlertTriangle, AlertOctagon, CheckCircle2, HelpCircle, RefreshCw, Search, Eye, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const formatInt = (n: number) => new Intl.NumberFormat("pt-BR").format(n ?? 0);
const formatDateTimeBR = (iso: string | null | undefined) => {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
};
const formatRelativeTime = (iso: string | null | undefined): string => {
  if (!iso) return "-";
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min atrás`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h atrás`;
  return `${Math.floor(diffH / 24)}d atrás`;
};

const severityLabels: Record<string, string> = { critical: "Crítico", warning: "Atenção", info: "Info" };
const severityColors: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  warning: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  info: "bg-blue-500/15 text-blue-400 border-blue-500/30"
};
const statusLabels: Record<string, string> = { open: "Aberto", resolved: "Resolvido", auto_resolved: "Auto-resolvido", dismissed: "Dispensado" };
const statusColors: Record<string, string> = {
  open: "bg-primary/15 text-primary border-primary/30",
  resolved: "bg-green-500/15 text-green-400 border-green-500/30",
  auto_resolved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  dismissed: "bg-muted text-muted-foreground border-border"
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

export default function OperacoesAlertas() {
  const [activeTab, setActiveTab] = useState<"open" | "resolved">("open");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [alertDetail, setAlertDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [resolveNote, setResolveNote] = useState("");
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchText), 500);
    return () => clearTimeout(t);
  }, [searchText]);

  const fetchAlerts = async () => {
    setLoading(true);
    const { data: respData, error } = await (supabase.rpc as any)("get_alerts_list", {
      p_status_filter: activeTab,
      p_search: searchDebounced.trim() || null,
      p_page: 1,
      p_page_size: 50,
    });
    if (!error && respData) setData(respData);
    setLoading(false);
  };

  useEffect(() => { fetchAlerts(); }, [activeTab, searchDebounced]);

  // Realtime refetch + toast pra crítico novo
  useEffect(() => {
    const channel = supabase
      .channel("alerts-page")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alerts" },
        (payload: any) => {
          const newAlert = payload.new;
          if (newAlert?.severity === "critical" && newAlert?.status === "open") {
            toast.error(newAlert.title, { description: newAlert.message, duration: 8000 });
          }
          fetchAlerts();
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "alerts" }, () => fetchAlerts())
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "alerts" }, () => fetchAlerts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, searchDebounced]);

  const handleManualTrigger = async () => {
    const { data: r, error } = await (supabase.rpc as any)("trigger_generate_system_alerts");
    if (error) { toast.error(error.message); return; }
    const count = (r as any)?.fingerprints_generated?.length ?? 0;
    toast.success(`Disparo concluído (${count} alertas avaliados)`);
    fetchAlerts();
  };

  const loadAlertDetail = async (alertId: string) => {
    setSelectedAlertId(alertId);
    setAlertDetail(null);
    setResolveNote("");
    setLoadingDetail(true);
    const { data: d, error } = await (supabase.rpc as any)("get_alert_detail", { p_alert_id: alertId });
    if (error) { toast.error("Erro: " + error.message); setSelectedAlertId(null); }
    else setAlertDetail(d);
    setLoadingDetail(false);
  };

  const handleResolve = async () => {
    if (!selectedAlertId) return;
    setResolving(true);
    const { error } = await (supabase.rpc as any)("resolve_alert", {
      p_alert_id: selectedAlertId, p_note: resolveNote.trim() || null
    });
    setResolving(false);
    if (error) { toast.error("Erro ao resolver: " + error.message); return; }
    toast.success("Alerta resolvido");
    setSelectedAlertId(null); setAlertDetail(null); fetchAlerts();
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  const kpis = [
    {
      label: "Abertos", value: data?.summary?.open_total ?? 0, icon: Bell,
      color: (data?.summary?.open_total ?? 0) > 0 ? "text-foreground" : "text-muted-foreground",
      tooltip: "Alertas com status='open' ainda não resolvidos. Reflete estado atual em tempo real."
    },
    {
      label: "Críticos", value: data?.summary?.open_critical ?? 0, icon: AlertOctagon,
      color: (data?.summary?.open_critical ?? 0) > 0 ? "text-red-400" : "text-muted-foreground",
      tooltip: "Alertas críticos abertos: webhook Asaas, Edge Function, split divergente, cron PIX offline. Ação imediata."
    },
    {
      label: "Atenção", value: data?.summary?.open_warning ?? 0, icon: AlertTriangle,
      color: (data?.summary?.open_warning ?? 0) > 0 ? "text-yellow-400" : "text-muted-foreground",
      tooltip: "Alertas de atenção: PIX expirando em série, pagamentos falhando, pedido travado, evento sem atividade."
    },
    {
      label: "Resolvidos 24h", value: data?.summary?.resolved_24h ?? 0, icon: CheckCircle2,
      color: "text-muted-foreground",
      tooltip: "Alertas resolvidos (manual ou auto) nas últimas 24h. Indica ritmo de resolução."
    },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Alertas</h1>
            <p className="text-sm text-muted-foreground">
              Alertas operacionais — críticos (tempo real) e atenção (cron 5min)
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleManualTrigger}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Forçar avaliação
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-1.5">
                  <CardTitle className="text-xs font-medium text-muted-foreground">
                    {kpi.label}
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground/60 hover:text-muted-foreground">
                        <HelpCircle className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">{kpi.tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="h-8 w-8 rounded-full bg-muted/40 flex items-center justify-center">
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-16" /> : (
                  <p className={`text-2xl font-bold ${kpi.color}`}>{formatInt(kpi.value)}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList>
            <TabsTrigger value="open" className="gap-2">
              Abertos
              {(data?.summary?.open_total ?? 0) > 0 && (
                <Badge variant="secondary" className="bg-primary/15 text-primary">
                  {data.summary.open_total}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="resolved">Resolvidos</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4 space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por título, mensagem ou tipo..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="pl-9 h-10"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {activeTab === "open" ? "Alertas Abertos" : "Alertas Resolvidos"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
                  </div>
                ) : (data?.alerts?.length ?? 0) === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    {activeTab === "open" ? "Nenhum alerta aberto — tudo tranquilo!" : "Nenhum alerta no histórico"}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.alerts.map((a: any) => {
                      const isCriticalOpen = a.severity === "critical" && a.status === "open";
                      return (
                        <div
                          key={a.id}
                          onClick={() => loadAlertDetail(a.id)}
                          className={`group flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:border-primary/50 transition-colors ${
                            isCriticalOpen ? "bg-red-500/5 border-l-2 border-l-red-500/40" : "border-border"
                          }`}
                        >
                          <div className="mt-0.5">
                            {a.severity === "critical" ? <AlertOctagon className="h-5 w-5 text-red-400" /> :
                             a.severity === "warning" ? <AlertTriangle className="h-5 w-5 text-yellow-400" /> :
                             <Bell className="h-5 w-5 text-blue-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-sm font-medium truncate">{a.title}</span>
                              <Badge variant="outline" className={`text-[10px] ${severityColors[a.severity] ?? ""}`}>
                                {severityLabels[a.severity] ?? a.severity}
                              </Badge>
                              {a.status !== "open" && (
                                <Badge variant="outline" className={`text-[10px] ${statusColors[a.status] ?? ""}`}>
                                  {statusLabels[a.status] ?? a.status}
                                </Badge>
                              )}
                              {a.occurrence_count > 1 && (
                                <Badge variant="outline" className="text-[10px]">
                                  {a.occurrence_count}× ocorrências
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-1">{a.message}</p>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                              <span>{alertTypeLabels[a.alert_type] ?? a.alert_type}</span>
                              {a.client_name && (<><span>·</span><span>{a.client_name}</span></>)}
                              <span>·</span>
                              <span>{formatRelativeTime(a.last_seen_at)}</span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); loadAlertDetail(a.id); }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={!!selectedAlertId} onOpenChange={(open) => { if (!open) { setSelectedAlertId(null); setAlertDetail(null); setResolveNote(""); } }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {loadingDetail || !alertDetail ? "Carregando..." : alertDetail.title}
              </DialogTitle>
              {alertDetail && (
                <DialogDescription>
                  {alertTypeLabels[alertDetail.alert_type] ?? alertDetail.alert_type}
                </DialogDescription>
              )}
            </DialogHeader>

            {loadingDetail || !alertDetail ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={severityColors[alertDetail.severity] ?? ""}>
                    {severityLabels[alertDetail.severity]}
                  </Badge>
                  <Badge variant="outline" className={statusColors[alertDetail.status] ?? ""}>
                    {statusLabels[alertDetail.status]}
                  </Badge>
                  {alertDetail.occurrence_count > 1 && (
                    <Badge variant="outline">{alertDetail.occurrence_count}× ocorrências</Badge>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Mensagem</h4>
                  <p className="text-sm">{alertDetail.message}</p>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Timeline</h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Primeira ocorrência</span>
                      <span>{formatDateTimeBR(alertDetail.first_seen_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Última ocorrência</span>
                      <span>{formatDateTimeBR(alertDetail.last_seen_at)}</span>
                    </div>
                    {alertDetail.resolved_at && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Resolvido</span>
                          <span>{formatDateTimeBR(alertDetail.resolved_at)}</span>
                        </div>
                        {alertDetail.resolved_by_name && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Por</span>
                            <span>{alertDetail.resolved_by_name}</span>
                          </div>
                        )}
                        {alertDetail.resolution_note && (
                          <div className="flex justify-between gap-2">
                            <span className="text-muted-foreground">Motivo</span>
                            <span className="text-right">{alertDetail.resolution_note}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {alertDetail.entity_type && alertDetail.entity_id && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Entidade</h4>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="outline">{alertDetail.entity_type}</Badge>
                      <code className="text-[10px] bg-muted px-2 py-1 rounded truncate flex-1">{alertDetail.entity_id}</code>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(alertDetail.entity_id, "ID")}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    {alertDetail.client_name && (
                      <p className="text-xs text-muted-foreground mt-1">Cliente: {alertDetail.client_name}</p>
                    )}
                  </div>
                )}

                {alertDetail.metadata && Object.keys(alertDetail.metadata).length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Metadata</h4>
                    <pre className="text-[10px] bg-muted p-3 rounded overflow-x-auto max-h-40">
{JSON.stringify(alertDetail.metadata, null, 2)}
                    </pre>
                  </div>
                )}

                {alertDetail.status === "open" && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Resolver manualmente</h4>
                    <Textarea
                      placeholder="Nota de resolução (opcional)"
                      value={resolveNote}
                      onChange={(e) => setResolveNote(e.target.value)}
                      rows={2}
                      className="mb-2"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Se a condição ainda existir, o cron pode recriar na próxima rodada.
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
