import { useState, useEffect, useCallback } from "react";
import { useWaiter } from "@/contexts/WaiterContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { WaiterSessionGuard } from "@/components/WaiterSessionGuard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Truck, CheckCircle, Loader2 } from "lucide-react";

interface DeliveryOrder {
  id: string;
  order_number: number;
  status: string;
  total: number;
  table_number: number | null;
  is_external_area: boolean;
  customer_name: string | null;
  ready_at: string | null;
  created_at: string;
  consumer_id: string | null;
  order_items: { id: string; name: string; quantity: number; delivered_quantity: number }[];
}

export default function WaiterEntregas() {
  const { eventId } = useWaiter();
  const { user } = useAuth();
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [consumerNames, setConsumerNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [delivering, setDelivering] = useState<Set<string>>(new Set());

  const fetchOrders = useCallback(async () => {
    if (!eventId) return;
    const { data } = await supabase
      .from("orders")
      .select(
        "id, order_number, status, total, table_number, is_external_area, customer_name, ready_at, created_at, consumer_id, order_items(id, name, quantity, delivered_quantity)",
      )
      .eq("event_id", eventId)
      .in("status", ["ready", "partially_delivered"])
      .order("ready_at", { ascending: true, nullsFirst: false });

    const list = (data as unknown as DeliveryOrder[]) || [];
    setOrders(list);

    const consumerIds = Array.from(
      new Set(list.map((o) => o.consumer_id).filter((id): id is string => !!id)),
    );
    if (consumerIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", consumerIds);
      const map: Record<string, string> = {};
      (profiles || []).forEach((p: any) => {
        if (p?.name) map[p.id] = p.name;
      });
      setConsumerNames(map);
    } else {
      setConsumerNames({});
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel("waiter-entregas-" + eventId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `event_id=eq.${eventId}` },
        () => fetchOrders(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, fetchOrders]);

  const handleDeliver = async (orderId: string) => {
    if (!user) return;
    setDelivering((prev) => new Set(prev).add(orderId));
    const { data, error } = await supabase.rpc("mark_order_delivered", {
      p_order_id: orderId,
      p_staff_id: user.id,
      p_station_id: null,
    });
    setDelivering((prev) => {
      const next = new Set(prev);
      next.delete(orderId);
      return next;
    });
    if (error || !(data as any)?.ok) {
      toast.error((data as any)?.message || error?.message || "Erro ao entregar");
      return;
    }
    toast.success("Pedido entregue");
    fetchOrders();
  };

  return (
    <WaiterSessionGuard>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Entregas</h1>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <Truck className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhum pedido pronto</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const consumerName = (order.consumer_id && consumerNames[order.consumer_id]) || order.customer_name;
              return (
                <Card key={order.id} className="p-4 rounded-2xl border border-white/10 bg-card space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col">
                      {order.is_external_area ? (
                        <Badge className="bg-blue-600 text-white border-0 w-fit text-sm font-bold">
                          Área externa
                        </Badge>
                      ) : order.table_number ? (
                        <span className="text-3xl font-bold text-primary leading-none">
                          Mesa {order.table_number}
                        </span>
                      ) : (
                        <Badge variant="outline" className="w-fit">Sem mesa</Badge>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      #{String(order.order_number).padStart(3, "0")}
                    </span>
                  </div>

                  {consumerName && (
                    <p className="text-sm text-muted-foreground">{consumerName}</p>
                  )}

                  <div className="space-y-1">
                    {order.order_items.map((item) => {
                      const partial =
                        item.delivered_quantity > 0 && item.delivered_quantity < item.quantity;
                      return (
                        <div key={item.id} className="flex items-center gap-2 text-sm">
                          <span className="font-semibold text-foreground">{item.quantity}x</span>
                          <span className="text-muted-foreground truncate flex-1">{item.name}</span>
                          {partial && (
                            <Badge variant="outline" className="text-[10px] border-warning/40 text-warning">
                              {item.delivered_quantity}/{item.quantity} entregue
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    onClick={() => handleDeliver(order.id)}
                    disabled={delivering.has(order.id)}
                    className="w-full h-12 bg-green-600 hover:bg-green-700 text-white rounded-xl gap-2"
                  >
                    <CheckCircle className="h-5 w-5" />
                    {delivering.has(order.id) ? "Entregando..." : "Entregar"}
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </WaiterSessionGuard>
  );
}
