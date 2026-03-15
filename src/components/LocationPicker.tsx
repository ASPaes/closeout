import { useEffect, useRef, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Locate, Loader2, Search } from "lucide-react";
import { useTranslation } from "@/i18n/use-translation";
import { toast } from "sonner";

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const DEFAULT_CENTER: [number, number] = [-23.5505, -46.6333];
const DEFAULT_ZOOM = 12;

interface LocationPickerProps {
  latitude: string;
  longitude: string;
  onLocationChange: (lat: string, lng: string) => void;
  address?: string;
  city?: string;
  state?: string;
}

function DraggableMarker({ position, onDrag }: { position: [number, number]; onDrag: (lat: number, lng: number) => void }) {
  const markerRef = useRef<L.Marker>(null);

  const eventHandlers = {
    dragend() {
      const marker = markerRef.current;
      if (marker) {
        const { lat, lng } = marker.getLatLng();
        onDrag(lat, lng);
      }
    },
  };

  return <Marker draggable position={position} ref={markerRef} eventHandlers={eventHandlers} />;
}

function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyToPosition({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(position, Math.max(map.getZoom(), 15), { duration: 0.8 });
  }, [position[0], position[1]]);
  return null;
}

export function LocationPicker({ latitude, longitude, onLocationChange, address, city, state }: LocationPickerProps) {
  const { t } = useTranslation();
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [hasMarker, setHasMarker] = useState(false);
  const [markerPos, setMarkerPos] = useState<[number, number]>(DEFAULT_CENTER);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const lastGeocode = useRef(0);

  // Init from props
  useEffect(() => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      setMarkerPos([lat, lng]);
      setHasMarker(true);
      setFlyTarget([lat, lng]);
    }
  }, []);

  const setPosition = useCallback((lat: number, lng: number) => {
    setMarkerPos([lat, lng]);
    setHasMarker(true);
    setFlyTarget([lat, lng]);
    onLocationChange(lat.toFixed(6), lng.toFixed(6));
  }, [onLocationChange]);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setPosition(lat, lng);
  }, [setPosition]);

  const handleDrag = useCallback((lat: number, lng: number) => {
    setMarkerPos([lat, lng]);
    onLocationChange(lat.toFixed(6), lng.toFixed(6));
  }, [onLocationChange]);

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setPosition(pos.coords.latitude, pos.coords.longitude); setLocating(false); },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [setPosition]);

  const geocodeAddress = useCallback(async () => {
    const now = Date.now();
    if (now - lastGeocode.current < 2000) return; // rate limit 2s
    lastGeocode.current = now;

    const parts = [address, city, state].filter(Boolean).join(", ");
    if (!parts.trim()) { toast.error(t("gvn_geocode_empty")); return; }

    setGeocoding(true);
    try {
      const q = encodeURIComponent(parts);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`, {
        headers: { "Accept-Language": "pt-BR" },
      });
      const data = await res.json();
      if (data.length > 0) {
        setPosition(parseFloat(data[0].lat), parseFloat(data[0].lon));
      } else {
        toast.warning(t("gvn_geocode_not_found"));
      }
    } catch {
      toast.error(t("gvn_geocode_error"));
    } finally {
      setGeocoding(false);
    }
  }, [address, city, state, setPosition, t]);

  const center: [number, number] = hasMarker ? markerPos : DEFAULT_CENTER;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">{t("gvn_map_hint")}</p>
        <div className="flex gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={geocodeAddress} disabled={geocoding} className="text-xs gap-1.5">
            {geocoding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
            {t("gvn_geocode_btn")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={useMyLocation} disabled={locating} className="text-xs gap-1.5">
            {locating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Locate className="h-3 w-3" />}
            {t("gvn_use_my_location")}
          </Button>
        </div>
      </div>
      <div className="rounded-lg overflow-hidden border border-border/60" style={{ height: 260 }}>
        <MapContainer
          center={center}
          zoom={hasMarker ? 15 : DEFAULT_ZOOM}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onClick={handleMapClick} />
          {flyTarget && <FlyToPosition position={flyTarget} />}
          {hasMarker && <DraggableMarker position={markerPos} onDrag={handleDrag} />}
        </MapContainer>
      </div>
    </div>
  );
}
