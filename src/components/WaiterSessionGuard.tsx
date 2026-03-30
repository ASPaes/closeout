import { ReactNode, useState, useEffect } from "react";
import { useWaiter } from "@/contexts/WaiterContext";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, UserCheck, MapPin, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type EventOption = {
  id: string;
  name: string;
  venue_name: string;
};

export function WaiterSessionGuard({ children }: { children: ReactNode }) {
  const { sessionId, loading, refreshSession } = useWaiter();
  const { user, roles } = useAuth();
  const { t } = useTranslation();
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [assignmentInfo, setAssignmentInfo] = useState<{ type: string; value: string | null } | null>(null);
  const [starting, setStarting] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Fetch events where user has waiter role
  useEffect(() => {
    if (sessionId || !user) return;

    const fetchEvents = async () => {
      setLoadingEvents(true);
      try {
        // Get event IDs from user_roles where role = waiter
        const waiterRoles = roles.filter((r) => r.role === "waiter" || r.role === "super_admin" || r.role === "client_admin" || r.role === "client_manager");

        // For super_admin/client_admin/client_manager, get all active events
        const isMgmt = roles.some((r) => ["super_admin", "client_admin", "client_manager"].includes(r.role));

        let query = supabase
          .from("events")
          .select("id, name, venues:venue_id(name)")
          .eq("status", "active");

        if (!isMgmt) {
          const eventIds = waiterRoles.filter((r) => r.event_id).map((r) => r.event_id!);
          if (eventIds.length === 0) {
            setEvents([]);
            setLoadingEvents(false);
            return;
          }
          query = query.in("id", eventIds);
        }

        const { data } = await query;
        if (data) {
          setEvents(
            data.map((e: any) => ({
              id: e.id,
              name: e.name,
              venue_name: (e.venues as any)?.name || "",
            }))
          );
        }
      } catch (err) {
        console.error("Failed to fetch events", err);
      } finally {
        setLoadingEvents(false);
      }
    };
    fetchEvents();
  }, [sessionId, user, roles]);

  // When event selected, show assignment info
  useEffect(() => {
    if (!selectedEventId || !user) {
      setAssignmentInfo(null);
      return;
    }
    // Try to find assignment from user_roles
    const waiterRole = roles.find(
      (r) => r.role === "waiter" && r.event_id === selectedEventId
    );
    // Default to free
    setAssignmentInfo({
      type: "free",
      value: null,
    });
  }, [selectedEventId, user, roles]);

  const handleStartShift = async () => {
    if (!selectedEventId) {
      toast.error("Selecione um evento");
      return;
    }
    setStarting(true);
    try {
      const { data, error } = await supabase.rpc("start_waiter_session", {
        p_event_id: selectedEventId,
        p_assignment_type: assignmentInfo?.type || "free",
        p_assignment_value: assignmentInfo?.value || null,
      } as any);

      const result = data as any;
      if (error || !result?.ok) {
        const errMsg = result?.error === "SESSION_ALREADY_ACTIVE"
          ? "Você já tem um turno ativo"
          : result?.error === "EVENT_NOT_FOUND"
          ? "Evento não encontrado"
          : "Erro ao iniciar turno";
        toast.error(errMsg);
        return;
      }

      toast.success("Turno iniciado com sucesso!");
      await refreshSession();
    } catch (err) {
      toast.error("Erro ao iniciar turno");
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center gap-8 px-2 pt-8">
        {/* Icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <UserCheck className="h-8 w-8 text-primary" />
        </div>

        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground">{t("waiter_start_shift")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Selecione o evento para iniciar seu turno de atendimento.
          </p>
        </div>

        {/* Event selector */}
        <div className="w-full space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Evento
            </label>
            {loadingEvents ? (
              <div className="flex h-14 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : events.length === 0 ? (
              <div className="flex h-14 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] px-4">
                <p className="text-sm text-muted-foreground">Nenhum evento disponível</p>
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="h-14 w-full appearance-none rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 pr-10 text-base text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  style={{ fontSize: "16px" }}
                >
                  <option value="" className="bg-background text-muted-foreground">Selecione um evento...</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id} className="bg-background text-foreground">
                      {ev.name}{ev.venue_name ? ` — ${ev.venue_name}` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Assignment info (readonly) */}
          {assignmentInfo && selectedEventId && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Atribuição
              </p>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="text-sm text-foreground">
                  {assignmentInfo.type === "tables"
                    ? `${t("waiter_tables")}: ${assignmentInfo.value || "—"}`
                    : assignmentInfo.type === "sector"
                    ? `${t("waiter_sector")}: ${assignmentInfo.value || "—"}`
                    : t("waiter_free")}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Start button */}
        <button
          onClick={handleStartShift}
          disabled={!selectedEventId || starting}
          className={cn(
            "flex h-14 w-full items-center justify-center gap-2 rounded-xl font-semibold transition-all active:scale-[0.98]",
            selectedEventId
              ? "bg-primary text-primary-foreground"
              : "bg-white/[0.06] text-muted-foreground cursor-not-allowed"
          )}
        >
          {starting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <UserCheck className="h-5 w-5" />
              {t("waiter_start_shift")}
            </>
          )}
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
