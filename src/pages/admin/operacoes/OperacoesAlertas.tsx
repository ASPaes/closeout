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

          <TabsContent value={activeTab} className="mt-4">
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Lista de alertas — próximo prompt
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
