import { PageHeader } from "@/components/PageHeader";
import { CaixaEventGuard } from "@/components/CaixaEventGuard";
import { useCaixa } from "@/contexts/CaixaContext";
import { useTranslation } from "@/i18n/use-translation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, TrendingUp, TrendingDown, ArrowDownCircle, Calculator, ShoppingCart } from "lucide-react";

type DashboardMetrics = {
  openingBalance: number;
  totalSales: number;
  salesCount: number;
  totalWithdrawals: number;
  totalDeposits: number;
};

function useDashboardMetrics(cashRegisterId: string | null) {
  return useQuery({
    queryKey: ["caixa-dashboard-metrics", cashRegisterId],
    enabled: !!cashRegisterId,
    refetchInterval: 15000,
    queryFn: async (): Promise<DashboardMetrics> => {
      if (!cashRegisterId) throw new Error("No register");

      const [regRes, ordersRes, movOutRes, movInRes] = await Promise.all([
        supabase.from("cash_registers").select("opening_balance").eq("id", cashRegisterId).single(),
        supabase.from("cash_orders").select("total").eq("cash_register_id", cashRegisterId).eq("status", "completed"),
        supabase.from("cash_movements").select("amount").eq("cash_register_id", cashRegisterId).eq("direction", "out"),
        supabase.from("cash_movements").select("amount").eq("cash_register_id", cashRegisterId).eq("direction", "in"),
      ]);

      const openingBalance = regRes.data?.opening_balance ?? 0;
      const orders = ordersRes.data ?? [];
      const totalSales = orders.reduce((s, o) => s + Number(o.total), 0);
      const totalWithdrawals = (movOutRes.data ?? []).reduce((s, m) => s + Number(m.amount), 0);
      const totalDeposits = (movInRes.data ?? []).reduce((s, m) => s + Number(m.amount), 0);

      return {
        openingBalance: Number(openingBalance),
        totalSales,
        salesCount: orders.length,
        totalWithdrawals,
        totalDeposits,
      };
    },
  });
}

function MetricCard({ title, value, icon: Icon, color = "text-primary" }: { title: string; value: string; icon: any; color?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function DashboardContent() {
  const { cashRegisterId, registerNumber } = useCaixa();
  const { t } = useTranslation();
  const { data: metrics } = useDashboardMetrics(cashRegisterId);

  if (!metrics) return null;

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const estimatedBalance =
    metrics.openingBalance + metrics.totalSales + metrics.totalDeposits - metrics.totalWithdrawals;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
      <MetricCard title={t("caixa_initial_balance")} value={fmt(metrics.openingBalance)} icon={DollarSign} />
      <MetricCard title={t("caixa_total_sales")} value={fmt(metrics.totalSales)} icon={TrendingUp} color="text-green-500" />
      <MetricCard title={t("caixa_total_withdrawals")} value={fmt(metrics.totalWithdrawals)} icon={TrendingDown} color="text-destructive" />
      <MetricCard title={t("caixa_total_deposits")} value={fmt(metrics.totalDeposits)} icon={ArrowDownCircle} color="text-blue-500" />
      <MetricCard title={t("caixa_estimated_balance")} value={fmt(estimatedBalance)} icon={Calculator} />
      <MetricCard
        title={t("caixa_sales_count")}
        value={`${metrics.salesCount} ${t("caixa_sales")}`}
        icon={ShoppingCart}
      />
    </div>
  );
}

export default function CaixaDashboard() {
  const { t } = useTranslation();
  const { cashRegisterId, registerNumber } = useCaixa();

  return (
    <CaixaEventGuard>
      {!cashRegisterId ? (
        <CaixaEventGuard requireRegister>
          <div />
        </CaixaEventGuard>
      ) : (
        <>
          <PageHeader title={`${t("caixa_dashboard")} — ${t("gcx_col_register_number")} #${registerNumber ?? "?"}`} />
          <DashboardContent />
        </>
      )}
    </CaixaEventGuard>
  );
}
