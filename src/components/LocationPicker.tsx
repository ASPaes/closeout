import { useEffect, useRef, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Locate, Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n/use-translation";

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

export function LocationPicker({ latitude, longitude, onLocationChange }: LocationPickerProps) {
  const { t } = useTranslation();
  const [locating, setLocating] = useState(false);
  const [hasMarker, setHasMarker] = useState(false);
  const [markerPos, setMarkerPos] = useState<[number, number]>(DEFAULT_CENTER);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);

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

  const handleMapClick = useCallback((lat: number, lng: number) => {
    const pos: [number, number] = [lat, lng];
    setMarkerPos(pos);
    setHasMarker(true);
    onLocationChange(lat.toFixed(6), lng.toFixed(6));
  }, [onLocationChange]);

  const handleDrag = useCallback((lat: number, lng: number) => {
    setMarkerPos([lat, lng]);
    onLocationChange(lat.toFixed(6), lng.toFixed(6));
  }, [onLocationChange]);

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setMarkerPos([lat, lng]);
        setHasMarker(true);
        setFlyTarget([lat, lng]);
        onLocationChange(lat.toFixed(6), lng.toFixed(6));
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [onLocationChange]);

  const center: [number, number] = hasMarker ? markerPos : DEFAULT_CENTER;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{t("gvn_map_hint")}</p>
        <Button type="button" variant="outline" size="sm" onClick={useMyLocation} disabled={locating} className="text-xs gap-1.5">
          {locating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Locate className="h-3 w-3" />}
          {t("gvn_use_my_location")}
        </Button>
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
