import { createContext, useContext, useMemo, useEffect, useState, useCallback, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "closeout_bar_event_id";
const STATION_STORAGE_KEY = "closeout_bar_station_id";

type EventOption = { id: string; name: string };

type BarContextType = {
  eventId: string | null;
  clientId: string | null;
  eventName: string | null;
  staffName: string | null;
  availableEvents: EventOption[];
  setEventId: (id: string | null) => void;
  loadingEvents: boolean;
  pendingOrdersCount: number;
  stationId: string | null;
  stationName: string | null;
};

const BarContext = createContext<BarContextType>({
  eventId: null,
  clientId: null,
  eventName: null,
  staffName: null,
  availableEvents: [],
  setEventId: () => {},
  loadingEvents: false,
  pendingOrdersCount: 0,
  stationId: null,
  stationName: null,
});

export function BarProvider({ children }: { children: ReactNode }) {
  const { roles, profile } = useAuth();
  const [availableEvents, setAvailableEvents] = useState<EventOption[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventName, setEventName] = useState<string | null>(null);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [stationId, setStationId] = useState<string | null>(null);
  const [stationName, setStationName] = useState<string | null>(null);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const eventFromUrl = params.get("event");
      if (eventFromUrl) {
        localStorage.setItem(STORAGE_KEY, eventFromUrl);
        return eventFromUrl;
      }
      return localStorage.getItem(STORAGE_KEY) || null;
    }
    return null;
  });

  // Extract event_ids and client_ids from roles
  const eventIds = useMemo(
    () => [...new Set(roles.filter((r) => r.event_id).map((r) => r.event_id!))],
    [roles]
  );

  const clientId = useMemo(() => {
    const ids = [...new Set(roles.filter((r) => r.client_id).map((r) => r.client_id!))];
    return ids[0] ?? null;
  }, [roles]);

  // Auto-select if only one event
  const eventId = useMemo(() => {
    if (selectedEventId) return selectedEventId;
    if (eventIds.length === 1) return eventIds[0];
    return null;
  }, [selectedEventId, eventIds]);

  // Fetch event names for available events
  useEffect(() => {
    if (eventIds.length === 0) {
      setAvailableEvents([]);
      return;
    }
    setLoadingEvents(true);
    supabase
      .from("events")
      .select("id, name")
      .in("id", eventIds)
      .eq("status", "active")
      .order("name")
      .then(({ data }) => {
        setAvailableEvents(data ?? []);
        setLoadingEvents(false);

        // Validate persisted selection
        if (selectedEventId && data && !data.some((e) => e.id === selectedEventId)) {
          setSelectedEventId(null);
          localStorage.removeItem(STORAGE_KEY);
        }
      });
  }, [eventIds]);

  // Resolve event name
  useEffect(() => {
    if (!eventId) {
      setEventName(null);
      return;
    }
    const found = availableEvents.find((e) => e.id === eventId);
    if (found) {
      setEventName(found.name);
      return;
    }
    supabase
      .from("events")
      .select("name")
      .eq("id", eventId)
      .single()
      .then(({ data }) => setEventName(data?.name ?? null));
  }, [eventId, availableEvents]);

  // Poll pending orders count
  useEffect(() => {
    if (!eventId) {
      setPendingOrdersCount(0);
      return;
    }
    const fetchCount = () => {
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .in("status", ["paid", "preparing"])
        .then(({ count }) => setPendingOrdersCount(count ?? 0));
    };

    fetchCount();
    const interval = setInterval(fetchCount, 10000);
    return () => clearInterval(interval);
  }, [eventId]);

  const setEventId = useCallback((id: string | null) => {
    setSelectedEventId(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Resolve bar station from URL query param or localStorage (run once on mount)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const stationCode = params.get("station");

      if (stationCode) {
        const { data } = await supabase
          .from("bar_stations")
          .select("id, name, event_id")
          .eq("join_code", stationCode)
          .eq("status", "active")
          .single();
        if (cancelled) return;
        if (data) {
          setStationId(data.id);
          setStationName(data.name);
          localStorage.setItem(STATION_STORAGE_KEY, data.id);
          if (data.event_id && data.event_id !== selectedEventId) {
            setSelectedEventId(data.event_id);
            localStorage.setItem(STORAGE_KEY, data.event_id);
          }
        }
        // Clean query param without reload
        params.delete("station");
        const newSearch = params.toString();
        const newUrl =
          window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash;
        window.history.replaceState({}, "", newUrl);
        return;
      }

      // No query param: try restoring from localStorage
      const storedId = localStorage.getItem(STATION_STORAGE_KEY);
      if (!storedId) return;
      const { data } = await supabase
        .from("bar_stations")
        .select("id, name")
        .eq("id", storedId)
        .eq("status", "active")
        .single();
      if (cancelled) return;
      if (data) {
        setStationId(data.id);
        setStationName(data.name);
      } else {
        localStorage.removeItem(STATION_STORAGE_KEY);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <BarContext.Provider
      value={{
        eventId,
        clientId,
        eventName,
        staffName: profile?.name ?? null,
        availableEvents,
        setEventId,
        loadingEvents,
        pendingOrdersCount,
        stationId,
        stationName,
      }}
    >
      {children}
    </BarContext.Provider>
  );
}

export function useBar() {
  return useContext(BarContext);
}
