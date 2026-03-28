import { useEffect, useRef } from "react";
import { useConsumer } from "@/contexts/ConsumerContext";
import { supabase } from "@/integrations/supabase/client";
import { vibrate } from "@/lib/native-bridge";
import { toast } from "sonner";

/**
 * Monitors the active order via Supabase Realtime and fires
 * in-app toasts + vibration on status transitions.
 * Push notifications will be added in Phase 11 (Capacitor).
 */
export function useConsumerNotifications() {
  const { activeOrder, refreshActiveOrder } = useConsumer();
  const prevStatusRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeOrder) {
      prevStatusRef.current = null;
      return;
    }

    const orderId = activeOrder.id;
    prevStatusRef.current = activeOrder.status;

    const channel = supabase
      .channel(`consumer-notif-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const newStatus = (payload.new as any).status as string;
          const prev = prevStatusRef.current;

          if (newStatus === prev) return;
          prevStatusRef.current = newStatus;

          switch (newStatus) {
            case "preparing":
              toast("🍳 Seu pedido está sendo preparado!", {
                duration: 4000,
              });
              vibrate(100);
              break;

            case "ready":
              toast.success("🎉 SEU PEDIDO ESTÁ PRONTO!", {
                description: "Apresente o QR Code no balcão para retirar.",
                duration: 10000,
              });
              vibrate(300);
              break;

            case "delivered":
              toast("✅ Pedido retirado com sucesso!", {
                duration: 4000,
              });
              break;

            case "cancelled":
              toast.error("Pedido cancelado", {
                description: "Entre em contato com o staff se tiver dúvidas.",
                duration: 6000,
              });
              vibrate(200);
              break;
          }

          // Refresh context so QR tab badge updates
          refreshActiveOrder();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeOrder?.id, refreshActiveOrder]);
}
