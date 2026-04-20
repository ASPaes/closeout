import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, HelpCircle, AlertTriangle, CreditCard, CheckCircle2, XCircle, Zap } from "lucide-react";

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n ?? 0);
const formatInt = (n: number) => new Intl.NumberFormat("pt-BR").format(n ?? 0);
const formatDateTimeBR = (iso: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
};

const paymentStatusLabels: Record<string, string> = {
  created: "Criado",
  processing: "Processando",
  approved: "Aprovado",
  failed: "Falhou",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  expired: "Expirado",
};
const paymentStatusColors: Record<string, string> = {
  approved: "bg-green-500/15 text-green-400 border-green-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
  refunded: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  cancelled: "bg-muted text-muted-foreground border-border",
  expired: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  created: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  processing: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};
const asaasStatusColors: Record<string, string> = {
  RECEIVED: "bg-green-500/15 text-green-400 border-green-500/30",
  CONFIRMED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  PENDING: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  OVERDUE: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  REFUNDED: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};
const methodLabels: Record<string, string> = {
  pix: "PIX", credit_card: "Crédito", debit_card: "Débito", cash: "Dinheiro",
};
const billingTypeLabels: Record<string, string> = {
  PIX: "PIX", CREDIT_CARD: "Crédito", DEBIT_CARD: "Débito",
};
const divergenceLabels: Record<string, string> = {
  approved_sem_confirmacao_asaas: "Aprovado sem confirmação do Asaas",
  failed_mas_asaas_recebeu: "⚠️ Falhou mas Asaas recebeu",
  asaas_recebido_payment_nao_aprovado: "Asaas recebeu mas payment não aprovado",
  payment_aprovado_asaas_nao_confirmado: "Payment aprovado mas Asaas não confirmou",
};

const ALL_PAY_STATUSES = ["created", "processing", "approved", "failed", "cancelled", "refunded", "expired"];
const ALL_ASAAS_STATUSES = ["PENDING", "RECEIVED", "CONFIRMED", "OVERDUE", "REFUNDED"];
const ALL_BILLING_TYPES = ["PIX", "CREDIT_CARD", "DEBIT_CARD"];

const computePeriod = (period: string) => {
  const end = new Date();
  const start = new Date();
  if (period === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (period === "7d") {
    start.setDate(end.getDate() - 7);
  } else if (period === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(end.getDate() - 30);
  }
  return { start, end };
};

interface ChipsProps {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (vals: string[]) => void;
  colorMap: Record<string, string>;
}
const StatusChips = ({ options, selected, onChange, colorMap }: ChipsProps) => (
  <div className="flex flex-wrap items-center gap-1.5">
    {options.map((opt) => {
      const active = selected.includes(opt.value);
      return (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(active ? selected.filter((v) => v !== opt.value) : [...selected, opt.value])}
          className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
            active ? colorMap[opt.value] ?? "bg-primary/15 text-primary border-primary/30"
              : "bg-background border-border text-muted-foreground hover:border-primary/50"
          }`}
        >
          {opt.label}
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

interface KpiProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  tooltip: string;
}
const KpiCard = ({ title, value, icon, tooltip }: KpiProps) => (
  <Card>
    <CardHeader className="pb-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs text-muted-foreground">{title}</span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs"><p className="text-xs">{tooltip}</p></TooltipContent>
        </Tooltip>
      </div>
    </CardHeader>
    <CardContent className="pt-0">
      <p className="text-xl font-bold text-foreground">{value}</p>
    </CardContent>
  </Card>
);

export default function OperacoesPagamentos() {
  const [activeTab, setActiveTab] = useState<"payments" | "charges">("payments");
  const [period, setPeriod] = useState("30d");
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientsList, setClientsList] = useState<Array<{ id: string; name: string }>>([]);

  // Tab Payments
  const [payStatuses, setPayStatuses] = useState<string[]>([]);
  const [payMethod, setPayMethod] = useState<string | null>(null);
  const [payOnlyDivergent, setPayOnlyDivergent] = useState(false);
  const [payPage, setPayPage] = useState(1);
  const [payData, setPayData] = useState<any | null>(null);
  const [payLoading, setPayLoading] = useState(true);
  const [payError, setPayError] = useState<string | null>(null);

  // Tab Charges
  const [chAsaasStatuses, setChAsaasStatuses] = useState<string[]>([]);
  const [chBillingTypes, setChBillingTypes] = useState<string[]>([]);
  const [chPage, setChPage] = useState(1);
  const [chData, setChData] = useState<any | null>(null);
  const [chLoading, setChLoading] = useState(true);
  const [chError, setChError] = useState<string | null>(null);

  // Load clients dropdown
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("clients").select("id, name").eq("status", "active").order("name");
      if (data) setClientsList(data);
    };
    load();
  }, []);

  // Reset paginations
  useEffect(() => { setPayPage(1); }, [period, clientId, payStatuses, payMethod, payOnlyDivergent]);
  useEffect(() => { setChPage(1); }, [period, clientId, chAsaasStatuses, chBillingTypes]);

  // Fetch payments
  useEffect(() => {
    if (activeTab !== "payments") return;
    const fetchData = async () => {
      setPayLoading(true);
      const { start, end } = computePeriod(period);
      const { data, error } = await supabase.rpc("get_payments_global" as any, {
        p_start_date: start.toISOString(),
        p_end_date: end.toISOString(),
        p_statuses: payStatuses.length > 0 ? payStatuses : null,
        p_client_id: clientId,
        p_payment_method: payMethod,
        p_only_divergent: payOnlyDivergent,
        p_page: payPage,
        p_page_size: 50,
      } as any);
      if (error) { setPayError(error.message); setPayLoading(false); return; }
      setPayData(data); setPayError(null); setPayLoading(false);
    };
    fetchData();
  }, [activeTab, period, clientId, payStatuses, payMethod, payOnlyDivergent, payPage]);

  // Fetch charges
  useEffect(() => {
    if (activeTab !== "charges") return;
    const fetchData = async () => {
      setChLoading(true);
      const { start, end } = computePeriod(period);
      const { data, error } = await supabase.rpc("get_asaas_charges_global" as any, {
        p_start_date: start.toISOString(),
        p_end_date: end.toISOString(),
        p_asaas_statuses: chAsaasStatuses.length > 0 ? chAsaasStatuses : null,
        p_billing_types: chBillingTypes.length > 0 ? chBillingTypes : null,
        p_client_id: clientId,
        p_page: chPage,
        p_page_size: 50,
      } as any);
      if (error) { setChError(error.message); setChLoading(false); return; }
      setChData(data); setChError(null); setChLoading(false);
    };
    fetchData();
  }, [activeTab, period, clientId, chAsaasStatuses, chBillingTypes, chPage]);

  const paySummary = payData?.summary ?? {};
  const chSummary = chData?.summary ?? {};

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pagamentos & Asaas</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Pagamentos da plataforma e reconciliação com gateway
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup type="single" value={period} onValueChange={(v) => v && setPeriod(v)} variant="outline" size="sm">
              <ToggleGroupItem value="today">Hoje</ToggleGroupItem>
              <ToggleGroupItem value="7d">7d</ToggleGroupItem>
              <ToggleGroupItem value="30d">30d</ToggleGroupItem>
              <ToggleGroupItem value="month">Mês</ToggleGroupItem>
            </ToggleGroup>
            <Select value={clientId ?? "all"} onValueChange={(v) => setClientId(v === "all" ? null : v)}>
              <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos clientes</SelectItem>
                {clientsList.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList>
            <TabsTrigger value="payments">Pagamentos (Plataforma)</TabsTrigger>
            <TabsTrigger value="charges">Asaas Charges (Gateway)</TabsTrigger>
          </TabsList>

          {/* ============ TAB PAYMENTS ============ */}
          <TabsContent value="payments" className="space-y-4 mt-4">
            {/* Filtros específicos */}
            <Card>
              <CardContent className="py-4 space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                  <Select value={payMethod ?? "all"} onValueChange={(v) => setPayMethod(v === "all" ? null : v)}>
                    <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Método" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos métodos</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="credit_card">Crédito</SelectItem>
                      <SelectItem value="debit_card">Débito</SelectItem>
                      <SelectItem value="cash">Dinheiro</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2 ml-auto px-3 py-1.5 rounded-md border border-border bg-card">
                    <Switch id="divergent-switch" checked={payOnlyDivergent} onCheckedChange={setPayOnlyDivergent} />
                    <Label htmlFor="divergent-switch" className="text-xs cursor-pointer">Só divergências</Label>
                    {payData?.summary?.divergent_count > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-red-500/15 text-red-400 border-red-500/30">
                        {payData.summary.divergent_count} divergente(s)
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Status:</span>
                  <StatusChips
                    options={ALL_PAY_STATUSES.map((s) => ({ value: s, label: paymentStatusLabels[s] ?? s }))}
                    selected={payStatuses}
                    onChange={setPayStatuses}
                    colorMap={paymentStatusColors}
                  />
                </div>
              </CardContent>
            </Card>

            {payError ? (
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4 text-center">
                <p className="text-sm text-destructive">{payError}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setPayPage((p) => p)}>Tentar novamente</Button>
              </div>
            ) : (
              <>
                {/* KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  {payLoading ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />) : (
                    <>
                      <KpiCard title="Total" value={formatInt(paySummary.total_payments ?? 0)}
                        icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
                        tooltip="Total de tentativas de pagamento (incluindo falhas e cancelamentos)." />
                      <KpiCard title="Aprovados" value={formatInt(paySummary.approved_count ?? 0)}
                        icon={<CheckCircle2 className="h-4 w-4 text-green-400" />}
                        tooltip="Pagamentos com status='approved'." />
                      <KpiCard title="Falhas" value={formatInt(paySummary.failed_count ?? 0)}
                        icon={<XCircle className="h-4 w-4 text-red-400" />}
                        tooltip="Pagamentos com status='failed' — cartão recusado, saldo insuficiente, etc." />
                      <KpiCard title="GMV Aprovado" value={formatBRL(paySummary.gmv_approved ?? 0)}
                        icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
                        tooltip="Soma dos valores aprovados." />
                      <KpiCard title="Fees Capturadas" value={formatBRL(paySummary.fees_total ?? 0)}
                        icon={<Zap className="h-4 w-4 text-primary" />}
                        tooltip="Total de taxas retidas pela plataforma (closeout_amount no Asaas)." />
                    </>
                  )}
                </div>

                {/* Lista */}
                <Card>
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <CardTitle>Pagamentos</CardTitle>
                      {payData?.pagination && (
                        <span className="text-xs text-muted-foreground">
                          {formatInt(payData.pagination.total_count)} encontrados · página {payData.pagination.page} de {payData.pagination.total_pages}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {payLoading ? (
                      <div className="p-4"><Skeleton className="h-96 w-full" /></div>
                    ) : !payData?.payments || payData.payments.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground text-sm">
                        Nenhum pagamento encontrado com os filtros aplicados
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-border">
                            <tr className="text-left text-xs text-muted-foreground">
                              <th className="px-4 py-2 font-medium">Data</th>
                              <th className="px-4 py-2 font-medium">Cliente</th>
                              <th className="px-4 py-2 font-medium">Consumer</th>
                              <th className="px-4 py-2 font-medium">Método</th>
                              <th className="px-4 py-2 font-medium text-right">Valor</th>
                              <th className="px-4 py-2 font-medium">Status</th>
                              <th className="px-4 py-2 font-medium">Asaas</th>
                              <th className="px-4 py-2 font-medium">Divergência</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payData.payments.map((p: any) => {
                              const divergent = !!p.divergence_type;
                              return (
                                <tr key={p.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${
                                  divergent ? "ring-1 ring-red-500/30 bg-red-500/5" : ""
                                }`}>
                                  <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                                    {formatDateTimeBR(p.created_at)}
                                  </td>
                                  <td className="px-4 py-2 text-xs">{p.client_name ?? "-"}</td>
                                  <td className="px-4 py-2 text-xs">{p.consumer_name ?? "-"}</td>
                                  <td className="px-4 py-2 text-xs">{methodLabels[p.payment_method] ?? p.payment_method}</td>
                                  <td className="px-4 py-2 text-right whitespace-nowrap">
                                    <span className="font-medium">{formatBRL(p.amount)}</span>
                                    {p.split_total > 1 && (
                                      <span className="ml-1 text-[10px] text-muted-foreground">({p.split_index}/{p.split_total})</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2">
                                    <Badge variant="outline" className={`text-[10px] ${paymentStatusColors[p.status] ?? ""}`}>
                                      {paymentStatusLabels[p.status] ?? p.status}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-2">
                                    {p.asaas_status ? (
                                      <Badge variant="outline" className={`text-[10px] ${asaasStatusColors[p.asaas_status] ?? ""}`}>
                                        {p.asaas_status}
                                      </Badge>
                                    ) : <span className="text-xs text-muted-foreground">-</span>}
                                  </td>
                                  <td className="px-4 py-2">
                                    {divergent ? (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="flex items-center gap-1 text-red-400 cursor-help">
                                            <AlertTriangle className="h-3.5 w-3.5" />
                                            <span className="text-[10px] font-medium">Divergente</span>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">
                                          <p className="text-xs">{divergenceLabels[p.divergence_type] ?? p.divergence_type}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    ) : null}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {payData?.pagination && payData.pagination.total_pages > 1 && (
                      <div className="flex items-center justify-between p-3 border-t border-border">
                        <span className="text-xs text-muted-foreground">
                          {(payData.pagination.page - 1) * payData.pagination.page_size + 1}–
                          {Math.min(payData.pagination.page * payData.pagination.page_size, payData.pagination.total_count)} de {formatInt(payData.pagination.total_count)}
                        </span>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" disabled={!payData.pagination.has_prev}
                            onClick={() => setPayPage((p) => Math.max(1, p - 1))}>
                            <ChevronLeft className="h-3 w-3 mr-1" /> Anterior
                          </Button>
                          <Button variant="outline" size="sm" disabled={!payData.pagination.has_next}
                            onClick={() => setPayPage((p) => p + 1)}>
                            Próxima <ChevronRight className="h-3 w-3 ml-1" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ============ TAB CHARGES ============ */}
          <TabsContent value="charges" className="space-y-4 mt-4">
            <Card>
              <CardContent className="py-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground min-w-[60px]">Status Asaas:</span>
                  <StatusChips
                    options={ALL_ASAAS_STATUSES.map((s) => ({ value: s, label: s }))}
                    selected={chAsaasStatuses}
                    onChange={setChAsaasStatuses}
                    colorMap={asaasStatusColors}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground min-w-[60px]">Tipo:</span>
                  <StatusChips
                    options={ALL_BILLING_TYPES.map((b) => ({ value: b, label: billingTypeLabels[b] ?? b }))}
                    selected={chBillingTypes}
                    onChange={setChBillingTypes}
                    colorMap={{}}
                  />
                </div>
              </CardContent>
            </Card>

            {chError ? (
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4 text-center">
                <p className="text-sm text-destructive">{chError}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setChPage((p) => p)}>Tentar novamente</Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  {chLoading ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />) : (
                    <>
                      <KpiCard title="Total Charges" value={formatInt(chSummary.total_charges ?? 0)}
                        icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
                        tooltip="Total de cobranças criadas no gateway Asaas." />
                      <KpiCard title="Recebidas (PIX)" value={formatInt(chSummary.received_count ?? 0)}
                        icon={<CheckCircle2 className="h-4 w-4 text-green-400" />}
                        tooltip="Charges com asaas_status='RECEIVED' — pagamento PIX recebido pelo Asaas." />
                      <KpiCard title="Confirmadas (Cartão)" value={formatInt(chSummary.confirmed_count ?? 0)}
                        icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                        tooltip="Charges com asaas_status='CONFIRMED' — cartão aprovado e liquidado." />
                      <KpiCard title="Fees Capturadas" value={formatBRL(chSummary.fees_captured ?? 0)}
                        icon={<Zap className="h-4 w-4 text-primary" />}
                        tooltip="Total de closeout_amount — o que a plataforma reteve em cobranças bem-sucedidas." />
                      <KpiCard title="Taxas Pagas ao Asaas" value={formatBRL(chSummary.asaas_fees_paid ?? 0)}
                        icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
                        tooltip="Total de fee_amount pago ao Asaas como gateway — custo da plataforma." />
                    </>
                  )}
                </div>

                <Card>
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <CardTitle>Asaas Charges</CardTitle>
                      {chData?.pagination && (
                        <span className="text-xs text-muted-foreground">
                          {formatInt(chData.pagination.total_count)} encontradas · página {chData.pagination.page} de {chData.pagination.total_pages}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {chLoading ? (
                      <div className="p-4"><Skeleton className="h-96 w-full" /></div>
                    ) : !chData?.charges || chData.charges.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground text-sm">
                        Nenhuma cobrança encontrada com os filtros aplicados
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-border">
                            <tr className="text-left text-xs text-muted-foreground">
                              <th className="px-4 py-2 font-medium">Data</th>
                              <th className="px-4 py-2 font-medium">Cliente</th>
                              <th className="px-4 py-2 font-medium">Consumer</th>
                              <th className="px-4 py-2 font-medium">Tipo</th>
                              <th className="px-4 py-2 font-medium">Asaas ID</th>
                              <th className="px-4 py-2 font-medium text-right">Bruto</th>
                              <th className="px-4 py-2 font-medium text-right">Net</th>
                              <th className="px-4 py-2 font-medium text-right">Fee</th>
                              <th className="px-4 py-2 font-medium text-right">Closeout</th>
                              <th className="px-4 py-2 font-medium">Status</th>
                              <th className="px-4 py-2 font-medium">Divergência</th>
                            </tr>
                          </thead>
                          <tbody>
                            {chData.charges.map((c: any) => {
                              const divergent = !!c.divergence_type;
                              return (
                                <tr key={c.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${
                                  divergent ? "ring-1 ring-red-500/30 bg-red-500/5" : ""
                                }`}>
                                  <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                                    {formatDateTimeBR(c.created_at)}
                                  </td>
                                  <td className="px-4 py-2 text-xs">{c.client_name ?? "-"}</td>
                                  <td className="px-4 py-2 text-xs">{c.consumer_name ?? "-"}</td>
                                  <td className="px-4 py-2 text-xs">{billingTypeLabels[c.billing_type] ?? c.billing_type}</td>
                                  <td className="px-4 py-2">
                                    <span className="text-[10px] font-mono text-muted-foreground">{c.asaas_charge_id}</span>
                                  </td>
                                  <td className="px-4 py-2 text-right text-xs whitespace-nowrap">{formatBRL(c.amount)}</td>
                                  <td className="px-4 py-2 text-right text-xs whitespace-nowrap">{formatBRL(c.net_amount ?? 0)}</td>
                                  <td className="px-4 py-2 text-right text-xs text-muted-foreground whitespace-nowrap">{formatBRL(c.fee_amount ?? 0)}</td>
                                  <td className="px-4 py-2 text-right text-xs font-medium text-primary whitespace-nowrap">{formatBRL(c.closeout_amount ?? 0)}</td>
                                  <td className="px-4 py-2">
                                    <Badge variant="outline" className={`text-[10px] ${asaasStatusColors[c.asaas_status] ?? ""}`}>
                                      {c.asaas_status}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-2">
                                    {divergent ? (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="flex items-center gap-1 text-red-400 cursor-help">
                                            <AlertTriangle className="h-3.5 w-3.5" />
                                            <span className="text-[10px] font-medium">Divergente</span>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">
                                          <p className="text-xs">{divergenceLabels[c.divergence_type] ?? c.divergence_type}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    ) : null}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {chData?.pagination && chData.pagination.total_pages > 1 && (
                      <div className="flex items-center justify-between p-3 border-t border-border">
                        <span className="text-xs text-muted-foreground">
                          {(chData.pagination.page - 1) * chData.pagination.page_size + 1}–
                          {Math.min(chData.pagination.page * chData.pagination.page_size, chData.pagination.total_count)} de {formatInt(chData.pagination.total_count)}
                        </span>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" disabled={!chData.pagination.has_prev}
                            onClick={() => setChPage((p) => Math.max(1, p - 1))}>
                            <ChevronLeft className="h-3 w-3 mr-1" /> Anterior
                          </Button>
                          <Button variant="outline" size="sm" disabled={!chData.pagination.has_next}
                            onClick={() => setChPage((p) => p + 1)}>
                            Próxima <ChevronRight className="h-3 w-3 ml-1" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
