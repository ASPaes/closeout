import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="sticky top-14 z-30 mx-auto flex max-w-[480px] items-center gap-2 bg-destructive/90 px-5 py-2 text-sm font-medium text-destructive-foreground backdrop-blur-sm">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>Você está sem conexão</span>
    </div>
  );
}
