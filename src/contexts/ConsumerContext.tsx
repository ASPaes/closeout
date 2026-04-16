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
  activeEvent: { id: string; name: string; client_id: string } | null;
  activeOrder: ActiveOrder | null;
  cart: Cart;
  consumptionLimits: ConsumptionLimits | null;
  location: { lat: number; lng: number } | null;
  setActiveEvent: (event: { id: string; name: string; client_id: string } | null) => void;
  setActiveOrder: (order: ActiveOrder | null) => void;
  setLocation: (loc: { lat: number; lng: number } | null) => void;
  addToCart: (item: Omit<CartItem, "quantity">) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  refreshActiveOrder: () => Promise<void>;
  loadingOrder: boolean;
  loadingEvent: boolean;
};

const ConsumerContext = createContext<ConsumerContextType | null>(null);

export function ConsumerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeEvent, setActiveEvent] = useState<{ id: string; name: string; client_id: string } | null>(null);
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [cart, setCart] = useState<Cart>({ items: [], total: 0 });
  const [consumptionLimits, setConsumptionLimits] = useState<ConsumptionLimits | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);

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
        setActiveOrder(null);
      }
    } catch {
      setActiveOrder(null);
    } finally {
      setLoadingOrder(false);
    }
  }, [user]);

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

  // Fetch active order on mount
  useEffect(() => {
    refreshActiveOrder();
  }, [refreshActiveOrder]);

  return (
    <ConsumerContext.Provider
      value={{
        activeEvent,
        activeOrder,
        cart,
        consumptionLimits,
        location,
        setActiveEvent,
        setActiveOrder,
        setLocation,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        refreshActiveOrder,
        loadingOrder,
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
