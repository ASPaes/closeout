import { Clock, ChevronRight, CheckCircle2, XCircle, ChefHat, Package } from "lucide-react";
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
  delivered: { label: "Entregue", icon: CheckCircle2, color: "text-muted-foreground", bg: "bg-secondary" },
  cancelled: { label: "Cancelado", icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
};

export default function ConsumerPedidos() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Meus Pedidos</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{mockOrders.length} pedidos</p>
      </div>

      <div className="flex flex-col gap-3">
        {mockOrders.map((order) => {
          const st = statusMap[order.status] || statusMap.delivered;
          const StIcon = st.icon;
          return (
            <button
              key={order.id}
              className="flex w-full items-start gap-3 rounded-xl border border-border/60 bg-card p-3.5 text-left active:scale-[0.98] transition-all"
            >
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl shrink-0", st.bg)}>
                <StIcon className={cn("h-5 w-5", st.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-foreground">
                    #{String(order.order_number).padStart(3, "0")}
                  </span>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", st.bg, st.color)}>
                    {st.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {order.items.join(" · ")}
                </p>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {order.created_at} · {order.event}
                  </span>
                  <span className="text-sm font-bold text-foreground">
                    R$ {order.total.toFixed(2)}
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-3" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
