import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "@/i18n/use-translation";
import { useEventClosingReport } from "@/hooks/useEventClosingReport";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Download, DollarSign, BarChart3, Receipt, XCircle, Wallet, CreditCard, Smartphone, Banknote, FileText } from "lucide-react";

const fmt = (v: number | null | undefined) =>
  `R$ ${(Number(v) || 0).toFixed(2).replace(".", ",")}`;

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

const statusVariant = (s: string): "draft" | "active" | "completed" | "cancelled" | "inactive" => {
  if (s === "draft") return "draft";
  if (s === "active") return "active";
  if (s === "completed") return "completed";
  if (s === "cancelled") return "cancelled";
  return "inactive";
};

function MetricCard({ title, value, icon: Icon, loading }: { title: string; value: string | number; icon: any; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold text-primary">{value}</div>}
      </CardContent>
    </Card>
  );
}

export default function GestorEventoFechamento() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { summary, cashRegisters, cancellations, isLoading } = useEventClosingReport(eventId ?? "");

  const s = summary as any;

  const statusLabel = (st: string) => {
    const map: Record<string, string> = { draft: t("draft"), active: t("active"), completed: t("completed"), cancelled: t("cancelled") };
    return map[st] ?? st;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/gestor/eventos")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            {isLoading ? (
              <>
                <Skeleton className="h-7 w-48 mb-1" />
                <Skeleton className="h-4 w-64" />
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight">{s?.event_name ?? t("gef_title")}</h1>
                  {s?.event_status && <StatusBadge status={statusVariant(s.event_status)} label={statusLabel(s.event_status)} />}
                </div>
                {(s?.start_at || s?.end_at) && (
                  <p className="text-sm text-muted-foreground">
                    {fmtDate(s?.start_at)} — {fmtDate(s?.end_at)}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
        <Button variant="outline" disabled>
          <Download className="mr-2 h-4 w-4" />
          {t("gef_export_pdf")}
        </Button>
      </div>

      {/* Section 1: Resumo Geral */}
      <div>
        <h2 className="text-lg font-semibold mb-3">{t("gef_summary")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard title={t("gef_total_revenue")} value={fmt(s?.total_revenue)} icon={DollarSign} loading={isLoading} />
          <MetricCard title={t("gef_total_transactions")} value={s?.total_transactions ?? 0} icon={BarChart3} loading={isLoading} />
          <MetricCard title={t("gef_avg_ticket")} value={fmt(s?.avg_ticket)} icon={Receipt} loading={isLoading} />
          <MetricCard title={t("gef_total_cancellations")} value={cancellations.length} icon={XCircle} loading={isLoading} />
        </div>
      </div>

      {/* Section 2: Receita por Origem */}
      <div>
        <h2 className="text-lg font-semibold mb-3">{t("gef_revenue_by_origin")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard title={t("gef_revenue_orders")} value={fmt(s?.revenue_from_orders)} icon={Wallet} loading={isLoading} />
          <MetricCard title={t("gef_revenue_cash")} value={fmt(s?.revenue_from_cash)} icon={Banknote} loading={isLoading} />
        </div>
      </div>

      {/* Section 3: Receita por Forma de Pagamento */}
      <div>
        <h2 className="text-lg font-semibold mb-3">{t("gef_revenue_by_payment")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard title={t("gef_cash")} value={fmt(s?.total_cash)} icon={Banknote} loading={isLoading} />
          <MetricCard title="PIX" value={fmt(s?.total_pix)} icon={Smartphone} loading={isLoading} />
          <MetricCard title={t("gef_credit")} value={fmt(s?.total_credit)} icon={CreditCard} loading={isLoading} />
          <MetricCard title={t("gef_debit")} value={fmt(s?.total_debit)} icon={CreditCard} loading={isLoading} />
        </div>
      </div>

      {/* Section 4: Caixas do Evento */}
      <div>
        <h2 className="text-lg font-semibold mb-3">{t("gef_cash_registers")}</h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("gef_register_number")}</TableHead>
                  <TableHead>{t("gef_opened_at")}</TableHead>
                  <TableHead>{t("gef_closed_at")}</TableHead>
                  <TableHead className="text-right">{t("gef_opening_balance")}</TableHead>
                  <TableHead className="text-right">{t("gef_cash_sales")}</TableHead>
                  <TableHead className="text-right">{t("gef_withdrawals")}</TableHead>
                  <TableHead className="text-right">{t("gef_supplies")}</TableHead>
                  <TableHead className="text-right">{t("gef_returns")}</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : cashRegisters.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      {t("gef_no_registers")}
                    </TableCell>
                  </TableRow>
                ) : (
                  cashRegisters.map((cr: any) => (
                    <TableRow key={cr.register_id}>
                      <TableCell className="font-medium">#{cr.register_number}</TableCell>
                      <TableCell>{fmtDate(cr.opened_at)}</TableCell>
                      <TableCell>{fmtDate(cr.closed_at)}</TableCell>
                      <TableCell className="text-right">{fmt(cr.opening_balance)}</TableCell>
                      <TableCell className="text-right text-primary font-medium">{fmt(cr.total_cash_in)}</TableCell>
                      <TableCell className="text-right">{fmt(cr.total_cash_out)}</TableCell>
                      <TableCell className="text-right">{fmt(cr.total_supplies)}</TableCell>
                      <TableCell className="text-right">{fmt(cr.total_returns)}</TableCell>
                      <TableCell>
                        <Badge variant={cr.status === "open" ? "default" : "secondary"}>
                          {cr.status === "open" ? t("active") : t("completed")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Section 5: Cancelamentos */}
      <div>
        <h2 className="text-lg font-semibold mb-3">{t("gef_cancellations_section")}</h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("gef_order_number")}</TableHead>
                  <TableHead>{t("gef_origin")}</TableHead>
                  <TableHead className="text-right">{t("gef_value")}</TableHead>
                  <TableHead>{t("gef_reason")}</TableHead>
                  <TableHead>{t("gef_cancelled_at")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : cancellations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {t("gef_no_cancellations")}
                    </TableCell>
                  </TableRow>
                ) : (
                  cancellations.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">#{String(c.order_number).padStart(3, "0")}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {c.origin === "cashier" ? t("gef_origin_cashier") : t("gef_origin_app")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-destructive font-medium">{fmt(c.total)}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">{c.cancel_reason || "—"}</TableCell>
                      <TableCell>{fmtDate(c.cancelled_at)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
