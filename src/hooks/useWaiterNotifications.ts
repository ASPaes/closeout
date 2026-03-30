import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { vibrate } from "@/lib/native-bridge";
import { toast } from "sonner";

/**
 * Monitors waiter-relevant events via Supabase Realtime:
 * - New pending calls → vibrate + toast
 * - Order status changes (ready, delivered) → vibrate + toast
 * - Cancellation request decisions → toast
 */
export function useWaiterNotifications(
  waiterId: string | null,
  eventId: string | null
) {
  const knownCallIds = useRef<Set<string>>(new Set());
  const orderStatuses = useRef<Map<string, string>>(new Map());

  // Realtime: waiter_calls (new pending calls)
  useEffect(() => {
    if (!eventId) return;

    // Seed known calls so we don't alert on initial load
    const seed = async () => {
      const { data } = await supabase
        .from("waiter_calls" as any)
        .select("id")
        .eq("event_id", eventId)
        .eq("status", "pending");
      if (data) {
        knownCallIds.current = new Set((data as any[]).map((c) => c.id));
      }
    };
    seed();

    const channel = supabase
      .channel(`waiter-notif-calls-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "waiter_calls",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const call = payload.new as any;
          if (call.status !== "pending") return;
          if (knownCallIds.current.has(call.id)) return;
          knownCallIds.current.add(call.id);

          const typeLabels: Record<string, string> = {
            general: "Chamado geral",
            order: "Pedido",
            bill: "Conta",
            help: "Ajuda",
          };
          const label = typeLabels[call.call_type] || "Chamado";
          const who = call.consumer_name || "Cliente anônimo";
          const where = call.table_number
            ? `Mesa ${call.table_number}`
            : call.location_description || "";

          vibrate(200);
          toast(`🔔 ${label}`, {
            description: `${who}${where ? ` · ${where}` : ""}`,
            duration: 6000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  // Realtime: orders (status changes for this waiter)
  useEffect(() => {
    if (!waiterId || !eventId) return;

    // Seed current statuses
    const seed = async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, status, order_number")
        .eq("waiter_id", waiterId)
        .eq("event_id", eventId)
        .in("status", ["pending", "paid", "preparing", "ready"]);
      if (data) {
        for (const o of data) {
          orderStatuses.current.set(o.id, o.status);
        }
      }
    };
    seed();

    const channel = supabase
      .channel(`waiter-notif-orders-${waiterId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `waiter_id=eq.${waiterId}`,
        },
        (payload) => {
          const order = payload.new as any;
          const prev = orderStatuses.current.get(order.id);
          const newStatus = order.status as string;

          if (newStatus === prev) return;
          orderStatuses.current.set(order.id, newStatus);

          const num = order.order_number;

          if (newStatus === "ready") {
            vibrate(300);
            toast.success(`🎉 Pedido #${num} PRONTO!`, {
              description: "Retire no balcão para entregar ao cliente.",
              duration: 10000,
            });
          } else if (newStatus === "delivered" && prev === "ready") {
            toast(`✅ Pedido #${num} retirado pelo cliente`, {
              duration: 4000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [waiterId, eventId]);

  // Realtime: waiter_cancellation_requests decisions
  useEffect(() => {
    if (!waiterId) return;

    const channel = supabase
      .channel(`waiter-notif-cancel-${waiterId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "waiter_cancellation_requests",
          filter: `waiter_id=eq.${waiterId}`,
        },
        async (payload) => {
          const req = payload.new as any;
          if (req.status === "approved") {
            // Fetch order number
            const { data: order } = await supabase
              .from("orders")
              .select("order_number")
              .eq("id", req.order_id)
              .single();
            const num = order?.order_number || "?";
            toast.success(`✅ Cancelamento do pedido #${num} aprovado`, {
              duration: 6000,
            });
            vibrate(100);
          } else if (req.status === "rejected") {
            const { data: order } = await supabase
              .from("orders")
              .select("order_number")
              .eq("id", req.order_id)
              .single();
            const num = order?.order_number || "?";
            toast.error(`❌ Cancelamento do pedido #${num} negado`, {
              description: req.review_notes || "",
              duration: 8000,
            });
            vibrate(200);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [waiterId]);
}
