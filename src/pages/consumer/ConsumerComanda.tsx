import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Receipt, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useConsumer } from "@/contexts/ConsumerContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type OrderItem = {
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
  delivered_quantity?: number;
};

type ComandaOrder = {
  order_id: string;
  order_number: number | string;
  status: string;
  table_number: number | null;
  is_external_area: boolean;
  created_at: string;
  items: OrderItem[];
};

type ComandaDetail = {
  comanda_id: string;
  card_number: string;
  status: string;
  consumer_name: string | null;
  consumer_cpf: string | null;
  consumer_phone: string | null;
  opened_at: string | null;
  paid_at: string | null;
  paid_method: string | null;
  paid_via: string | null;
  total: number;
  orders: ComandaOrder[];
};

const STATUS_LABEL: Record<string, string> = {
  preparing: "Preparando",
  ready: "Pronto",
  partially_delivered: "Entrega parcial",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

function statusBadgeClass(status: string): string {
  switch (status) {
    case "preparing":
      return "bg-yellow-500/15 text-yellow-300 border-yellow-500/30";
    case "ready":
      return "bg-primary/15 text-primary border-primary/30";
    case "partially_delivered":
      return "bg-blue-500/15 text-blue-300 border-blue-500/30";
    case "delivered":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "cancelled":
      return "bg-white/[0.04] text-muted-foreground border-white/10";
    default:
      return "bg-white/[0.06] text-muted-foreground border-white/10";
  }
}

export default function ConsumerComanda() {
  const navigate = useNavigate();
  const { activeComanda } = useConsumer();
  const [detail, setDetail] = useState<ComandaDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDetail = useCallback(async () => {
    if (!activeComanda) {
      setDetail(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc("get_comanda_detail", {
      p_comanda_id: activeComanda.id,
    });
    if (!error && data) setDetail(data as unknown as ComandaDetail);
    setLoading(false);
  }, [activeComanda]);

  useEffect(() => {
    setLoading(true);
    fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    if (!activeComanda) return;
    const channel = supabase
      .channel(`comanda-orders-${activeComanda.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `comanda_id=eq.${activeComanda.id}`,
        },
        () => {
          fetchDetail();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeComanda, fetchDetail]);

  if (!activeComanda) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-5">
        <div className="h-20 w-20 rounded-full bg-white/[0.04] flex items-center justify-center">
          <Receipt className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-foreground">Você ainda não tem uma comanda aberta</h2>
          <p className="text-sm text-muted-foreground">Volte ao cardápio para abrir uma comanda</p>
        </div>
        <Button
          onClick={() => navigate("/app/cardapio")}
          variant="outline"
          className="rounded-xl h-12"
        >
          Voltar ao cardápio
        </Button>
      </div>
    );
  }

  const isPaid = detail?.status === "paid";

  return (
    <div className="flex flex-col gap-5 pb-28">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08] active:scale-95 transition-transform"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold text-foreground">Minha Comanda</h1>
        </div>
      </div>

      {loading && !detail ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Highlight card */}
          <div
            className="rounded-2xl border border-primary/20 p-5"
            style={{
              background:
                "linear-gradient(135deg, hsl(24 100% 50% / 0.12), hsl(24 100% 50% / 0.03))",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Comanda
                </p>
                <p className="text-2xl font-extrabold text-foreground leading-tight">
                  #{detail?.card_number ?? activeComanda.card_number}
                </p>
                {detail?.consumer_name && (
                  <p className="text-sm text-muted-foreground mt-1 truncate">
                    {detail.consumer_name}
                  </p>
                )}
              </div>
              {isPaid && (
                <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Comanda paga
                </Badge>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-white/10 flex items-end justify-between">
              <span className="text-sm text-muted-foreground">Total acumulado</span>
              <span className="text-3xl font-extrabold text-primary leading-none">
                R$ {(detail?.total ?? 0).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Orders */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
              Pedidos
            </h2>
            {(!detail?.orders || detail.orders.length === 0) && (
              <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Nenhum pedido lançado ainda
                </p>
              </div>
            )}
            {detail?.orders?.map((order) => {
              const cancelled = order.status === "cancelled";
              return (
                <div
                  key={order.order_id}
                  className={cn(
                    "rounded-xl bg-white/[0.04] border border-white/[0.06] p-4 flex flex-col gap-3",
                    cancelled && "opacity-50",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground">
                        Pedido #{order.order_number}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {order.is_external_area
                          ? "Área externa"
                          : order.table_number
                            ? `Mesa ${order.table_number}`
                            : "—"}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn("shrink-0", statusBadgeClass(order.status))}
                    >
                      {STATUS_LABEL[order.status] ?? order.status}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-1.5 pt-2 border-t border-white/[0.06]">
                    {order.items?.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-foreground truncate pr-3">
                          {item.quantity}× {item.name}
                        </span>
                        <span className="text-muted-foreground shrink-0">
                          R$ {Number(item.total ?? 0).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Finalize button */}
          {!isPaid && (
            <div
              className="fixed left-0 right-0 px-5 z-30"
              style={{
                bottom: "calc(76px + env(safe-area-inset-bottom, 0px))",
              }}
            >
              <div className="max-w-[480px] mx-auto">
                <Button
                  onClick={() => navigate("/app/comanda/finalizar")}
                  className="h-14 w-full rounded-2xl text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground active:scale-[0.98] transition-transform"
                  style={{ boxShadow: "0 8px 32px hsl(24 100% 50% / 0.35)" }}
                >
                  Finalizar comanda
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}