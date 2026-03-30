import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type WaiterContextType = {
  waiterId: string | null;
  waiterName: string | null;
  eventId: string | null;
  eventName: string | null;
  clientId: string | null;
  sessionId: string | null;
  assignmentType: "tables" | "sector" | "free" | null;
  assignmentValue: string | null;
  pendingCallsCount: number;
  cashCollected: number;
  refreshSession: () => Promise<void>;
  setCashCollected: (v: number) => void;
  loading: boolean;
};

const WaiterContext = createContext<WaiterContextType | null>(null);

export function WaiterProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventName, setEventName] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [assignmentType, setAssignmentType] = useState<"tables" | "sector" | "free" | null>(null);
  const [assignmentValue, setAssignmentValue] = useState<string | null>(null);
  const [pendingCallsCount, setPendingCallsCount] = useState(0);
  const [cashCollected, setCashCollected] = useState(0);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      // Check for active waiter session
      const { data: sessions } = await supabase
        .from("waiter_sessions" as any)
        .select("id, event_id, assignment_type, assignment_value, cash_collected")
        .eq("waiter_id", user.id)
        .is("closed_at", null)
        .limit(1);

      const session = (sessions as any)?.[0];
      if (session) {
        setSessionId(session.id);
        setEventId(session.event_id);
        setAssignmentType(session.assignment_type || "free");
        setAssignmentValue(session.assignment_value || null);
        setCashCollected(Number(session.cash_collected) || 0);

        // Fetch event info
        const { data: evt } = await supabase
          .from("events")
          .select("name, client_id")
          .eq("id", session.event_id)
          .single();
        if (evt) {
          setEventName(evt.name);
          setClientId(evt.client_id);
        }
      } else {
        setSessionId(null);
        setEventId(null);
        setEventName(null);
        setClientId(null);
        setAssignmentType(null);
        setAssignmentValue(null);
        setCashCollected(0);
      }
    } catch (e) {
      console.error("WaiterContext: refreshSession error", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  // Realtime: listen for waiter_calls changes to update pendingCallsCount
  useEffect(() => {
    if (!eventId) { setPendingCallsCount(0); return; }

    const fetchCalls = async () => {
      const { count } = await supabase
        .from("waiter_calls" as any)
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("status", "pending");
      setPendingCallsCount(count || 0);
    };
    fetchCalls();

    const channel = supabase
      .channel("waiter-calls-" + eventId)
      .on("postgres_changes", { event: "*", schema: "public", table: "waiter_calls", filter: `event_id=eq.${eventId}` }, () => {
        fetchCalls();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId]);

  return (
    <WaiterContext.Provider
      value={{
        waiterId: user?.id || null,
        waiterName: profile?.name || null,
        eventId,
        eventName,
        clientId,
        sessionId,
        assignmentType,
        assignmentValue,
        pendingCallsCount,
        cashCollected,
        refreshSession,
        setCashCollected,
        loading,
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
