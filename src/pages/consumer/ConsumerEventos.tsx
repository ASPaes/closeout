import { useTranslation } from "@/i18n/use-translation";
import { Calendar, MapPin, Users, ChevronRight, Zap, Search, SlidersHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState } from "react";

const categories = ["Todos", "Ao Vivo", "Hoje", "Esta Semana", "Perto de Mim"];

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
  const [activeCat, setActiveCat] = useState("Todos");

  return (
    <div className="flex flex-col gap-5">
      {/* Large title */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Olá, Lucas 👋</p>
          <h1 className="text-[28px] font-extrabold text-foreground leading-tight tracking-tight">
            Eventos
          </h1>
        </div>
        <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] border border-white/[0.08] active:scale-95 transition-transform">
          <SlidersHorizontal className="h-[18px] w-[18px] text-muted-foreground" />
        </button>
      </div>

      {/* Category chips carousel */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCat(cat)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-all active:scale-95",
              activeCat === cat
                ? "bg-primary text-primary-foreground shadow-[0_0_16px_hsl(24,100%,50%,0.25)]"
                : "bg-white/[0.06] border border-white/[0.08] text-muted-foreground"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Live event — featured card */}
      {mockEvents
        .filter((e) => e.status === "live")
        .map((event) => (
          <button
            key={event.id}
            onClick={() => navigate(`/app/evento/${event.id}`)}
            className="relative w-full overflow-hidden rounded-3xl text-left active:scale-[0.98] transition-transform"
            style={{ aspectRatio: "16/10" }}
          >
            {/* Simulated image bg */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-background to-background" />
            <div className="absolute inset-0 flex items-center justify-center text-7xl opacity-30 select-none">
              {event.image}
            </div>
            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

            {/* Content */}
            <div className="relative flex h-full flex-col justify-between p-5">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 rounded-full bg-primary/90 px-3 py-1 text-[11px] font-bold text-primary-foreground uppercase tracking-wider">
                  <Zap className="h-3 w-3" /> Ao Vivo
                </span>
                <span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white/80">
                  <Users className="h-3 w-3" /> {event.attendees}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white leading-tight">{event.name}</h2>
                <div className="mt-1.5 flex items-center gap-3">
                  <span className="flex items-center gap-1 text-xs text-white/60">
                    <MapPin className="h-3 w-3" />
                    {event.venue}
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))}

      {/* Section title */}
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-bold text-foreground">Próximos</h2>
        <span className="text-xs text-muted-foreground">
          {mockEvents.filter((e) => e.status === "upcoming").length} eventos
        </span>
      </div>

      {/* Upcoming events — card list */}
      <div className="flex flex-col gap-3">
        {mockEvents
          .filter((e) => e.status === "upcoming")
          .map((event) => (
            <button
              key={event.id}
              onClick={() => navigate(`/app/evento/${event.id}`)}
              className="relative flex w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] text-left active:scale-[0.98] transition-all"
            >
              {/* Emoji image area */}
              <div className="flex h-[100px] w-[100px] shrink-0 items-center justify-center bg-gradient-to-br from-white/[0.06] to-transparent text-4xl">
                {event.image}
              </div>
              {/* Info */}
              <div className="flex flex-1 flex-col justify-center gap-1 p-3.5 min-w-0">
                <h3 className="text-[15px] font-semibold text-foreground leading-snug line-clamp-2">
                  {event.name}
                </h3>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3 shrink-0" />
                  {event.date}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {event.venue}
                </span>
              </div>
              <div className="flex items-center pr-3">
                <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
              </div>
            </button>
          ))}
      </div>
    </div>
  );
}
