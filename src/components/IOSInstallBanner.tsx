import { useState, useEffect } from "react";
import { X, ChevronDown, PlusSquare } from "lucide-react";

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
    <div className="fixed bottom-20 left-0 right-0 z-50 mx-4">
      <div
        className="relative rounded-2xl border border-border/60 bg-card p-5 shadow-[0_-4px_30px_rgba(0,0,0,0.5)]"
      >
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground active:scale-95"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Title */}
        <p className="text-base font-bold text-foreground">Instale o Close Out</p>
        <p className="mb-4 text-xs text-muted-foreground">
          Adicione à sua tela inicial em 2 passos:
        </p>

        {/* Steps grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Step 1 */}
          <div className="flex flex-col items-center gap-2 rounded-xl bg-white/[0.04] p-3 text-center">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
              1
            </div>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8 text-primary"
            >
              <path d="M12 3v12" />
              <path d="M8 7l4-4 4 4" />
              <rect x="4" y="11" width="16" height="10" rx="2" />
            </svg>
            <p className="text-[11px] leading-tight text-muted-foreground">
              Toque no ícone de compartilhar
            </p>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col items-center gap-2 rounded-xl bg-white/[0.04] p-3 text-center">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
              2
            </div>
            <PlusSquare className="h-8 w-8 text-primary" />
            <p className="text-[11px] leading-tight text-muted-foreground">
              Selecione "Adicionar à Tela de Início"
            </p>
          </div>
        </div>

        {/* Bouncing arrow */}
        <div className="mt-3 flex justify-center">
          <ChevronDown className="h-5 w-5 animate-bounce text-primary" />
        </div>
      </div>
    </div>
  );
}
