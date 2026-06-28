import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type CartItem = {
  id: string;
  type: "product" | "combo";
  name: string;
  price: number;
  quantity: number;
  image_path?: string | null;
};

type Cart = {
  items: CartItem[];
  total: number;
};

type ConsumptionLimits = {
  max_order_value: number | null;
  max_orders_per_event: number | null;
  limit_behavior: string;
  is_active: boolean;
};

type PaymentDetail = {
  method: string;
  amount: number;
  status: string;
};

type ActiveOrder = {
  id: string;
  order_number: number;
  status: string;
  total: number;
  qr_token: string;
  items: { name: string; quantity: number; unit_price: number; delivered_quantity: number }[];
  payments?: PaymentDetail[];
  is_split_payment?: boolean;
};

type ConsumerContextType = {
  activeEvent: {
    id: string;
    name: string;
    client_id: string;
    table_service_enabled: boolean;
    table_count: number | null;
    comanda_enabled: boolean;
  } | null;
  activeOrder: ActiveOrder | null;
  activeComanda: {
    id: string;
    card_number: number;
    status: string;
  } | null;
  cart: Cart;
  consumptionLimits: ConsumptionLimits | null;
  location: { lat: number; lng: number } | null;
  setActiveEvent: (
    event: {
      id: string;
      name: string;
      client_id: string;
      table_service_enabled: boolean;
      table_count: number | null;
      comanda_enabled?: boolean;
    } | null,
  ) => void;
  setActiveOrder: (order: ActiveOrder | null) => void;
  setActiveComanda: (comanda: { id: string; card_number: number; status: string } | null) => void;
  setLocation: (loc: { lat: number; lng: number } | null) => void;
  addToCart: (item: Omit<CartItem, "quantity">) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  refreshActiveOrder: () => Promise<void>;
  loadingOrder: boolean;
  loadingEvent: boolean;
  lastTableNumber: number | null;
  lastIsExternalArea: boolean;
  setLastTableNumber: (n: number | null) => void;
  setLastIsExternalArea: (v: boolean) => void;
};

const ConsumerContext = createContext<ConsumerContextType | null>(null);

export function ConsumerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeEvent, setActiveEvent] = useState<{
    id: string;
    name: string;
    client_id: string;
    table_service_enabled: boolean;
    table_count: number | null;
    comanda_enabled: boolean;
  } | null>(null);
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [activeComanda, setActiveComanda] = useState<{
    id: string;
    card_number: number;
    status: string;
  } | null>(null);
  const [cart, setCart] = useState<Cart>({ items: [], total: 0 });
  const [consumptionLimits, setConsumptionLimits] = useState<ConsumptionLimits | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [lastTableNumber, setLastTableNumber] = useState<number | null>(null);
  const [lastIsExternalArea, setLastIsExternalArea] = useState(false);

  const computeTotal = (items: CartItem[]) =>
    items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const addToCart = useCallback((item: Omit<CartItem, "quantity">) => {
    setCart((prev) => {
      const existing = prev.items.find((i) => i.id === item.id);
      const items = existing
        ? prev.items.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i))
        : [...prev.items, { ...item, quantity: 1 }];
      return { items, total: computeTotal(items) };
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart((prev) => {
      const items = prev.items.filter((i) => i.id !== itemId);
      return { items, total: computeTotal(items) };
    });
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    setCart((prev) => {
      if (quantity <= 0) {
        const items = prev.items.filter((i) => i.id !== itemId);
        return { items, total: computeTotal(items) };
      }
      const items = prev.items.map((i) => (i.id === itemId ? { ...i, quantity } : i));
      return { items, total: computeTotal(items) };
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart({ items: [], total: 0 });
  }, []);

  const refreshActiveOrder = useCallback(async () => {
    if (!user) return;
    setLoadingOrder(true);
    try {
      const { data: qrData } = await supabase
        .from("qr_tokens")
        .select("token, order_id, orders!inner(id, order_number, status, total, event_id, consumer_id, is_split_payment)")
        .eq("status", "valid")
        .eq("orders.consumer_id", user.id)
        .limit(1);

      if (qrData && qrData.length > 0) {
        const qr = qrData[0] as any;
        const order = qr.orders;

        // Fetch items
        const { data: items } = await supabase
          .from("order_items")
          .select("name, quantity, unit_price, delivered_quantity")
          .eq("order_id", order.id);

        // Fetch payments
        const { data: paymentsData } = await supabase
          .from("payments")
          .select("payment_method, amount, status")
          .eq("order_id", order.id);

        const payments: PaymentDetail[] = (paymentsData || []).map((p: any) => ({
          method: p.payment_method,
          amount: p.amount,
          status: p.status,
        }));

        setActiveOrder({
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          total: order.total,
          qr_token: qr.token,
          items: items || [],
          payments: payments.length > 0 ? payments : undefined,
          is_split_payment: order.is_split_payment || false,
        });
      } else {
        // Fallback: table-mode (no QR), look for active order directly
        if (activeEvent?.table_service_enabled) {
          const { data: tableOrders } = await supabase
            .from("orders")
            .select(
              "id, order_number, status, total, is_split_payment, table_number, is_external_area, order_items(name, quantity, unit_price, delivered_quantity)",
            )
            .eq("consumer_id", user.id)
            .eq("event_id", activeEvent.id)
            .not("status", "in", '("delivered","cancelled")')
            .order("created_at", { ascending: false })
            .limit(1);
          if (tableOrders && tableOrders.length > 0) {
            const order = tableOrders[0] as any;
            const { data: paymentsData } = await supabase
              .from("payments")
              .select("payment_method, amount, status")
              .eq("order_id", order.id);
            setActiveOrder({
              id: order.id,
              order_number: order.order_number,
              status: order.status,
              total: order.total,
              qr_token: "",
              items: order.order_items || [],
              payments: (paymentsData || []).map((p: any) => ({
                method: p.payment_method,
                amount: p.amount,
                status: p.status,
              })),
              is_split_payment: order.is_split_payment || false,
            });
            return;
          }
        }
        setActiveOrder(null);
      }
    } catch {
      setActiveOrder(null);
    } finally {
      setLoadingOrder(false);
    }
  }, [user, activeEvent]);

  // Fetch consumption limits
  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_consumption_limits")
      .select("max_order_value, max_orders_per_event, limit_behavior, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setConsumptionLimits(data as ConsumptionLimits);
      });
  }, [user]);

  // Restore active event from active check-in (no localStorage)
  useEffect(() => {
    if (!user) {
      setLoadingEvent(false);
      return;
    }
    setLoadingEvent(true);
    supabase
      .from("event_checkins")
      .select("event_id, events!inner(id, name, client_id, table_service_enabled, table_count, comanda_enabled)")
      .eq("user_id", user.id)
      .is("checked_out_at", null)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const ev = (data as any)?.events;
        if (ev) {
          setActiveEvent({
            id: ev.id,
            name: ev.name,
            client_id: ev.client_id || "",
            table_service_enabled: ev.table_service_enabled ?? false,
            table_count: ev.table_count ?? null,
            comanda_enabled: ev.comanda_enabled ?? false,
          });
        }
        setLoadingEvent(false);
      });
  }, [user]);

  // Realtime subscription on event for table_service toggle
  useEffect(() => {
    if (!activeEvent?.id) return;
    const channel = supabase
      .channel("consumer-event-" + activeEvent.id)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "events", filter: `id=eq.${activeEvent.id}` },
        (payload: any) => {
          setActiveEvent((prev) =>
            prev
              ? {
                  ...prev,
                  table_service_enabled: payload.new.table_service_enabled ?? false,
                  table_count: payload.new.table_count ?? null,
                  comanda_enabled: payload.new.comanda_enabled ?? false,
                }
              : null,
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeEvent?.id]);

  // Fetch active comanda (open physical card) for current event
  useEffect(() => {
    if (!user || !activeEvent?.id) {
      setActiveComanda(null);
      return;
    }
    supabase
      .from("comandas")
      .select("id, card_number, status")
      .eq("consumer_id", user.id)
      .eq("event_id", activeEvent.id)
      .eq("status", "open")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setActiveComanda({
            id: data.id,
            card_number: data.card_number,
            status: data.status,
          });
        } else {
          setActiveComanda(null);
        }
      });
  }, [user, activeEvent?.id]);

  // Fetch active order on mount
  useEffect(() => {
    refreshActiveOrder();
  }, [refreshActiveOrder]);

  return (
    <ConsumerContext.Provider
      value={{
        activeEvent,
        activeOrder,
        activeComanda,
        cart,
        consumptionLimits,
        location,
        setActiveEvent,
        setActiveOrder,
        setActiveComanda,
        setLocation,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        refreshActiveOrder,
        loadingOrder,
        loadingEvent,
        lastTableNumber,
        lastIsExternalArea,
        setLastTableNumber,
        setLastIsExternalArea,
      }}
    >
      {children}
    </ConsumerContext.Provider>
  );
}

export function useConsumer() {
  const ctx = useContext(ConsumerContext);
  if (!ctx) {
    throw new Error("useConsumer must be used within ConsumerProvider");
  }
  return ctx;
}
