import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock, CheckCircle2, XCircle, ChefHat, Package, Search, Inbox,
  Receipt, DollarSign, ChevronDown, QrCode, CreditCard, Smartphone,
  Banknote, ArrowDown,
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

type OrderRow = {
  id: string;
  order_number: number;
  status: string;
  total: number;
  created_at: string;
  event_id: string;
  event_name: string;
  payment_method: string | null;
  paid_at: string | null;
  preparing_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  items: { name: string; quantity: number; unit_price: number }[];
  has_qr: boolean;
};

const statusConfig: Record<string, { label: string; variant: "active" | "inactive" | "draft" | "completed" | "cancelled"; icon: React.ElementType }> = {
  pending:   { label: "Pendente",   variant: "draft",     icon: Clock },
  paid:      { label: "Confirmado", variant: "active",    icon: CheckCircle2 },
  preparing: { label: "Em Preparo", variant: "draft",     icon: ChefHat },
  ready:     { label: "Pronto",     variant: "completed", icon: Package },
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
  active: ["pending", "paid", "preparing", "ready"],
  done: ["delivered"],
  cancelled: ["cancelled"],
};

const paymentIcon: Record<string, React.ElementType> = {
  pix: Smartphone,
  credit: CreditCard,
  debit: CreditCard,
  cash: Banknote,
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
      .select("id, order_number, status, total, created_at, event_id, payment_method, paid_at, preparing_at, ready_at, delivered_at, cancelled_at, events!inner(name), order_items(name, quantity, unit_price)")
      .eq("consumer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) {
      const { data: qrData } = await supabase
        .from("qr_tokens")
        .select("order_id")
        .eq("status", "valid");
      const qrOrderIds = new Set((qrData || []).map((q: any) => q.order_id));

      setOrders(data.map((o: any) => ({
        id: o.id,
        order_number: o.order_number,
        status: o.status,
        total: o.total,
        created_at: o.created_at,
        event_id: o.event_id,
        event_name: o.events?.name || "",
        payment_method: o.payment_method,
        paid_at: o.paid_at,
        preparing_at: o.preparing_at,
        ready_at: o.ready_at,
        delivered_at: o.delivered_at,
        cancelled_at: o.cancelled_at,
        items: (o.order_items || []).map((i: any) => ({ name: i.name, quantity: i.quantity, unit_price: i.unit_price })),
        has_qr: qrOrderIds.has(o.id),
      })));
    }
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleRefresh = () => { setRefreshing(true); fetchOrders(); };

  const totalSpent = orders.filter(o => o.status !== "cancelled").reduce((s, o) => s + o.total, 0);

  const filtered = orders.filter((order) => {
    const matchFilter = activeFilter === "all" || filterMap[activeFilter]?.includes(order.status);
    const matchSearch = !search ||
      order.items.some((i) => i.name.toLowerCase().includes(search.toLowerCase())) ||
      String(order.order_number).includes(search);
    return matchFilter && matchSearch;
  });

  const isActiveQr = (order: OrderRow) =>
    order.has_qr && ["paid", "preparing", "ready"].includes(order.status);

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
            const timeStr = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
            const PayIcon = paymentIcon[order.payment_method || ""] || CreditCard;
            const itemsSummary = order.items.slice(0, 3).map(i => `${i.quantity}x ${i.name}`).join(", ");

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
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-primary">
                            #{String(order.order_number).padStart(3, "0")}
                          </span>
                          <StatusBadge status={st.variant} label={st.label} />
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
                  {order.payment_method && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <PayIcon className="h-3.5 w-3.5 text-muted-foreground/60" />
                      <span className="text-[11px] text-muted-foreground capitalize">{order.payment_method}</span>
                    </div>
                  )}
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
                      Ver QR Code
                    </Button>
                  </div>
                )}

                {/* Expanded details */}
                {expanded && (
                  <div className="border-t border-white/[0.04] p-4 space-y-4">
                    {/* Items */}
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Itens</span>
                      <div className="mt-2 space-y-1.5">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="text-foreground">{item.quantity}x {item.name}</span>
                            <span className="text-muted-foreground">R$ {(item.quantity * item.unit_price).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Timeline */}
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timeline</span>
                      <div className="mt-2 space-y-0">
                        {[
                          { label: "Criado", time: formatTime(order.created_at), done: true },
                          { label: "Pago", time: formatTime(order.paid_at), done: !!order.paid_at },
                          { label: "Em preparo", time: formatTime(order.preparing_at), done: !!order.preparing_at },
                          { label: "Pronto", time: formatTime(order.ready_at), done: !!order.ready_at },
                          { label: "Entregue", time: formatTime(order.delivered_at), done: !!order.delivered_at },
                          ...(order.cancelled_at ? [{ label: "Cancelado", time: formatTime(order.cancelled_at), done: true }] : []),
                        ].map((step, idx, arr) => (
                          <div key={idx} className="flex items-start gap-3">
                            <div className="flex flex-col items-center">
                              <div className={cn(
                                "h-2.5 w-2.5 rounded-full mt-1.5",
                                step.done
                                  ? step.label === "Cancelado" ? "bg-destructive" : "bg-primary"
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
