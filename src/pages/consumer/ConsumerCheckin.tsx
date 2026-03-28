import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapPin, CheckCircle2, Eye, EyeOff, LogOut, Users, Loader2, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useConsumer } from "@/contexts/ConsumerContext";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import { supabase } from "@/integrations/supabase/client";
import { getLocation, vibrate } from "@/lib/native-bridge";
import { logAudit } from "@/lib/audit";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371e3;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type CheckinRow = {
  id: string;
  is_visible: boolean;
  checked_in_at: string;
};

export default function ConsumerCheckin() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { activeEvent } = useConsumer();
  const navigate = useNavigate();

  const [checkin, setCheckin] = useState<CheckinRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCheckin = useCallback(async () => {
    if (!user || !activeEvent) { setLoading(false); return; }
    const { data } = await supabase
      .from("event_checkins")
      .select("id, is_visible, checked_in_at")
      .eq("user_id", user.id)
      .eq("event_id", activeEvent.id)
      .is("checked_out_at", null)
      .maybeSingle();
    setCheckin(data as CheckinRow | null);
    setLoading(false);
  }, [user, activeEvent]);

  useEffect(() => { fetchCheckin(); }, [fetchCheckin]);

  const handleCheckin = async () => {
    if (!user || !activeEvent) return;
    setActing(true);
    setError(null);

    const loc = await getLocation();
    if (!loc) {
      setError("Não foi possível obter sua localização. Ative o GPS.");
      setActing(false);
      return;
    }

    // Validate radius — fetch venue coords
    const { data: eventData } = await supabase
      .from("events")
      .select("geo_radius_meters, venues!inner(latitude, longitude)")
      .eq("id", activeEvent.id)
      .maybeSingle();

    if (eventData) {
      const venue = (eventData as any).venues;
      const radius = eventData.geo_radius_meters || 500;
      if (venue?.latitude && venue?.longitude) {
        const dist = haversineDistance(loc.lat, loc.lng, Number(venue.latitude), Number(venue.longitude));
        if (dist > radius) {
          setError(`Você está a ${Math.round(dist)}m do evento. Máximo: ${radius}m.`);
          setActing(false);
          return;
        }
      }
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("event_checkins")
      .insert({
        user_id: user.id,
        event_id: activeEvent.id,
        client_id: activeEvent.client_id,
        latitude: loc.lat,
        longitude: loc.lng,
        check_in_method: "gps",
        is_visible: true,
      })
      .select("id, is_visible, checked_in_at")
      .single();

    if (insertErr) {
      setError("Erro ao fazer check-in. Tente novamente.");
      setActing(false);
      return;
    }

    await logAudit({
      action: "CONSUMER_CHECKIN",
      entityType: "event_checkin",
      entityId: inserted.id,
      metadata: { event_id: activeEvent.id, lat: loc.lat, lng: loc.lng },
    });

    vibrate(100);
    toast.success("Check-in realizado!");
    setCheckin(inserted as CheckinRow);
    setActing(false);
  };

  const handleCheckout = async () => {
    if (!checkin) return;
    setActing(true);
    await supabase
      .from("event_checkins")
      .update({ checked_out_at: new Date().toISOString() })
      .eq("id", checkin.id);

    await logAudit({
      action: "CONSUMER_CHECKOUT",
      entityType: "event_checkin",
      entityId: checkin.id,
    });

    toast("Check-out realizado");
    setCheckin(null);
    setActing(false);
  };

  const toggleVisibility = async () => {
    if (!checkin) return;
    const newVal = !checkin.is_visible;
    await supabase
      .from("event_checkins")
      .update({ is_visible: newVal })
      .eq("id", checkin.id);
    setCheckin({ ...checkin, is_visible: newVal });
    toast(newVal ? "Visibilidade ativada" : "Visibilidade desativada");
  };

  if (!activeEvent) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4 pb-20">
        <MapPin className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-base font-semibold text-foreground">Nenhum evento selecionado</p>
        <p className="text-sm text-muted-foreground">Selecione um evento para fazer check-in</p>
        <Button variant="outline" className="rounded-xl border-white/[0.08]" onClick={() => navigate("/app")}>
          Ver eventos
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 pb-20">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-20">
      <h1 className="text-[28px] font-extrabold text-foreground leading-tight tracking-tight">
        Check-in
      </h1>
      <p className="text-sm text-muted-foreground -mt-3">{activeEvent.name}</p>

      {!checkin ? (
        /* Not checked in */
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-5">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <MapPin className="h-8 w-8 text-primary" />
            </div>
            <p className="text-base font-semibold text-foreground">Confirme sua presença</p>
            <p className="text-sm text-muted-foreground">
              Usaremos sua localização para validar a proximidade do evento
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-3">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          <Button
            className="w-full h-14 rounded-xl text-base font-semibold"
            onClick={handleCheckin}
            disabled={acting}
          >
            {acting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <MapPin className="h-5 w-5 mr-2" />}
            {acting ? "Verificando..." : "Fazer Check-in"}
          </Button>
        </div>
      ) : (
        /* Checked in */
        <div className="space-y-4">
          {/* Status card */}
          <div className="rounded-2xl border border-success/20 bg-success/5 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/20">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">Check-in realizado</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(checkin.checked_in_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>

            {/* Visibility toggle */}
            <div className="flex items-center justify-between rounded-xl bg-white/[0.04] border border-white/[0.06] p-3">
              <div className="flex items-center gap-2">
                {checkin.is_visible ? (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm text-foreground">Visível para outros</span>
              </div>
              <Switch checked={checkin.is_visible} onCheckedChange={toggleVisibility} />
            </div>
          </div>

          {/* Actions */}
          <Button
            variant="outline"
            className="w-full h-12 rounded-xl border-white/[0.08] text-foreground"
            onClick={() => navigate("/app/presentes")}
          >
            <Users className="h-4 w-4 mr-2" />
            Ver quem está aqui
          </Button>

          <Button
            variant="outline"
            className="w-full h-12 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={handleCheckout}
            disabled={acting}
          >
            {acting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
            Fazer Check-out
          </Button>
        </div>
      )}
    </div>
  );
}
