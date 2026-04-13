import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock, CheckCircle2, XCircle, ChefHat, Package, Search, Inbox,
  Receipt, DollarSign, ChevronDown, QrCode, CreditCard, Smartphone,
  Banknote, ArrowDown, Split, Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { useConsumer } from "@/contexts/ConsumerContext";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

type PaymentRow = {
  payment_method: string;
  amount: number;
  status: string;
};

type OrderRow = {
  id: string;
  order_number: number;
  status: string;
  total: number;
  created_at: string;
  event_id: string;
  event_name: string;
  payment_method: string | null;
  is_split_payment: boolean;
  paid_at: string | null;
  preparing_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  items: { name: string; quantity: number; unit_price: number; delivered_quantity?: number }[];
  has_qr: boolean;
  payments: PaymentRow[];
};

const statusConfig: Record<string, { label: string; variant: "active" | "inactive" | "draft" | "completed" | "cancelled"; icon: React.ElementType }> = {
  processing_payment: { label: "Processando", variant: "draft", icon: Loader2 },
  partially_paid: { label: "Aguardando Dinheiro", variant: "draft", icon: Clock },
  pending:   { label: "Pendente",   variant: "draft",     icon: Clock },
  paid:      { label: "Confirmado", variant: "active",    icon: CheckCircle2 },
  preparing: { label: "Em Preparo", variant: "draft",     icon: ChefHat },
  ready:     { label: "Pronto",     variant: "completed", icon: Package },
  partially_delivered: { label: "Entrega Parcial", variant: "draft", icon: Package },
  delivered: { label: "Entregue",   variant: "inactive",  icon: CheckCircle2 },
  cancelled: { label: "Cancelado",  variant: "cancelled", icon: XCircle },
};

const filters = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Ativos" },
  { key: "done", label: "Concluídos" },
  { key: "cancelled", label: "Cancelados" },
];
const filterMap: Record<string, string[]> = {
  all: [],
  active: ["processing_payment", "partially_paid", "pending", "paid", "preparing", "ready", "partially_delivered"],
  done: ["delivered"],
  cancelled: ["cancelled"],
};

const paymentIcon: Record<string, React.ElementType> = {
  pix: Smartphone,
  credit_card: CreditCard,
  debit_card: CreditCard,
  cash: Banknote,
};

const METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  credit_card: "Crédito",
  debit_card: "Débito",
  cash: "Dinheiro",
  split: "Dividido",
};

function formatTime(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function ConsumerPedidos() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { activeOrder } = useConsumer();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("orders")
      .select("id, order_number, status, total, created_at, event_id, payment_method, is_split_payment, paid_at, preparing_at, ready_at, delivered_at, cancelled_at, events!inner(name), order_items(name, quantity, unit_price, delivered_quantity)")
      .eq("consumer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) {
      const orderIds = data.map((o: any) => o.id);

      // Fetch QR tokens and payments in parallel
      const [qrResult, paymentsResult] = await Promise.all([
        supabase.from("qr_tokens").select("order_id").eq("status", "valid"),
        supabase.from("payments").select("order_id, payment_method, amount, status").in("order_id", orderIds),
      ]);

      const qrOrderIds = new Set((qrResult.data || []).map((q: any) => q.order_id));
      const paymentsByOrder: Record<string, PaymentRow[]> = {};
      (paymentsResult.data || []).forEach((p: any) => {
        if (!paymentsByOrder[p.order_id]) paymentsByOrder[p.order_id] = [];
        paymentsByOrder[p.order_id].push({
          payment_method: p.payment_method,
          amount: p.amount,
          status: p.status,
        });
      });

      setOrders(data.map((o: any) => ({
        id: o.id,
        order_number: o.order_number,
        status: o.status,
        total: o.total,
        created_at: o.created_at,
        event_id: o.event_id,
        event_name: o.events?.name || "",
        payment_method: o.payment_method,
        is_split_payment: o.is_split_payment || false,
        paid_at: o.paid_at,
        preparing_at: o.preparing_at,
        ready_at: o.ready_at,
        delivered_at: o.delivered_at,
        cancelled_at: o.cancelled_at,
        items: (o.order_items || []).map((i: any) => ({ name: i.name, quantity: i.quantity, unit_price: i.unit_price, delivered_quantity: i.delivered_quantity || 0 })),
        has_qr: qrOrderIds.has(o.id),
        payments: paymentsByOrder[o.id] || [],
      })));
    }
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleRefresh = () => { setRefreshing(true); fetchOrders(); };

  const totalSpent = orders.filter(o => o.status !== "cancelled").reduce((s, o) => s + o.total, 0);

  const statusPriority: Record<string, number> = {
    ready: 0,
    partially_delivered: 1,
    preparing: 2,
    paid: 3,
    partially_paid: 4,
    processing_payment: 5,
    pending: 6,
    delivered: 7,
    cancelled: 8,
  };

  const filtered = orders
    .filter((order) => {
      const matchFilter = activeFilter === "all" || filterMap[activeFilter]?.includes(order.status);
      const matchSearch = !search ||
        order.items.some((i) => i.name.toLowerCase().includes(search.toLowerCase())) ||
        String(order.order_number).includes(search);
      return matchFilter && matchSearch;
    })
    .sort((a, b) => (statusPriority[a.status] ?? 99) - (statusPriority[b.status] ?? 99));

  const isActiveQr = (order: OrderRow) =>
    order.has_qr && ["partially_paid", "paid", "preparing", "ready", "partially_delivered"].includes(order.status);

  return (
    <div className="flex flex-col gap-5 pb-20">
      {/* Title */}
      <h1 className="text-[28px] font-extrabold text-foreground leading-tight tracking-tight">
        {t("consumer_orders_title")}
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Receipt className="h-4 w-4" />
            <span className="text-xs font-medium">Total Pedidos</span>
          </div>
          <span className="text-2xl font-bold text-foreground">{orders.length}</span>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs font-medium">Total Gasto</span>
          </div>
          <span className="text-2xl font-bold text-primary">R$ {totalSpent.toFixed(2)}</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar pedido..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-12 rounded-2xl border-white/[0.08] bg-white/[0.04] pl-11 text-base placeholder:text-muted-foreground/60 focus-visible:ring-primary/30"
        />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-all active:scale-95",
              activeFilter === f.key
                ? "bg-primary text-primary-foreground shadow-[0_0_16px_hsl(24,100%,50%,0.25)]"
                : "bg-white/[0.06] border border-white/[0.08] text-muted-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Pull to refresh */}
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground active:scale-95 transition-transform"
      >
        <ArrowDown className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
        {refreshing ? "Atualizando..." : "Puxar para atualizar"}
      </button>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {/* Orders list */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.04]">
            <Inbox className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">Nenhum pedido encontrado</p>
            <p className="text-sm text-muted-foreground mt-1">Seus pedidos aparecerão aqui</p>
          </div>
          <Button
            variant="outline"
            className="rounded-xl border-white/[0.08]"
            onClick={() => navigate("/app")}
          >
            Explorar eventos
          </Button>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="flex flex-col gap-3">
          {filtered.map((order) => {
            const st = statusConfig[order.status] || statusConfig.delivered;
            const StIcon = st.icon;
            const expanded = expandedId === order.id;
            const date = new Date(order.created_at);
            const dateStr = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
            const itemsSummary = order.items.slice(0, 3).map(i => `${i.quantity}x ${i.name}`).join(", ");

            // Payment method display
            const paymentDisplay = order.payments.length > 1
              ? order.payments.map(p => `${METHOD_LABELS[p.payment_method] || p.payment_method} R$${Number(p.amount).toFixed(2)}`).join(" + ")
              : METHOD_LABELS[order.payment_method || ""] || order.payment_method || "";

            const PayIcon = order.is_split_payment
              ? Split
              : paymentIcon[order.payment_method || ""] || CreditCard;

            return (
              <div
                key={order.id}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
              >
                {/* Main card */}
                <button
                  onClick={() => setExpandedId(expanded ? null : order.id)}
                  className="w-full text-left p-4 active:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] shrink-0">
                        <StIcon className={cn("h-5 w-5", st.variant === "active" ? "text-success" : st.variant === "draft" ? "text-warning" : st.variant === "completed" ? "text-info" : st.variant === "cancelled" ? "text-destructive" : "text-muted-foreground")} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-bold text-primary">
                            #{String(order.order_number).padStart(3, "0")}
                          </span>
                          <StatusBadge status={st.variant} label={st.label} />
                          {order.is_split_payment && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                              <Split className="h-3 w-3" />
                              Dividido
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {order.event_name} · {dateStr}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-base font-bold text-foreground">
                        R$ {order.total.toFixed(2)}
                      </span>
                      <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
                    </div>
                  </div>

                  {/* Items summary */}
                  <p className="text-xs text-muted-foreground mt-2 truncate">
                    {itemsSummary}{order.items.length > 3 ? ` +${order.items.length - 3}` : ""}
                  </p>

                  {/* Payment method */}
                  <div className="flex items-center gap-1.5 mt-2">
                    <PayIcon className="h-3.5 w-3.5 text-muted-foreground/60" />
                    <span className="text-[11px] text-muted-foreground">{paymentDisplay}</span>
                  </div>
                </button>

                {/* QR button */}
                {isActiveQr(order) && (
                  <div className="px-4 pb-3">
                    <Button
                      size="sm"
                      className="w-full h-10 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                      onClick={() => navigate(`/app/qr?order=${order.id}`)}
                    >
                      <QrCode className="h-4 w-4 mr-2" />
                      {order.status === "partially_paid" ? "Ver QR Code — pagar dinheiro" : "Ver QR Code"}
                    </Button>
                  </div>
                )}

                {/* Expanded details */}
                {expanded && (
                  <div className="border-t border-white/[0.04] p-4 space-y-4">
                    {/* Items */}
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Itens</span>
                      <div className="mt-2 space-y-2">
                        {order.items.map((item, idx) => {
                          const del = item.delivered_quantity || 0;
                          const isItemComplete = del >= item.quantity;
                          const isPartialItem = del > 0 && del < item.quantity;
                          return (
                            <div key={idx} className={cn("flex flex-col gap-1", isItemComplete && "opacity-60")}>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-foreground flex items-center gap-1.5">
                                  {isItemComplete && <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />}
                                  {item.quantity}x {item.name}
                                </span>
                                <span className="text-muted-foreground">R$ {(item.quantity * item.unit_price).toFixed(2)}</span>
                              </div>
                              {(isPartialItem || isItemComplete) && (
                                <span className={cn("text-[11px] font-medium", isItemComplete ? "text-success" : "text-warning")}>
                                  {isItemComplete ? "✓ Retirado" : `${del} de ${item.quantity} retirados`}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Payment details (for split) */}
                    {order.payments.length > 1 && (
                      <div>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pagamentos</span>
                        <div className="mt-2 space-y-1.5">
                          {order.payments.map((p, idx) => {
                            const PIcon = paymentIcon[p.payment_method] || CreditCard;
                            const isApproved = p.status === "approved";
                            return (
                              <div key={idx} className="flex items-center gap-2">
                                <PIcon className={cn("h-3.5 w-3.5", isApproved ? "text-success" : "text-amber-400")} />
                                <span className={cn("text-xs font-medium", isApproved ? "text-success" : "text-amber-300")}>
                                  {isApproved ? "✓ " : "⏳ "}
                                  {METHOD_LABELS[p.payment_method] || p.payment_method}: R$ {Number(p.amount).toFixed(2)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Timeline */}
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timeline</span>
                      <div className="mt-2 space-y-0">
                        {[
                          { label: "Criado", time: formatTime(order.created_at), done: true },
                          ...(order.status === "partially_paid" ? [{ label: "Aguardando Dinheiro", time: null as string | null, done: true }] : []),
                          { label: "Pago", time: formatTime(order.paid_at), done: !!order.paid_at },
                          { label: "Em preparo", time: formatTime(order.preparing_at), done: !!order.preparing_at },
                          { label: "Pronto", time: formatTime(order.ready_at), done: !!order.ready_at },
                          ...(order.status === "partially_delivered" ? [{ label: "Entrega Parcial", time: null as string | null, done: true }] : []),
                          { label: "Entregue", time: formatTime(order.delivered_at), done: !!order.delivered_at },
                          ...(order.cancelled_at ? [{ label: "Cancelado", time: formatTime(order.cancelled_at), done: true }] : []),
                        ].map((step, idx, arr) => (
                          <div key={idx} className="flex items-start gap-3">
                            <div className="flex flex-col items-center">
                              <div className={cn(
                                "h-2.5 w-2.5 rounded-full mt-1.5",
                                step.done
                                  ? step.label === "Cancelado" ? "bg-destructive"
                                    : step.label === "Aguardando Dinheiro" ? "bg-amber-500"
                                    : "bg-primary"
                                  : "bg-white/[0.1]"
                              )} />
                              {idx < arr.length - 1 && (
                                <div className={cn("w-px h-5", step.done ? "bg-primary/30" : "bg-white/[0.06]")} />
                              )}
                            </div>
                            <div className="flex items-center gap-2 pb-1">
                              <span className={cn("text-xs", step.done ? "text-foreground font-medium" : "text-muted-foreground/50")}>{step.label}</span>
                              {step.time && <span className="text-[11px] text-muted-foreground">{step.time}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
