import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, MapPin, ChevronRight, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type EventCheckin = {
  id: string;
  event_id: string;
  event_name: string;
  event_start_at: string | null;
  event_end_at: string | null;
  venue_name: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
};

export default function ConsumerMeusEventos() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [checkins, setCheckins] = useState<EventCheckin[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCheckins = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("event_checkins")
      .select(`
        id,
        event_id,
        checked_in_at,
        checked_out_at,
        events (
          name,
          start_at,
          end_at,
          venues (name)
        )
      `)
      .eq("user_id", user.id)
      .order("checked_in_at", { ascending: false });

    if (error) {
      setCheckins([]);
    } else if (data) {
      const rows: EventCheckin[] = data.map((row: any) => {
        const event = row.events;
        return {
          id: row.id,
          event_id: row.event_id,
          event_name: event?.name || "Evento",
          event_start_at: event?.start_at || null,
          event_end_at: event?.end_at || null,
          venue_name: event?.venues?.name || null,
          checked_in_at: row.checked_in_at,
          checked_out_at: row.checked_out_at,
        };
      });
      setCheckins(rows);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchCheckins(); }, [fetchCheckins]);

  const formatDateRange = (start: string | null, end: string | null) => {
    if (!start) return "Data a definir";
    const s = new Date(start);
    const e = end ? new Date(end) : null;
    const sameDay = e && s.toDateString() === e.toDateString();
    const dateStr = s.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
    if (sameDay) {
      const timeStr = s.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) +
        " - " + e.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      return `${dateStr} · ${timeStr}`;
    }
    if (e) {
      const endStr = e.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
      return `${dateStr} - ${endStr}`;
    }
    return dateStr;
  };

  const statusLabel = (row: EventCheckin) => {
    if (row.checked_out_at) return { label: "Checkout realizado", color: "text-muted-foreground" };
    if (row.checked_in_at) return { label: "Presente", color: "text-green-400" };
    return { label: "Aguardando", color: "text-muted-foreground" };
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-3 pb-20">
        <h1 className="text-xl font-bold text-foreground px-1">Meus eventos</h1>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (checkins.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Inbox className="h-7 w-7 text-primary/60" />
        </div>
        <p className="text-base font-medium text-foreground/80">Você ainda não participou de nenhum evento</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-20">
      <h1 className="text-xl font-bold text-foreground px-1">Meus eventos</h1>
      {checkins.map((row) => {
        const st = statusLabel(row);
        return (
          <button
            key={row.id}
            onClick={() => navigate(`/app/evento/${row.event_id}`)}
            className={cn(
              "flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 backdrop-blur-sm",
              "active:scale-[0.99] active:bg-white/[0.06] transition-all min-h-[80px] w-full text-left"
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{row.event_name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{formatDateRange(row.event_start_at, row.event_end_at)}</p>
              {row.venue_name && (
                <div className="flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3 text-muted-foreground/60" />
                  <p className="text-[11px] text-muted-foreground/70">{row.venue_name}</p>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className={cn("text-[10px] font-medium uppercase tracking-wide", st.color)}>
                {st.label}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
