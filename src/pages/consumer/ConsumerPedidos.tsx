import { useState } from "react";
import { Clock, ChevronRight, CheckCircle2, XCircle, ChefHat, Package, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const mockOrders = [
  {
    id: "1",
    order_number: 42,
    status: "ready",
    total: 66.0,
    event: "Neon Nights",
    created_at: "22:15",
    items: ["2x Heineken 600ml", "1x Gin Tônica"],
  },
  {
    id: "2",
    order_number: 38,
    status: "delivered",
    total: 45.0,
    event: "Neon Nights",
    created_at: "21:40",
    items: ["1x Combo Casal — 2 Drinks"],
  },
  {
    id: "3",
    order_number: 27,
    status: "delivered",
    total: 30.0,
    event: "Neon Nights",
    created_at: "20:55",
    items: ["2x Tequila Shot"],
  },
  {
    id: "4",
    order_number: 15,
    status: "cancelled",
    total: 16.0,
    event: "Sunset Rooftop",
    created_at: "18:30",
    items: ["1x Red Bull"],
  },
];

const statusMap: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  paid: { label: "Confirmado", icon: CheckCircle2, color: "text-info", bg: "bg-info/10" },
  preparing: { label: "Em Preparo", icon: ChefHat, color: "text-warning", bg: "bg-warning/10" },
  ready: { label: "Pronto", icon: Package, color: "text-success", bg: "bg-success/10" },
  delivered: { label: "Entregue", icon: CheckCircle2, color: "text-muted-foreground", bg: "bg-white/[0.04]" },
  cancelled: { label: "Cancelado", icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
};

const filters = ["Todos", "Ativos", "Entregues", "Cancelados"];

const filterMap: Record<string, string[]> = {
  Todos: [],
  Ativos: ["paid", "preparing", "ready"],
  Entregues: ["delivered"],
  Cancelados: ["cancelled"],
};

export default function ConsumerPedidos() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("Todos");

  const filtered = mockOrders.filter((order) => {
    const matchFilter =
      activeFilter === "Todos" || filterMap[activeFilter]?.includes(order.status);
    const matchSearch =
      search === "" ||
      order.items.some((i) => i.toLowerCase().includes(search.toLowerCase())) ||
      String(order.order_number).includes(search);
    return matchFilter && matchSearch;
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Large title */}
      <div>
        <h1 className="text-[28px] font-extrabold text-foreground leading-tight tracking-tight">
          Pedidos
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {mockOrders.length} pedidos
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

      {/* Orders list — card container */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">Nenhum pedido encontrado</p>
          </div>
        ) : (
          filtered.map((order, idx) => {
            const st = statusMap[order.status] || statusMap.delivered;
            const StIcon = st.icon;
            return (
              <button
                key={order.id}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-4 text-left active:bg-white/[0.03] transition-colors",
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
                      {order.created_at} · {order.event}
                    </span>
                    <span className={cn("text-[11px] font-semibold", st.color)}>
                      {st.label}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/20 shrink-0" />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
