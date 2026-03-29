import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/i18n/use-translation";
import { useConsumer } from "@/contexts/ConsumerContext";
import { Calendar, MapPin, ChevronLeft, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";

type EventImage = {
  id: string;
  public_url: string | null;
  storage_path: string;
  sort_order: number;
};

type EventDetail = {
  id: string;
  name: string;
  description: string | null;
  start_at: string | null;
  end_at: string | null;
  status: string;
  client_id: string | null;
  venue_id: string;
  venues?: { name: string; city: string | null; state: string | null };
};

export default function ConsumerEventoCardapio() {
  const { eventId } = useParams<{ eventId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setActiveEvent } = useConsumer();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [images, setImages] = useState<EventImage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    Promise.all([
      supabase
        .from("events")
        .select("id, name, description, start_at, end_at, status, client_id, venue_id, venues(name, city, state)")
        .eq("id", eventId)
        .single(),
      supabase
        .from("event_images")
        .select("id, public_url, storage_path, sort_order")
        .eq("event_id", eventId)
        .order("sort_order"),
    ]).then(([evRes, imgRes]) => {
      if (evRes.data) setEvent(evRes.data as unknown as EventDetail);
      if (imgRes.data) setImages(imgRes.data);
      setLoading(false);
    });
  }, [eventId]);

  const handleEnter = () => {
    if (!event) return;
    setActiveEvent({ id: event.id, name: event.name, client_id: event.client_id || "" });
    navigate("/app/cardapio");
  };

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
        <p className="text-muted-foreground">{t("consumer_no_events")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-24">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ChevronLeft className="h-4 w-4" />
        {t("back")}
      </button>

      {/* Image carousel / placeholder */}
      <div className="rounded-2xl overflow-hidden border border-border/40">
        {images.length > 0 ? (
          <Carousel className="w-full">
            <CarouselContent>
              {images.map((img) => (
                <CarouselItem key={img.id}>
                  <div className="aspect-[16/9] w-full">
                    <img
                      src={img.public_url || ""}
                      alt={event.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            {images.length > 1 && (
              <>
                <CarouselPrevious className="left-2" />
                <CarouselNext className="right-2" />
              </>
            )}
          </Carousel>
        ) : (
          <div className="aspect-[16/9] w-full bg-gradient-to-br from-primary/20 to-primary/5 flex flex-col items-center justify-center gap-2">
            <ImageIcon className="h-10 w-10 text-primary/30" />
            <span className="text-xs text-muted-foreground">{t("consumer_no_event_images")}</span>
          </div>
        )}
      </div>

      {/* Event info */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-foreground">{event.name}</h1>
        {event.description && (
          <p className="text-sm text-muted-foreground">{event.description}</p>
        )}
        <div className="flex flex-col gap-1.5 mt-1">
          {event.start_at && (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 text-primary" />
              {format(new Date(event.start_at), "EEEE, dd 'de' MMMM · HH'h'mm", { locale: ptBR })}
            </span>
          )}
          {event.venues && (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 text-primary" />
              {event.venues.name}
              {event.venues.city && ` · ${event.venues.city}`}
              {event.venues.state && `, ${event.venues.state}`}
            </span>
          )}
        </div>
      </div>

      {/* CTA */}
      <Button
        onClick={handleEnter}
        className="w-full h-12 rounded-xl text-base font-semibold mt-2"
      >
        {t("consumer_enter_event")}
      </Button>
    </div>
  );
}
