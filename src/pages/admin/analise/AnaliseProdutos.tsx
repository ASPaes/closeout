import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { AdminPeriodFilter } from "@/components/AdminPeriodFilter";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Package, DollarSign, Hash, TrendingUp, HelpCircle, Boxes } from "lucide-react";

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n ?? 0);
const formatInt = (n: number) =>
  new Intl.NumberFormat("pt-BR").format(n ?? 0);
const formatPct = (n: number) =>
  `${((n ?? 0) * 100).toFixed(1)}%`;

const typeLabels: Record<string, string> = { product: "Produto", combo: "Combo" };

interface KpiCardProps {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tooltip: string;
}

function KpiCard({ title, value, icon: Icon, tooltip }: KpiCardProps) {
  return (
    <Card className="hover:border-primary/20 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-sm font-medium text-muted-foreground truncate">
                {title}
              </CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground/60 hover:text-muted-foreground shrink-0">
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-sm">{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          <div className="rounded-full bg-primary/10 p-2 shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-foreground truncate">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function AnaliseProdutos() {
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return { start, end };
  });
  const [clientId, setClientId] = useState<string | null>(null);
  const [data, setData] = useState<any | null>(null);
  const [clientsList, setClientsList] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("clients").select("id, name").eq("status", "active").order("name")
      .then(({ data }) => { if (data) setClientsList(data); });
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { start, end } = dateRange;
    const { data: rpcData, error: rpcError } = await supabase.rpc("get_products_analytics" as any, {
      p_start_date: start.toISOString(),
      p_end_date: end.toISOString(),
      p_client_id: clientId,
    } as any);
    if (rpcError) { setError(rpcError.message); setLoading(false); return; }
    setData(rpcData);
    setError(null);
    setLoading(false);
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [dateRange, clientId]);

  const kpis = data?.kpis ?? {};
  const topProducts: any[] = data?.top_products ?? [];
  const topCategories: any[] = data?.top_categories ?? [];
  const productVsCombo: any[] = data?.product_vs_combo ?? [];
  const maxCategoryGmv = Math.max(1, ...topCategories.map((c) => c.gmv ?? 0));

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Produtos & Vendas</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Análise de itens vendidos através da plataforma
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <AdminPeriodFilter onRangeChange={(start, end) => setDateRange({ start, end })} />

            <Select
              value={clientId ?? "all"}
              onValueChange={(v) => setClientId(v === "all" ? null : v)}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {clientsList.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4 flex items-center justify-between gap-4">
            <p className="text-sm text-destructive">{error}</p>
            <button
              type="button"
              onClick={fetchData}
              className="text-sm font-medium text-destructive hover:underline shrink-0"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* KPIs */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {loading || !data ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[108px] rounded-lg" />
            ))
          ) : (
            <>
              <KpiCard title="Itens Vendidos" value={formatInt(kpis.total_items_vendidos)} icon={Package}
                tooltip="Soma das quantidades de todos os itens de pedidos pagos no período (SUM de quantity). Conta unidades, não pedidos." />
              <KpiCard title="GMV de Itens" value={formatBRL(kpis.gmv_itens)} icon={DollarSign}
                tooltip="Soma do valor total dos itens vendidos (SUM de order_items.total). Pode diferir do GMV geral por incluir descontos/ajustes." />
              <KpiCard title="Itens Distintos" value={formatInt(kpis.produtos_distintos)} icon={Hash}
                tooltip="Quantidade de produtos ou combos únicos que apareceram em pedidos pagos no período." />
              <KpiCard title="Preço Médio" value={formatBRL(kpis.ticket_medio_item)} icon={TrendingUp}
                tooltip="Preço unitário médio dos itens vendidos (AVG de unit_price). Não pondera por quantidade." />
            </>
          )}
        </div>

        {/* GRID 2 COLUNAS: Top Itens + Top Categorias */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {/* TOP ITENS */}
          <Card className="hover:border-primary/20 transition-colors">
            <CardHeader>
              <CardTitle>Top Itens</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Por volume transacionado no período
              </p>
            </CardHeader>
            <CardContent>
              {loading || !data ? (
                <Skeleton className="h-[400px] w-full" />
              ) : topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Sem itens vendidos no período
                </p>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                  {topProducts.map((item, idx) => (
                    <div
                      key={`${item.item_type}-${item.item_id}`}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/20 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-foreground truncate">{item.item_name}</p>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {typeLabels[item.item_type] ?? item.item_type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {formatInt(item.units_sold)} un · {formatInt(item.orders_count)} pedido(s) · {formatBRL(item.avg_unit_price)}/un
                        </p>
                      </div>
                      <p className="font-bold text-foreground shrink-0">{formatBRL(item.gmv)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* TOP CATEGORIAS */}
          <Card className="hover:border-primary/20 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Boxes className="h-5 w-5 text-primary" />
                <CardTitle>Top Categorias</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Categorias com maior volume — apenas produtos (combos não têm categoria)
              </p>
            </CardHeader>
            <CardContent>
              {loading || !data ? (
                <Skeleton className="h-[400px] w-full" />
              ) : topCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Sem categorias no período
                </p>
              ) : (
                <div className="space-y-4">
                  {topCategories.map((cat) => {
                    const pct = maxCategoryGmv > 0 ? (cat.gmv ?? 0) / maxCategoryGmv : 0;
                    return (
                      <div key={cat.category_id ?? cat.category_name ?? "no-cat"}>
                        <div className="flex items-center justify-between gap-2 mb-1.5 text-sm">
                          <span className="font-medium text-foreground truncate">
                            {cat.category_name ?? "Sem categoria"}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatBRL(cat.gmv)} · {formatInt(cat.units_sold)} un · {formatInt(cat.products_count)} prod.
                          </span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${pct * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* PRODUTO VS COMBO */}
        <Card className="hover:border-primary/20 transition-colors">
          <CardHeader>
            <CardTitle>Produto vs Combo</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Distribuição do GMV entre produtos avulsos e combos
            </p>
          </CardHeader>
          <CardContent>
            {loading || !data ? (
              <Skeleton className="h-32 w-full" />
            ) : productVsCombo.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Sem dados no período
              </p>
            ) : (
              <div className="space-y-4">
                {productVsCombo.map((pc) => (
                  <div key={pc.type}>
                    <div className="flex items-center justify-between gap-2 mb-1.5 text-sm">
                      <span className="font-medium text-foreground">
                        {typeLabels[pc.type] ?? pc.type}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatBRL(pc.gmv)} · {formatInt(pc.units)} un · {formatPct(pc.pct_gmv)}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${(pc.pct_gmv ?? 0) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
