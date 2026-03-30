import { useState, useEffect } from "react";
import { useWaiter } from "@/contexts/WaiterContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type EventOption = { id: string; name: string };

export function WaiterSessionGuard({ children }: { children: React.ReactNode }) {
  const { sessionId, loading, refreshSession } = useWaiter();
  const { user } = useAuth();
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [starting, setStarting] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(true);

  useEffect(() => {
    if (!user || sessionId) { setLoadingEvents(false); return; }
    // Fetch events where user has waiter role
    supabase
      .from("user_roles")
      .select("event_id")
      .eq("user_id", user.id)
      .eq("role", "waiter")
      .then(async ({ data: roles }) => {
        if (!roles || roles.length === 0) {
          setLoadingEvents(false);
          return;
        }
        const eventIds = roles.map((r) => r.event_id).filter(Boolean) as string[];
        if (eventIds.length === 0) {
          // waiter role without event scope — fetch all active events for their clients
          const { data: clientRoles } = await supabase
            .from("user_roles")
            .select("client_id")
            .eq("user_id", user.id)
            .eq("role", "waiter");
          const clientIds = (clientRoles ?? []).map((r) => r.client_id).filter(Boolean) as string[];
          if (clientIds.length > 0) {
            const { data: evs } = await supabase
              .from("events")
              .select("id, name")
              .in("client_id", clientIds)
              .eq("status", "active")
              .order("start_at", { ascending: false })
              .limit(20);
            setEvents((evs ?? []) as EventOption[]);
          }
        } else {
          const { data: evs } = await supabase
            .from("events")
            .select("id, name")
            .in("id", eventIds)
            .eq("status", "active")
            .order("start_at", { ascending: false })
            .limit(20);
          setEvents((evs ?? []) as EventOption[]);
        }
        setLoadingEvents(false);
      });
  }, [user, sessionId]);

  const handleStart = async () => {
    if (!selectedEvent) {
      toast.error("Selecione um evento.");
      return;
    }
    setStarting(true);
    const { data, error } = await supabase.rpc("start_waiter_session", {
      p_event_id: selectedEvent,
      p_assignment_type: "free",
      p_assignment_value: "",
    });
    if (error) {
      toast.error("Erro ao iniciar turno.");
      setStarting(false);
      return;
    }
    const result = data as unknown as { ok: boolean; error?: string };
    if (!result.ok) {
      const msgs: Record<string, string> = {
        SESSION_ALREADY_ACTIVE: "Você já tem um turno ativo.",
        NOT_WAITER: "Você não tem permissão de garçom.",
        EVENT_NOT_FOUND: "Evento não encontrado.",
      };
      toast.error(msgs[result.error ?? ""] ?? "Erro ao iniciar turno.");
      setStarting(false);
      return;
    }
    toast.success("Turno iniciado!");
    await refreshSession();
    setStarting(false);
  };

  if (loading || loadingEvents) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (sessionId) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 px-4 pt-12">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-glow"
        style={{ boxShadow: "0 0 24px hsl(24 100% 50% / 0.3)" }}
      >
        <Play className="h-8 w-8 text-primary-foreground" />
      </div>
      <h1 className="text-xl font-bold text-foreground">Iniciar Turno</h1>
      <p className="text-center text-sm text-muted-foreground">
        Selecione o evento para começar a atender.
      </p>

      {events.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">
          Nenhum evento ativo disponível para você.
        </p>
      ) : (
        <>
          <select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            className="w-full rounded-xl border border-input bg-card px-4 py-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            style={{ minHeight: 48, fontSize: 16 }}
          >
            <option value="">Selecione o evento...</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </select>

          <Button
            onClick={handleStart}
            disabled={!selectedEvent || starting}
            className="w-full min-h-[48px] rounded-xl text-base font-semibold"
          >
            {starting ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Play className="mr-2 h-5 w-5" />
            )}
            Iniciar Turno
          </Button>
        </>
      )}
    </div>
  );
}
