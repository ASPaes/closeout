import { useTranslation } from "@/i18n/use-translation";
import {
  Calendar,
  MapPin,
  ChevronRight,
  Zap,
  Search,
  Loader2,
  RefreshCw,
  Sparkles,
  ChevronDown,
  CalendarDays,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getLocation } from "@/lib/native-bridge";
import { useConsumer } from "@/contexts/ConsumerContext";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

type EventRow = {
  id: string;
  name: string;
  description: string | null;
  start_at: string | null;
  end_at: string | null;
  status: string;
  client_id: string | null;
  venue_id: string;
  cover_url?: string | null;
};

type VenueRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
};

type CampaignRow = {
  id: string;
  name: string;
  description: string | null;
  client_id: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
};

type EnrichedEvent = EventRow & {
  venue?: VenueRow;
  distance?: number;
  hasPromo?: boolean;
};

type DateFilter = "all" | "today" | "week" | "month" | "custom";

export default function ConsumerEventos() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setActiveEvent } = useConsumer();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAttempted, setGpsAttempted] = useState(false);
  const [events, setEvents] = useState<EnrichedEvent[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [search, setSearch] = useState("");

  // Filters
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customDate, setCustomDate] = useState<Date | undefined>();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [cityPopoverOpen, setCityPopoverOpen] = useState(false);

  // Pull-to-refresh refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pullY, setPullY] = useState(0);
  const startY = useRef(0);
  const pulling = useRef(false);

  const fetchData = useCallback(async (loc: { lat: number; lng: number } | null) => {
    // Fetch active/completed events
    const { data: eventsData } = await supabase
      .from("events")
      .select("id, name, description, start_at, end_at, status, client_id, venue_id")
      .in("status", ["active", "completed"]);

    // Fetch venues for those events
    const venueIds = [...new Set((eventsData || []).map((e) => e.venue_id))];
    let venues: VenueRow[] = [];
    if (venueIds.length > 0) {
      const { data: venuesData } = await supabase
        .from("venues")
        .select("id, name, city, state, latitude, longitude")
        .in("id", venueIds);
      venues = (venuesData || []) as VenueRow[];
    }

    // Fetch active campaigns
    const now = new Date().toISOString();
    const { data: campsData } = await supabase
      .from("campaigns")
      .select("id, name, description, client_id, starts_at, ends_at, is_active")
      .eq("is_active", true)
      .lte("starts_at", now)
      .gte("ends_at", now);

    const activeCampaigns = (campsData || []) as CampaignRow[];
    setCampaigns(activeCampaigns);

    const campaignClientIds = new Set(activeCampaigns.map((c) => c.client_id));

    // Fetch cover images (sort_order=0)
    const eventIds = (eventsData || []).map((e) => e.id);
    const coverMap: Record<string, string> = {};
    if (eventIds.length > 0) {
      const { data: imgData } = await supabase
        .from("event_images")
        .select("event_id, public_url")
        .in("event_id", eventIds)
        .eq("sort_order", 0);
      if (imgData) {
        for (const img of imgData) {
          if (img.public_url) coverMap[img.event_id] = img.public_url;
        }
      }
    }

    const enriched: EnrichedEvent[] = ((eventsData || []) as EventRow[]).map((ev) => {
      const venue = venues.find((v) => v.id === ev.venue_id);
      let distance: number | undefined;
      if (loc && venue?.latitude && venue?.longitude) {
        distance = haversine(loc.lat, loc.lng, venue.latitude, venue.longitude);
      }
      return {
        ...ev,
        venue,
        distance,
        hasPromo: ev.client_id ? campaignClientIds.has(ev.client_id) : false,
        cover_url: coverMap[ev.id] || null,
      };
    });

    setEvents(enriched);
  }, []);

  const initialize = useCallback(async () => {
    setLoading(true);
    const loc = await getLocation();
    setUserLoc(loc);
    setGpsAttempted(true);
    await fetchData(loc);
    setLoading(false);
  }, [fetchData]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const handleRefresh = async () => {
    setRefreshing(true);
    const loc = await getLocation();
    setUserLoc(loc);
    await fetchData(loc);
    setRefreshing(false);
    setPullY(0);
  };

  const handleEnableGps = async () => {
    const loc = await getLocation();
    setUserLoc(loc);
    setGpsAttempted(true);
    if (loc) await fetchData(loc);
  };

  // Touch-based pull-to-refresh
  const onTouchStart = (e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!pulling.current) return;
    const dy = Math.max(0, Math.min(e.touches[0].clientY - startY.current, 80));
    setPullY(dy);
  };
  const onTouchEnd = () => {
    if (pullY > 50) handleRefresh();
    else setPullY(0);
    pulling.current = false;
  };

  const handleSelectEvent = (ev: EnrichedEvent) => {
    navigate(`/app/evento/${ev.id}`);
  };

  // Available cities for filter
  const availableCities = useMemo(() => {
    const set = new Set<string>();
    for (const ev of events) {
      if (ev.venue?.city) set.add(ev.venue.city);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [events]);

  // Date interval based on filter
  const dateInterval = useMemo((): { start: Date; end: Date } | null => {
    const now = new Date();
    if (dateFilter === "today") return { start: startOfDay(now), end: endOfDay(now) };
    if (dateFilter === "week")
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    if (dateFilter === "month") return { start: startOfMonth(now), end: endOfMonth(now) };
    if (dateFilter === "custom" && customDate)
      return { start: startOfDay(customDate), end: endOfDay(customDate) };
    return null;
  }, [dateFilter, customDate]);

  // Apply text + date + city filters
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (q) {
        const match =
          e.name.toLowerCase().includes(q) ||
          e.venue?.name?.toLowerCase().includes(q) ||
          e.venue?.city?.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (cityFilter !== "all" && e.venue?.city !== cityFilter) return false;
      if (dateInterval) {
        if (!e.start_at) return false;
        const d = new Date(e.start_at);
        if (!isWithinInterval(d, dateInterval)) return false;
      }
      return true;
    });
  }, [events, search, cityFilter, dateInterval]);

  // "Perto de você" — eventos com distance <= 25km, sem filtros aplicados
  const nearbyEvents = useMemo(() => {
    if (!userLoc) return [];
    return events
      .filter((e) => e.distance != null && e.distance <= 25)
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  }, [events, userLoc]);

  // Sort filtered for "Todos os eventos" section — exclui os já exibidos em "Perto de você"
  const sortedFiltered = useMemo(() => {
    const nearbyIds = new Set(nearbyEvents.map((e) => e.id));
    const arr = filtered.filter((e) => !nearbyIds.has(e.id));
    if (userLoc) {
      arr.sort((a, b) => {
        if (a.distance != null && b.distance != null) return a.distance - b.distance;
        if (a.distance != null) return -1;
        if (b.distance != null) return 1;
        return (a.start_at || "").localeCompare(b.start_at || "");
      });
    } else {
      arr.sort((a, b) => (a.start_at || "").localeCompare(b.start_at || ""));
    }
    return arr;
  }, [filtered, userLoc, nearbyEvents]);

  // Group by city when GPS denied
  const groupedByCity = useMemo(() => {
    if (userLoc) return null;
    const groups = new Map<string, EnrichedEvent[]>();
    for (const ev of sortedFiltered) {
      const city = ev.venue?.city || t("consumer_no_city");
      if (!groups.has(city)) groups.set(city, []);
      groups.get(city)!.push(ev);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [sortedFiltered, userLoc, t]);

  const displayName = profile?.name?.split(" ")[0] || "";

  const dateFilterPills: { key: DateFilter; label: string }[] = [
    { key: "all", label: t("consumer_filter_all") },
    { key: "today", label: t("consumer_filter_today") },
    { key: "week", label: t("consumer_filter_week") },
    { key: "month", label: t("consumer_filter_month") },
  ];

  const renderEventCard = (event: EnrichedEvent) => (
    <button
      key={event.id}
      onClick={() => handleSelectEvent(event)}
      className="relative flex w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] text-left active:scale-[0.98] transition-all"
    >
      <div className="flex h-[100px] w-[100px] shrink-0 items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 text-4xl select-none overflow-hidden">
        {event.cover_url ? (
          <img src={event.cover_url} alt={event.name} className="h-full w-full object-cover" />
        ) : (
          "🎉"
        )}
      </div>
      <div className="flex flex-1 flex-col justify-center gap-1 p-3.5 min-w-0">
        <div className="flex items-center gap-1.5">
          <h3 className="text-[15px] font-semibold text-foreground leading-snug line-clamp-1 flex-1">
            {event.name}
          </h3>
          {event.hasPromo && (
            <Badge
              variant="outline"
              className="shrink-0 border-primary/40 bg-primary/10 text-primary text-[10px] px-1.5 py-0"
            >
              <Zap className="h-2.5 w-2.5 mr-0.5" />
              {t("consumer_promo_badge")}
            </Badge>
          )}
        </div>
        {event.start_at && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3 shrink-0" />
            {format(new Date(event.start_at), "EEE, dd MMM · HH'h'", { locale: ptBR })}
          </span>
        )}
        <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
          <MapPin className="h-3 w-3 shrink-0" />
          {event.venue?.name || ""}
          {event.venue?.city ? ` · ${event.venue.city}` : ""}
          {event.distance != null && (
            <span className="ml-1 text-primary font-medium">
              · {formatDistance(event.distance)}
            </span>
          )}
        </span>
      </div>
      <div className="flex items-center pr-3">
        <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
      </div>
    </button>
  );

  return (
    <div
      ref={scrollRef}
      className="flex flex-col gap-5 relative"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {pullY > 0 && (
        <div
          className="flex items-center justify-center transition-all"
          style={{ height: pullY, marginTop: -8 }}
        >
          <RefreshCw
            className={cn("h-5 w-5 text-primary transition-transform", pullY > 50 && "animate-spin")}
          />
        </div>
      )}

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          {displayName && (
            <p className="text-sm text-muted-foreground">
              {t("consumer_greeting")}, {displayName} 👋
            </p>
          )}
          <h1 className="text-[28px] font-extrabold text-foreground leading-tight tracking-tight">
            {userLoc ? t("consumer_events_nearby") : t("consumer_events_title")}
          </h1>
        </div>
      </div>

      {/* Search — sempre visível */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={t("consumer_search_events")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-12 rounded-2xl border-white/[0.08] bg-white/[0.04] pl-10 text-base placeholder:text-muted-foreground focus-visible:ring-primary/50"
        />
      </div>

      {/* Filtros de data — pills horizontais */}
      <div className="flex flex-col gap-3 -mt-1">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5 snap-x">
          {dateFilterPills.map((pill) => {
            const isActive = dateFilter === pill.key;
            return (
              <button
                key={pill.key}
                onClick={() => {
                  setDateFilter(pill.key);
                  setCustomDate(undefined);
                }}
                className={cn(
                  "shrink-0 snap-start h-9 px-4 rounded-full text-xs font-medium transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/[0.06] border border-white/[0.08] text-muted-foreground hover:bg-white/[0.1]"
                )}
              >
                {pill.label}
              </button>
            );
          })}
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "shrink-0 snap-start h-9 px-4 rounded-full text-xs font-medium transition-all flex items-center gap-1.5",
                  dateFilter === "custom"
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/[0.06] border border-white/[0.08] text-muted-foreground hover:bg-white/[0.1]"
                )}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                {dateFilter === "custom" && customDate
                  ? format(customDate, "dd/MM", { locale: ptBR })
                  : t("consumer_filter_pick_date")}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-card border-white/[0.08]" align="start">
              <CalendarPicker
                mode="single"
                selected={customDate}
                onSelect={(d) => {
                  if (d) {
                    setCustomDate(d);
                    setDateFilter("custom");
                    setDatePickerOpen(false);
                  }
                }}
                locale={ptBR}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Filtro de cidade */}
        {availableCities.length > 0 && (
          <Popover open={cityPopoverOpen} onOpenChange={setCityPopoverOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center justify-between h-10 px-4 rounded-xl bg-white/[0.06] border border-white/[0.08] text-sm text-foreground">
                <span className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  {cityFilter === "all"
                    ? t("consumer_filter_all_cities")
                    : cityFilter}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-1 bg-card border-white/[0.08]" align="start">
              <button
                onClick={() => {
                  setCityFilter("all");
                  setCityPopoverOpen(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                  cityFilter === "all" ? "bg-primary/10 text-primary" : "hover:bg-white/[0.04] text-foreground"
                )}
              >
                {t("consumer_filter_all_cities")}
              </button>
              {availableCities.map((city) => (
                <button
                  key={city}
                  onClick={() => {
                    setCityFilter(city);
                    setCityPopoverOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                    cityFilter === city ? "bg-primary/10 text-primary" : "hover:bg-white/[0.04] text-foreground"
                  )}
                >
                  {city}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Banner GPS — apenas quando negado */}
      {gpsAttempted && !userLoc && (
        <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground font-medium leading-snug">
              {t("consumer_gps_banner_title")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("consumer_gps_banner_desc")}
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleEnableGps}
            className="shrink-0 h-8 px-3 text-xs rounded-lg"
          >
            {t("consumer_gps_banner_action")}
          </Button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {!loading && (
        <>
          {/* Campaigns carousel */}
          {campaigns.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">{t("consumer_promos_highlight")}</h2>
              </div>
              <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-5 px-5 snap-x snap-mandatory">
                {campaigns.map((camp) => (
                  <div
                    key={camp.id}
                    className="shrink-0 w-[280px] snap-start rounded-2xl p-4 relative overflow-hidden"
                    style={{
                      background: "linear-gradient(135deg, hsl(24 100% 50% / 0.85), hsl(24 80% 35% / 0.9))",
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                    <div className="relative z-10">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">
                        {t("consumer_promo_label")}
                      </p>
                      <h3 className="mt-1 text-lg font-bold text-white leading-snug line-clamp-2">
                        {camp.name}
                      </h3>
                      {camp.description && (
                        <p className="mt-1 text-xs text-white/70 line-clamp-2">{camp.description}</p>
                      )}
                      <p className="mt-2 text-[10px] text-white/50">
                        {t("consumer_promo_until")}{" "}
                        {format(new Date(camp.ends_at), "dd MMM", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Seção "Perto de você" — só com GPS ativo e eventos <= 25km */}
          {userLoc && nearbyEvents.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-primary" />
                <h2 className="text-[17px] font-bold text-foreground">
                  {t("consumer_section_nearby")}
                </h2>
              </div>
              <div className="flex flex-col gap-3">{nearbyEvents.map(renderEventCard)}</div>
            </div>
          )}

          {/* Seção "Todos os eventos" */}
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-bold text-foreground">
              {t("consumer_section_all")}
            </h2>
            <span className="text-xs text-muted-foreground">
              {sortedFiltered.length} {t("consumer_events_count")}
            </span>
          </div>

          {sortedFiltered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                <Calendar className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-base font-bold text-foreground">{t("consumer_no_events")}</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-[260px]">
                {t("consumer_no_events_desc")}
              </p>
            </div>
          ) : userLoc ? (
            <div className="flex flex-col gap-3">{sortedFiltered.map(renderEventCard)}</div>
          ) : (
            <div className="flex flex-col gap-5">
              {groupedByCity?.map(([city, list]) => (
                <div key={city} className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {city}
                    </h3>
                  </div>
                  <div className="flex flex-col gap-3">{list.map(renderEventCard)}</div>
                </div>
              ))}
            </div>
          )}

          {refreshing && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
