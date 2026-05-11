import { useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { toast } from "sonner";

export function PushPermissionBanner() {
  const { permission, isSubscribed, loading, requestPermissionAndSubscribe } = usePushNotifications();
  const [dismissed, setDismissed] = useState(() => {
    const ts = localStorage.getItem("push_banner_dismissed");
    if (!ts) return false;
    return Date.now() - parseInt(ts) < 24 * 60 * 60 * 1000;
  });

  if (isSubscribed || permission === "denied" || dismissed) return null;
  if (typeof window === "undefined") return null;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return null;

  const handleDismiss = () => {
    localStorage.setItem("push_banner_dismissed", String(Date.now()));
    setDismissed(true);
  };

  const handleActivate = async () => {
    const ok = await requestPermissionAndSubscribe();
    if (ok) {
      toast.success("Notificações ativadas!");
    } else {
      toast.error("Não foi possível ativar notificações");
    }
  };

  return (
    <div className="mx-5 mt-3 rounded-xl border border-border bg-card/80 p-3">
      <div className="flex items-center gap-3">
        <Bell className="h-5 w-5 shrink-0 text-orange-500" />
        <p className="flex-1 text-sm text-foreground">
          Receba alertas sobre seus pedidos
        </p>
        <Button
          size="sm"
          onClick={handleActivate}
          disabled={loading}
          className="h-8 bg-orange-600 px-3 text-white hover:bg-orange-700"
        >
          {loading ? "..." : "Ativar"}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleDismiss}
          className="h-8 w-8 shrink-0"
          aria-label="Dispensar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}