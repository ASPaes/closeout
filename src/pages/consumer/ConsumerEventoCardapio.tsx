import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/i18n/use-translation";
import { useConsumer } from "@/contexts/ConsumerContext";
import { useAuth } from "@/hooks/useAuth";
import {
  Calendar, MapPin, ChevronLeft, ImageIcon, Loader2, Clock, Navigation,
  CheckCircle2, LogOut, MapPinOff, PartyPopper,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getLocation } from "@/lib/native-bridge";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ── Types ────────────────────────────────────────────────
type EventImage = { id: string; public_url: string | null; storage_path: string; sort_order: number };
type EventDetail = {
  id: string; name: string; description: string | null;
  start_at: string | null; end_at: string | null; status: string;
  client_id: string | null; venue_id: string;
  venues?: { name: string; city: string | null; state: string | null; address: string | null; latitude: number | null; longitude: number | null };
};
type EventSettings = { geo_radius_meters: number };

// ── Haversine ────────────────────────────────────────────
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371e3;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(m: number) {
  if (m < 1000) return `~ ${Math.round(m)} m`;
  return `~ ${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

// ═════════════════════════════════════════════════════════
export default function ConsumerEventoCardapio() {
  const { eventId } = useParams<{ eventId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setActiveEvent } = useConsumer();
  const { user } = useAuth();

  // Data
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [images, setImages] = useState<EventImage[]>([]);
  const [settings, setSettings] = useState<EventSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Geo
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceM, setDistanceM] = useState<number | null>(null);

  // Check-in state
  const [isPresent, setIsPresent] = useState(false);
  const [acting, setActing] = useState(false);

  // Dialogs
  const [showSuccess, setShowSuccess] = useState(false);
  const [confirmManual, setConfirmManual] = useState<{ reason: string } | null>(null);

  // ── Fetch data ──
  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    Promise.all([
      supabase
        .from("events")
        .select("id, name, description, start_at, end_at, status, client_id, venue_id, venues(name, city, state, address, latitude, longitude)")
        .eq("id", eventId)
        .single(),
      supabase
        .from("event_images")
        .select("id, public_url, storage_path, sort_order")
        .eq("event_id", eventId)
        .order("sort_order"),
      supabase
        .from("event_settings")
        .select("geo_radius_meters")
        .eq("event_id", eventId)
        .maybeSingle(),
    ]).then(([evRes, imgRes, setRes]) => {
      if (evRes.data) setEvent(evRes.data as unknown as EventDetail);
      if (imgRes.data) setImages(imgRes.data);
      if (setRes.data) setSettings(setRes.data as EventSettings);
      setLoading(false);
    });
  }, [eventId]);

  // ── Geo ──
  useEffect(() => {
    getLocation().then((loc) => {
      if (loc) setUserLoc(loc);
    });
  }, []);

  useEffect(() => {
    if (userLoc && event?.venues?.latitude && event?.venues?.longitude) {
      setDistanceM(haversineMeters(userLoc.lat, userLoc.lng, event.venues.latitude, event.venues.longitude));
    }
  }, [userLoc, event]);

  // ── Check-in status ──
  const checkPresence = useCallback(async () => {
    if (!user || !eventId) return;
    const { data } = await supabase
      .from("event_checkins")
      .select("id")
      .eq("user_id", user.id)
      .eq("event_id", eventId)
      .is("checked_out_at", null)
      .maybeSingle();
    setIsPresent(!!data);
  }, [user, eventId]);

  useEffect(() => { checkPresence(); }, [checkPresence]);

  // ── Check-in handler ──
  const doCheckin = async (method: "gps" | "manual", lat?: number, lng?: number) => {
    setActing(true);
    const { data, error } = await supabase.rpc("consumer_checkin", {
      p_event_id: eventId!,
      p_method: method,
      p_lat: lat ?? null,
      p_lng: lng ?? null,
    });
    setActing(false);

    if (error) {
      toast.error("Erro ao fazer check-in");
      return;
    }

    const res = data as any;
    if (!res.ok) {
      if (res.error === "CHECKED_IN_OTHER_EVENT") {
        toast.error("Você já está em outro evento. Faça check-out primeiro.");
      } else if (res.error === "ALREADY_CHECKED_IN") {
        toast("Você já está presente neste evento");
        setIsPresent(true);
      } else {
        toast.error("Erro ao fazer check-in");
      }
      return;
    }

    setIsPresent(true);
    setShowSuccess(true);
    // Set active event in context
    if (event) {
      setActiveEvent({ id: event.id, name: event.name, client_id: event.client_id || "" });
    }
  };

  const handleCheckin = async () => {
    setActing(true);
    const loc = await getLocation();

    if (loc) {
      setUserLoc(loc);
      const venueLat = event?.venues?.latitude;
      const venueLng = event?.venues?.longitude;

      if (venueLat && venueLng) {
        const dist = haversineMeters(loc.lat, loc.lng, venueLat, venueLng);
        setDistanceM(dist);
        const radius = settings?.geo_radius_meters ?? 500;

        if (dist <= radius) {
          await doCheckin("gps", loc.lat, loc.lng);
          return;
        } else {
          // Outside radius — ask manual confirmation
          setActing(false);
          setConfirmManual({ reason: `Você está a ${Math.round(dist)}m do evento (raio: ${radius}m). Deseja fazer check-in manual?` });
          return;
        }
      }
      // No venue coords — GPS checkin directly
      await doCheckin("gps", loc.lat, loc.lng);
    } else {
      // GPS failed
      setActing(false);
      setConfirmManual({ reason: "Não foi possível obter sua localização. Deseja fazer check-in manual?" });
    }
  };

  const handleCheckout = async () => {
    setActing(true);
    await supabase.rpc("consumer_checkout", { p_event_id: eventId! });
    setIsPresent(false);
    setActing(false);
    toast("Check-out realizado");
  };

  // ── Carousel state ──
  const [activeSlide, setActiveSlide] = useState(0);

  // ── Render ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground">Evento não encontrado</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-36">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-muted-foreground active:text-foreground transition-colors w-fit"
      >
        <ChevronLeft className="h-4 w-4" />
        Voltar
      </button>

      {/* Hero carousel */}
      <div className="relative rounded-2xl overflow-hidden border border-border/40">
        {images.length > 0 ? (
          <>
            <div
              className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
              onScroll={(e) => {
                const el = e.currentTarget;
                const idx = Math.round(el.scrollLeft / el.clientWidth);
                setActiveSlide(idx);
              }}
            >
              {images.map((img) => (
                <div key={img.id} className="aspect-[16/9] w-full shrink-0 snap-start">
                  <img
                    src={img.public_url || ""}
                    alt={event.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
            {/* Dots */}
            {images.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {images.map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === activeSlide ? "w-4 bg-primary" : "w-1.5 bg-white/40"
                    )}
                  />
                ))}
              </div>
            )}
            {/* Gradient overlay */}
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />
          </>
        ) : (
          <div className="aspect-[16/9] w-full bg-gradient-to-br from-primary/20 to-primary/5 flex flex-col items-center justify-center gap-2">
            <ImageIcon className="h-10 w-10 text-primary/30" />
            <span className="text-xs text-muted-foreground">Sem fotos</span>
          </div>
        )}
      </div>

      {/* Event info */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground flex-1">{event.name}</h1>
          {isPresent && (
            <span className="shrink-0 flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              Presente
            </span>
          )}
        </div>

        {event.description && (
          <p className="text-sm text-muted-foreground">{event.description}</p>
        )}

        <div className="flex flex-col gap-2 mt-1">
          {/* Date/time */}
          {event.start_at && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 text-primary shrink-0" />
              <span>
                {format(new Date(event.start_at), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </span>
            </div>
          )}
          {(event.start_at || event.end_at) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 text-primary shrink-0" />
              <span>
                {event.start_at && `${format(new Date(event.start_at), "HH'h'mm")}`}
                {event.end_at && ` — ${format(new Date(event.end_at), "HH'h'mm")}`}
              </span>
            </div>
          )}

          {/* Venue */}
          {event.venues && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <span>
                {event.venues.name}
                {event.venues.address && ` · ${event.venues.address}`}
                {event.venues.city && `, ${event.venues.city}`}
                {event.venues.state && ` - ${event.venues.state}`}
              </span>
            </div>
          )}

          {/* Distance */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Navigation className="h-4 w-4 text-primary shrink-0" />
            {distanceM != null ? (
              <span className="text-foreground font-medium">{fmtDist(distanceM)}</span>
            ) : (
              <span className="flex items-center gap-1">
                <MapPinOff className="h-3 w-3" />
                Distância indisponível
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Sticky CTA bar ── */}
      <div
        className="fixed bottom-[76px] left-0 right-0 z-40"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div
          className="mx-auto max-w-[480px] px-5"
        >
          <div
            className="flex items-center justify-between rounded-2xl border border-white/[0.06] px-4 py-3"
            style={{
              background: "rgba(10, 10, 10, 0.85)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              boxShadow: "0 -4px 24px rgba(0,0,0,0.5)",
            }}
          >
            <div className="flex flex-col gap-0.5">
              <span className={cn("text-xs font-semibold", isPresent ? "text-emerald-400" : "text-muted-foreground")}>
                {isPresent ? "Presente na festa" : "Fora do evento"}
              </span>
              {distanceM != null && (
                <span className="text-[11px] text-muted-foreground">{fmtDist(distanceM)}</span>
              )}
            </div>

            {!isPresent ? (
              <Button
                className="h-12 rounded-xl px-6 text-sm font-semibold"
                onClick={handleCheckin}
                disabled={acting}
              >
                {acting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MapPin className="h-4 w-4 mr-2" />}
                Fazer check-in
              </Button>
            ) : (
              <Button
                variant="outline"
                className="h-12 rounded-xl px-6 text-sm font-semibold border-destructive/30 text-destructive"
                onClick={handleCheckout}
                disabled={acting}
              >
                {acting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
                Check-out
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Manual confirmation dialog ── */}
      <AlertDialog open={!!confirmManual} onOpenChange={() => setConfirmManual(null)}>
        <AlertDialogContent className="max-w-[380px] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Check-in manual</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmManual?.reason}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmManual(null);
                doCheckin("manual");
              }}
            >
              Confirmar check-in
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Success bottom sheet ── */}
      <Sheet open={showSuccess} onOpenChange={setShowSuccess}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-10 max-w-[480px] mx-auto">
          <SheetHeader className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 mb-2">
              <PartyPopper className="h-8 w-8 text-emerald-400" />
            </div>
            <SheetTitle className="text-xl">Presente na festa 🎉</SheetTitle>
            <SheetDescription>
              Você já pode acessar o cardápio e fazer seus pedidos.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3 mt-6">
            <Button
              className="w-full h-12 rounded-xl text-base font-semibold"
              onClick={() => {
                setShowSuccess(false);
                navigate("/app/cardapio");
              }}
            >
              Ir para o cardápio
            </Button>
            <Button
              variant="ghost"
              className="w-full h-12 rounded-xl text-muted-foreground"
              onClick={() => setShowSuccess(false)}
            >
              Fechar
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
