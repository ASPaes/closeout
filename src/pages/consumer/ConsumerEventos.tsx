import { useTranslation } from "@/i18n/use-translation";
import { Calendar, MapPin, Users, ChevronRight, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const mockEvents = [
  {
    id: "1",
    name: "Neon Nights — Edição Verão",
    venue: "Club Aurora",
    address: "Av. Paulista, 1000 — São Paulo",
    date: "Sáb, 29 Mar · 23h",
    attendees: 847,
    status: "live" as const,
    image: "🎆",
  },
  {
    id: "2",
    name: "Sunset Rooftop Sessions",
    venue: "Terraço Sky Bar",
    address: "R. Oscar Freire, 500 — São Paulo",
    date: "Dom, 30 Mar · 16h",
    attendees: 234,
    status: "upcoming" as const,
    image: "🌅",
  },
  {
    id: "3",
    name: "Underground Bass Festival",
    venue: "Warehouse 44",
    address: "R. Augusta, 2200 — São Paulo",
    date: "Sex, 04 Abr · 22h",
    attendees: 1200,
    status: "upcoming" as const,
    image: "🔊",
  },
  {
    id: "4",
    name: "Jazz & Cocktails Night",
    venue: "Velvet Lounge",
    address: "R. Haddock Lobo, 800 — São Paulo",
    date: "Sáb, 05 Abr · 20h",
    attendees: 120,
    status: "upcoming" as const,
    image: "🎷",
  },
];

export default function ConsumerEventos() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-5">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Olá, Lucas! 👋</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Encontre eventos perto de você</p>
      </div>

      {/* Live event highlight */}
      {mockEvents
        .filter((e) => e.status === "live")
        .map((event) => (
          <button
            key={event.id}
            onClick={() => navigate(`/app/evento/${event.id}`)}
            className="relative w-full overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card to-card p-4 text-left active:scale-[0.98] transition-transform"
            style={{ boxShadow: "0 0 30px hsl(24 100% 50% / 0.15)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center gap-1 rounded-full bg-primary/20 px-2.5 py-0.5 text-[10px] font-bold text-primary uppercase tracking-wider">
                <Zap className="h-3 w-3" /> Ao Vivo
              </span>
            </div>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-lg font-bold text-foreground leading-tight">{event.name}</h2>
                <div className="mt-2 flex flex-col gap-1">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 text-primary/70" />
                    {event.venue}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-3 w-3 text-primary/70" />
                    {event.attendees} presentes
                  </span>
                </div>
              </div>
              <span className="text-4xl">{event.image}</span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs font-medium text-primary">Entrar no evento →</span>
            </div>
          </button>
        ))}

      {/* Section title */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Próximos Eventos</h2>
        <span className="text-xs text-muted-foreground">{mockEvents.filter(e => e.status === 'upcoming').length} eventos</span>
      </div>

      {/* Upcoming events */}
      <div className="flex flex-col gap-3">
        {mockEvents
          .filter((e) => e.status === "upcoming")
          .map((event) => (
            <button
              key={event.id}
              onClick={() => navigate(`/app/evento/${event.id}`)}
              className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card p-3.5 text-left active:scale-[0.98] active:bg-card/80 transition-all"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-2xl">
                {event.image}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground truncate">{event.name}</h3>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {event.date}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground truncate block">{event.venue}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
            </button>
          ))}
      </div>
    </div>
  );
}
