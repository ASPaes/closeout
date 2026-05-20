import { useState, useEffect } from "react";
import { Upload, X } from "lucide-react";

const DISMISS_KEY = "ios_install_dismissed";
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export function IOSInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !("standalone" in window.navigator && (window.navigator as any).standalone);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

    if (!isIOS || !isSafari) return;

    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const elapsed = Date.now() - parseInt(dismissedAt, 10);
      if (elapsed < COOLDOWN_MS) return;
    }

    setVisible(true);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 mx-auto max-w-[480px] px-4">
      <div className="relative flex items-start gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-lg">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Upload className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Instale o Close Out</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Toque em{" "}
            <Upload className="inline-block h-3 w-3 text-muted-foreground" />{" "}
            e depois "Adicionar à Tela de Início"
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground active:scale-95"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
