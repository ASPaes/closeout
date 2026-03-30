import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type WaiterSession = {
  id: string;
  event_id: string;
  client_id: string;
  assignment_type: string;
  assignment_value: string | null;
  started_at: string;
  cash_collected: number;
};

type WaiterContextType = {
  waiterId: string | null;
  waiterName: string | null;
  eventId: string | null;
  eventName: string | null;
  clientId: string | null;
  sessionId: string | null;
  session: WaiterSession | null;
  assignmentType: string;
  assignmentValue: string | null;
  pendingCallsCount: number;
  cashCollected: number;
  loading: boolean;
  refreshSession: () => Promise<void>;
  setCashCollected: (v: number) => void;
};

const WaiterContext = createContext<WaiterContextType | null>(null);

export function WaiterProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [session, setSession] = useState<WaiterSession | null>(null);
  const [eventName, setEventName] = useState<string | null>(null);
  const [pendingCallsCount, setPendingCallsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("waiter_sessions")
      .select("id, event_id, client_id, assignment_type, assignment_value, started_at, cash_collected")
      .eq("waiter_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (data) {
      setSession(data as WaiterSession);
      // fetch event name
      const { data: ev } = await supabase
        .from("events")
        .select("name")
        .eq("id", data.event_id)
        .single();
      setEventName(ev?.name ?? null);

      // fetch pending calls count
      const { count } = await supabase
        .from("waiter_calls")
        .select("id", { count: "exact", head: true })
        .eq("event_id", data.event_id)
        .eq("status", "pending");
      setPendingCallsCount(count ?? 0);
    } else {
      setSession(null);
      setEventName(null);
      setPendingCallsCount(0);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Realtime subscription for waiter_calls
  useEffect(() => {
    if (!session?.event_id) return;
    const channel = supabase
      .channel(`waiter-calls-${session.event_id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "waiter_calls",
          filter: `event_id=eq.${session.event_id}`,
        },
        () => {
          // Re-fetch count on any change
          supabase
            .from("waiter_calls")
            .select("id", { count: "exact", head: true })
            .eq("event_id", session.event_id)
            .eq("status", "pending")
            .then(({ count }) => setPendingCallsCount(count ?? 0));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session?.event_id]);

  const setCashCollected = (v: number) => {
    setSession((prev) => prev ? { ...prev, cash_collected: v } : prev);
  };

  return (
    <WaiterContext.Provider
      value={{
        waiterId: user?.id ?? null,
        waiterName: profile?.name ?? null,
        eventId: session?.event_id ?? null,
        eventName,
        clientId: session?.client_id ?? null,
        sessionId: session?.id ?? null,
        session,
        assignmentType: session?.assignment_type ?? "free",
        assignmentValue: session?.assignment_value ?? null,
        pendingCallsCount,
        cashCollected: session?.cash_collected ?? 0,
        loading,
        refreshSession: fetchSession,
        setCashCollected,
      }}
    >
      {children}
    </WaiterContext.Provider>
  );
}

export function useWaiter() {
  const ctx = useContext(WaiterContext);
  if (!ctx) throw new Error("useWaiter must be used within WaiterProvider");
  return ctx;
}
