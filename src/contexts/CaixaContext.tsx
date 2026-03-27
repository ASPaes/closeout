import { createContext, useContext, useMemo, useEffect, useState, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "closeout_caixa_event_id";

type CaixaEvent = { id: string; name: string };

type CaixaContextType = {
  /** Selected event ID */
  eventId: string | null;
  /** Client ID derived from event */
  clientId: string | null;
  /** Open cash register ID for current operator */
  cashRegisterId: string | null;
  /** Register number for display */
  registerNumber: number | null;
  /** Operator display name */
  operatorName: string | null;
  /** Event name */
  eventName: string | null;
  /** Available events for this operator */
  availableEvents: CaixaEvent[];
  /** Set selected event */
  setEventId: (id: string | null) => void;
  /** Loading state */
  loading: boolean;
  /** Reload cash register state */
  refreshCashRegister: () => void;
};

const CaixaContext = createContext<CaixaContextType>({
  eventId: null,
  clientId: null,
  cashRegisterId: null,
  registerNumber: null,
  operatorName: null,
  eventName: null,
  availableEvents: [],
  setEventId: () => {},
  loading: false,
  refreshCashRegister: () => {},
});

export function CaixaProvider({ children }: { children: ReactNode }) {
  const { session, profile, roles } = useAuth();
  const [availableEvents, setAvailableEvents] = useState<CaixaEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY) || null;
    }
    return null;
  });
  const [clientId, setClientId] = useState<string | null>(null);
  const [eventName, setEventName] = useState<string | null>(null);
  const [registerNumber, setRegisterNumber] = useState<number | null>(null);
  const [cashRegisterId, setCashRegisterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const userId = session?.user?.id;
  const operatorName = profile?.name || null;

  // Fetch available events for the operator
  useEffect(() => {
    if (!userId) return;

    setLoading(true);
    supabase
      .from("events")
      .select("id, name, client_id")
      .in("status", ["draft", "active"])
      .order("name")
      .then(({ data }) => {
        const events = (data ?? []).map((e) => ({ id: e.id, name: e.name }));
        setAvailableEvents(events);
        setLoading(false);

        // Validate persisted selection
        if (selectedEventId && !events.some((e) => e.id === selectedEventId)) {
          setSelectedEventId(null);
          localStorage.removeItem(STORAGE_KEY);
        }
      });
  }, [userId]);

  // Resolve client_id and event name when eventId changes
  useEffect(() => {
    if (!selectedEventId) {
      setClientId(null);
      setEventName(null);
      return;
    }

    supabase
      .from("events")
      .select("name, client_id")
      .eq("id", selectedEventId)
      .single()
      .then(({ data }) => {
        setClientId(data?.client_id ?? null);
        setEventName(data?.name ?? null);
      });
  }, [selectedEventId]);

  // Fetch open cash register for current operator in selected event
  const fetchCashRegister = () => {
    if (!userId || !selectedEventId) {
      setCashRegisterId(null);
      setRegisterNumber(null);
      return;
    }

    supabase
      .from("cash_registers")
      .select("id, register_number")
      .eq("event_id", selectedEventId)
      .eq("operator_id", userId)
      .eq("status", "open")
      .maybeSingle()
      .then(({ data }) => {
        setCashRegisterId(data?.id ?? null);
        setRegisterNumber(data?.register_number ?? null);
      });
  };

  useEffect(() => {
    fetchCashRegister();
  }, [userId, selectedEventId]);

  const setEventId = (id: string | null) => {
    setSelectedEventId(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <CaixaContext.Provider
      value={{
        eventId: selectedEventId,
        clientId,
        cashRegisterId,
        operatorName,
        eventName,
        availableEvents,
        setEventId,
        loading,
        refreshCashRegister: fetchCashRegister,
      }}
    >
      {children}
    </CaixaContext.Provider>
  );
}

export function useCaixa() {
  return useContext(CaixaContext);
}
