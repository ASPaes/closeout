import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useConsumer } from "@/contexts/ConsumerContext";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

type Attendee = {
  id: string;
  user_id: string;
  name: string;
  avatar_url: string | null;
  checked_in_at: string;
  is_self: boolean;
};

export default function ConsumerPresentes() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { activeEvent } = useConsumer();
  const navigate = useNavigate();
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeEvent || !user) { setLoading(false); return; }

    const fetch = async () => {
      const { data } = await supabase
        .from("event_checkins")
        .select("id, user_id, checked_in_at, profiles!inner(name, avatar_url)")
        .eq("event_id", activeEvent.id)
        .eq("is_visible", true)
        .is("checked_out_at", null)
        .order("checked_in_at", { ascending: true });

      if (data) {
        const mapped: Attendee[] = data.map((d: any) => ({
          id: d.id,
          user_id: d.user_id,
          name: d.profiles?.name || "Anônimo",
          avatar_url: d.profiles?.avatar_url,
          checked_in_at: d.checked_in_at,
          is_self: d.user_id === user.id,
        }));
        // Self first
        mapped.sort((a, b) => (a.is_self ? -1 : b.is_self ? 1 : 0));
        setAttendees(mapped);
      }
      setLoading(false);
    };
    fetch();
  }, [activeEvent, user]);

  if (!activeEvent) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4 pb-20">
        <Users className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-base font-semibold text-foreground">Nenhum evento selecionado</p>
        <Button variant="outline" className="rounded-xl border-white/[0.08]" onClick={() => navigate("/app")}>
          Ver eventos
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/app/checkin")}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] active:scale-95 transition-transform"
        >
          <ArrowLeft className="h-4 w-4 text-foreground" />
        </button>
        <div>
          <h1 className="text-xl font-extrabold text-foreground leading-tight">Quem está aqui</h1>
          <p className="text-xs text-muted-foreground">{activeEvent.name}</p>
        </div>
      </div>

      {/* Count */}
      {!loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <span className="text-2xl font-bold text-foreground">{attendees.length}</span>
            <p className="text-xs text-muted-foreground">{attendees.length === 1 ? "pessoa presente" : "pessoas presentes"}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)}
        </div>
      )}

      {/* List */}
      {!loading && attendees.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.04]">
            <Users className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="text-base font-semibold text-foreground">Ninguém por aqui ainda</p>
          <p className="text-sm text-muted-foreground">Faça check-in para aparecer na lista</p>
        </div>
      )}

      {!loading && attendees.length > 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          {attendees.map((a, idx) => (
            <div
              key={a.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3",
                idx > 0 && "border-t border-white/[0.04]",
                a.is_self && "bg-primary/5"
              )}
            >
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold shrink-0",
                a.is_self ? "bg-primary text-primary-foreground" : "bg-white/[0.08] text-foreground"
              )}>
                {a.avatar_url ? (
                  <img src={a.avatar_url} className="h-10 w-10 rounded-full object-cover" alt="" />
                ) : (
                  a.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">
                  {a.name}{a.is_self && <span className="text-primary ml-1.5 text-xs font-medium">(você)</span>}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Chegou às {new Date(a.checked_in_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
