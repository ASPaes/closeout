import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { CaixaEventGuard } from "@/components/CaixaEventGuard";
import { useCaixa } from "@/contexts/CaixaContext";
import { useTranslation } from "@/i18n/use-translation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTION } from "@/config/audit-actions";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Lock, DollarSign, TrendingUp, TrendingDown, RotateCcw, Calculator, AlertTriangle } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const PAYMENT_LABELS: Record<string, string> = {
  cash: "caixa_cash",
  credit: "caixa_credit",
  debit: "caixa_debit",
  pix: "caixa_pix",
};

function useClosingMetrics(cashRegisterId: string | null) {
  return useQuery({
    queryKey: ["caixa-closing-metrics", cashRegisterId],
    enabled: !!cashRegisterId,
    queryFn: async () => {
      if (!cashRegisterId) throw new Error("No register");

      const [regRes, ordersRes, movOutRes, movInRes, returnsRes] = await Promise.all([
        supabase.from("cash_registers").select("opening_balance").eq("id", cashRegisterId).single(),
        supabase.from("cash_orders").select("total, payment_method").eq("cash_register_id", cashRegisterId).eq("status", "completed"),
        supabase.from("cash_movements").select("amount").eq("cash_register_id", cashRegisterId).eq("direction", "out"),
        supabase.from("cash_movements").select("amount").eq("cash_register_id", cashRegisterId).eq("direction", "in"),
        supabase.from("returns").select("refund_amount").eq("cash_register_id", cashRegisterId),
      ]);

      const openingBalance = Number(regRes.data?.opening_balance ?? 0);
      const orders = ordersRes.data ?? [];

      const byPayment: Record<string, { count: number; total: number }> = {};
      let totalSales = 0;
      for (const o of orders) {
        const pm = o.payment_method || "other";
        if (!byPayment[pm]) byPayment[pm] = { count: 0, total: 0 };
        byPayment[pm].count++;
        byPayment[pm].total += Number(o.total);
        totalSales += Number(o.total);
      }

      const totalWithdrawals = (movOutRes.data ?? []).reduce((s, m) => s + Number(m.amount), 0);
      const totalDeposits = (movInRes.data ?? []).reduce((s, m) => s + Number(m.amount), 0);
      const totalReturns = (returnsRes.data ?? []).reduce((s, r) => s + Number(r.refund_amount), 0);
      const expectedBalance = openingBalance + totalSales + totalDeposits - totalWithdrawals - totalReturns;

      return { openingBalance, totalSales, totalWithdrawals, totalDeposits, totalReturns, expectedBalance, byPayment };
    },
  });
}

export default function CaixaFechamento() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { cashRegisterId, refreshCashRegister } = useCaixa();
  const { data: metrics } = useClosingMetrics(cashRegisterId);
  const [physicalBalance, setPhysicalBalance] = useState("");
  const [notes, setNotes] = useState("");
  const [closing, setClosing] = useState(false);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const physicalValue = parseFloat(physicalBalance);
  const difference = !isNaN(physicalValue) && metrics ? physicalValue - metrics.expectedBalance : null;

  const handleClose = async () => {
    if (!cashRegisterId || isNaN(physicalValue)) return;
    setClosing(true);
    try {
      const { data, error } = await supabase.rpc("close_cash_register", {
        p_register_id: cashRegisterId,
        p_closing_balance: physicalValue,
      });

      if (error) throw error;

      await logAudit({
        action: AUDIT_ACTION.CASH_REGISTER_CLOSED,
        entityType: "cash_register",
        entityId: cashRegisterId,
        newData: { closing_balance: physicalValue, notes },
        metadata: typeof data === "object" && data !== null ? (data as Record<string, unknown>) : undefined,
      });

      if (notes.trim()) {
        await supabase.from("cash_registers").update({ notes }).eq("id", cashRegisterId);
      }

      toast.success(t("caixa_close_success"));
      refreshCashRegister();
      navigate("/caixa");
    } catch {
      toast.error(t("caixa_close_error"));
    } finally {
      setClosing(false);
    }
  };

  return (
    <CaixaEventGuard requireRegister>
      <PageHeader title={t("caixa_closing")} />

      {metrics && (
        <div className="space-y-6 mt-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <SummaryCard icon={DollarSign} label={t("caixa_initial_balance")} value={fmt(metrics.openingBalance)} />
            <SummaryCard icon={TrendingUp} label={t("caixa_total_sales")} value={fmt(metrics.totalSales)} color="text-green-500" />
            <SummaryCard icon={TrendingDown} label={t("caixa_total_withdrawals")} value={fmt(metrics.totalWithdrawals)} color="text-destructive" />
            <SummaryCard icon={TrendingUp} label={t("caixa_total_deposits")} value={fmt(metrics.totalDeposits)} color="text-blue-500" />
            <SummaryCard icon={RotateCcw} label={t("caixa_total_returns")} value={fmt(metrics.totalReturns)} color="text-orange-500" />
            <SummaryCard icon={Calculator} label={t("caixa_expected_balance")} value={fmt(metrics.expectedBalance)} />
          </div>

          {/* Payment method breakdown */}
          {Object.keys(metrics.byPayment).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("caixa_summary_by_payment")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(metrics.byPayment).map(([method, { count, total }]) => (
                    <div key={method} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {t((PAYMENT_LABELS[method] || "caixa_other") as any)} ({count})
                      </span>
                      <span className="font-medium">{fmt(total)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Physical balance input */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="physical-balance">{t("caixa_physical_balance")}</Label>
                <Input
                  id="physical-balance"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={t("caixa_physical_balance_placeholder")}
                  value={physicalBalance}
                  onChange={(e) => setPhysicalBalance(e.target.value)}
                />
              </div>

              {difference !== null && (
                <div className={`flex items-center gap-2 p-3 rounded-md ${difference === 0 ? "bg-green-500/10 text-green-500" : "bg-destructive/10 text-destructive"}`}>
                  {difference !== 0 && <AlertTriangle className="h-4 w-4" />}
                  <span className="text-sm font-medium">
                    {t("caixa_difference")}: {fmt(difference)}
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">{t("caixa_observations")}</Label>
                <Textarea
                  id="notes"
                  placeholder={t("caixa_observations_placeholder")}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    className="w-full"
                    variant="destructive"
                    disabled={!physicalBalance || isNaN(physicalValue)}
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    {t("caixa_close_register")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("caixa_close_register")}</AlertDialogTitle>
                    <AlertDialogDescription>{t("caixa_confirm_close_desc")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClose} disabled={closing}>
                      {closing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {t("confirm")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
      )}
    </CaixaEventGuard>
  );
}

function SummaryCard({ icon: Icon, label, value, color = "text-primary" }: { icon: any; label: string; value: string; color?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
