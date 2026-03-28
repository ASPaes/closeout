import { useState, useEffect } from "react";
import { Clock, ChevronRight, CheckCircle2, XCircle, ChefHat, Package, Search, Inbox } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  items: string[];
};

const statusMap: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  pending: { label: "Pendente", icon: Clock, color: "text-muted-foreground", bg: "bg-white/[0.04]" },
  paid: { label: "Confirmado", icon: CheckCircle2, color: "text-info", bg: "bg-info/10" },
  preparing: { label: "Em Preparo", icon: ChefHat, color: "text-warning", bg: "bg-warning/10" },
  ready: { label: "Pronto", icon: Package, color: "text-success", bg: "bg-success/10" },
  delivered: { label: "Entregue", icon: CheckCircle2, color: "text-muted-foreground", bg: "bg-white/[0.04]" },
  cancelled: { label: "Cancelado", icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
};

const filters = ["Todos", "Ativos", "Entregues", "Cancelados"];
const filterMap: Record<string, string[]> = {
  Todos: [],
  Ativos: ["pending", "paid", "preparing", "ready"],
  Entregues: ["delivered"],
  Cancelados: ["cancelled"],
};

export default function ConsumerPedidos() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { activeEvent } = useConsumer();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("Todos");

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const fetchOrders = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, status, total, created_at, event_id, events!inner(name), order_items(name, quantity)")
        .eq("consumer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (data) {
        setOrders(data.map((o: any) => ({
          id: o.id,
          order_number: o.order_number,
          status: o.status,
          total: o.total,
          created_at: o.created_at,
          event_id: o.event_id,
          event_name: o.events?.name || "",
          items: (o.order_items || []).map((i: any) => `${i.quantity}x ${i.name}`),
        })));
      }
      setLoading(false);
    };

    fetchOrders();
  }, [user]);

  const filtered = orders.filter((order) => {
    const matchFilter = activeFilter === "Todos" || filterMap[activeFilter]?.includes(order.status);
    const matchSearch = !search ||
      order.items.some((i) => i.toLowerCase().includes(search.toLowerCase())) ||
      String(order.order_number).includes(search);
    return matchFilter && matchSearch;
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Title */}
      <div>
        <h1 className="text-[28px] font-extrabold text-foreground leading-tight tracking-tight">
          {t("consumer_orders_title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {orders.length} {orders.length === 1 ? "pedido" : "pedidos"}
        </p>
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
            key={f}
            onClick={() => setActiveFilter(f)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-all active:scale-95",
              activeFilter === f
                ? "bg-primary text-primary-foreground shadow-[0_0_16px_hsl(24,100%,50%,0.25)]"
                : "bg-white/[0.06] border border-white/[0.08] text-muted-foreground"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {/* Orders list */}
      {!loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center gap-3">
              <Inbox className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Nenhum pedido encontrado</p>
            </div>
          ) : (
            filtered.map((order, idx) => {
              const st = statusMap[order.status] || statusMap.delivered;
              const StIcon = st.icon;
              const time = new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
              return (
                <div
                  key={order.id}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-4 text-left",
                    idx > 0 && "border-t border-white/[0.04]"
                  )}
                >
                  <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl shrink-0", st.bg)}>
                    <StIcon className={cn("h-5 w-5", st.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[15px] font-semibold text-foreground">
                        #{String(order.order_number).padStart(3, "0")}
                      </span>
                      <span className="text-[15px] font-bold text-foreground">
                        R$ {order.total.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {order.items.join(" · ")}
                    </p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {time} · {order.event_name}
                      </span>
                      <span className={cn("text-[11px] font-semibold", st.color)}>
                        {st.label}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/20 shrink-0" />
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
