import { useState, useEffect, useRef, useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import { BarEventGuard } from "@/components/BarEventGuard";
import { useTranslation } from "@/i18n/use-translation";
import { useBar } from "@/contexts/BarContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ScanLine, CheckCircle2, XCircle, Camera, Keyboard, Loader2,
} from "lucide-react";

type ValidationResult = {
  success: boolean;
  error?: string;
  message?: string;
  order?: {
    id: string;
    order_number: number;
    total?: number;
    items?: Array<{ name: string; quantity: number; unit_price: number; total: number }>;
    delivered_at?: string;
  };
};

type ViewState = "scanner" | "loading" | "result";

function playBeep(success: boolean) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = success ? 800 : 300;
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    // audio not available
  }
}

export default function BarLeitorQR() {
  const { t } = useTranslation();
  const { eventId } = useBar();
  const { user } = useAuth();

  const [viewState, setViewState] = useState<ViewState>("scanner");
  const [useCamera, setUseCamera] = useState(true);
  const [manualToken, setManualToken] = useState("");
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [resultType, setResultType] = useState<string>("invalid");
  const autoResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scannerRef = useRef<any>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const isProcessingRef = useRef(false);

  const validate = useCallback(async (token: string) => {
    if (!user?.id || !token.trim() || isProcessingRef.current) return;
    isProcessingRef.current = true;
    setViewState("loading");

    try {
      // Stop scanner while validating
      if (scannerRef.current) {
        try { await scannerRef.current.stop(); } catch { /* ignore */ }
      }

      const { data, error } = await supabase.rpc("validate_qr", {
        p_token: token.trim(),
        p_staff_id: user.id,
      });

      if (error) throw error;

      const res = data as unknown as ValidationResult;
      setResult(res);

      if (res.success) {
        setResultType("valid");
        playBeep(true);
      } else if (res.error === "ALREADY_USED") {
        setResultType("already_used");
        playBeep(false);
      } else if (res.error === "CANCELLED") {
        setResultType("cancelled");
        playBeep(false);
      } else {
        setResultType("invalid");
        playBeep(false);
      }

      setViewState("result");

      // Auto-reset after 5 seconds for valid results
      if (res.success) {
        autoResetRef.current = setTimeout(() => resetScanner(), 5000);
      }
    } catch (err: any) {
      setResult({ success: false, error: "UNKNOWN", message: err.message || "Erro desconhecido" });
      setResultType("invalid");
      playBeep(false);
      setViewState("result");
    } finally {
      isProcessingRef.current = false;
    }
  }, [user?.id]);

  const resetScanner = useCallback(() => {
    if (autoResetRef.current) clearTimeout(autoResetRef.current);
    setViewState("scanner");
    setResult(null);
    setResultType("invalid");
    setManualToken("");
    isProcessingRef.current = false;
  }, []);

  // Camera scanner setup
  useEffect(() => {
    if (viewState !== "scanner" || !useCamera || !videoContainerRef.current) return;

    let html5QrCode: any = null;
    let mounted = true;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!mounted) return;

        html5QrCode = new Html5Qrcode("qr-reader-container");
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            if (!isProcessingRef.current) {
              validate(decodedText);
            }
          },
          () => { /* ignore scan failures */ }
        );
      } catch (err) {
        console.error("Camera error:", err);
      }
    };

    startScanner();

    return () => {
      mounted = false;
      if (html5QrCode) {
        try { html5QrCode.stop(); } catch { /* ignore */ }
      }
      scannerRef.current = null;
    };
  }, [viewState, useCamera, validate]);

  // Cleanup auto-reset on unmount
  useEffect(() => {
    return () => {
      if (autoResetRef.current) clearTimeout(autoResetRef.current);
    };
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualToken.trim()) validate(manualToken.trim());
  };

  return (
    <BarEventGuard>
      <div className="space-y-6">
        <PageHeader title={t("bar_qr_reader")} subtitle={t("bar_qr_reader_desc")} icon={ScanLine} />

        {/* Loading state */}
        {viewState === "loading" && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <p className="text-lg text-muted-foreground">{t("bar_qr_validating")}</p>
          </div>
        )}

        {/* Scanner state */}
        {viewState === "scanner" && (
          <div className="space-y-4 max-w-lg mx-auto">
            {/* Toggle camera / manual */}
            <div className="flex gap-2 justify-center">
              <Button
                variant={useCamera ? "default" : "outline"}
                size="sm"
                onClick={() => setUseCamera(true)}
              >
                <Camera className="h-4 w-4 mr-2" />
                {t("bar_qr_camera")}
              </Button>
              <Button
                variant={!useCamera ? "default" : "outline"}
                size="sm"
                onClick={() => setUseCamera(false)}
              >
                <Keyboard className="h-4 w-4 mr-2" />
                {t("bar_qr_manual")}
              </Button>
            </div>

            {useCamera ? (
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div
                    id="qr-reader-container"
                    ref={videoContainerRef}
                    className="w-full min-h-[300px]"
                  />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <form onSubmit={handleManualSubmit} className="space-y-4">
                    <Input
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                      placeholder={t("bar_qr_token_placeholder")}
                      autoFocus
                      className="text-lg"
                    />
                    <Button type="submit" className="w-full" disabled={!manualToken.trim()}>
                      <ScanLine className="h-4 w-4 mr-2" />
                      {t("bar_validate")}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Result state */}
        {viewState === "result" && result && (
          <ResultCard
            result={result}
            resultType={resultType}
            onReset={resetScanner}
            t={t}
          />
        )}
      </div>
    </BarEventGuard>
  );
}

function ResultCard({
  result,
  resultType,
  onReset,
  t,
}: {
  result: ValidationResult;
  resultType: string;
  onReset: () => void;
  t: (key: string) => string;
}) {
  const isValid = resultType === "valid";
  const bgClass = isValid ? "bg-green-500/20 border-green-500/50" : "bg-destructive/20 border-destructive/50";
  const Icon = isValid ? CheckCircle2 : XCircle;
  const iconColor = isValid ? "text-green-500" : "text-destructive";

  const titleMap: Record<string, string> = {
    valid: t("bar_qr_result_valid"),
    already_used: t("bar_qr_used"),
    cancelled: t("bar_qr_cancelled"),
    invalid: t("bar_qr_invalid"),
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <Card className={`${bgClass} border-2`}>
        <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-4">
          <Icon className={`h-20 w-20 ${iconColor}`} />
          <h2 className="text-2xl font-bold">{titleMap[resultType] || titleMap.invalid}</h2>

          {isValid && result.order && (
            <>
              <p className="text-xl font-mono font-bold text-primary">
                {t("bar_qr_order_prefix")} #{String(result.order.order_number).padStart(3, "0")}
              </p>
              <p className="text-muted-foreground">{result.message}</p>
              {result.order.items && result.order.items.length > 0 && (
                <div className="w-full text-left space-y-1 mt-2">
                  <p className="text-sm font-semibold text-muted-foreground">{t("bar_qr_items")}:</p>
                  {result.order.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{item.quantity}x {item.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {resultType === "already_used" && result.order && (
            <p className="text-sm text-muted-foreground">
              {t("bar_qr_order_prefix")} #{String(result.order.order_number).padStart(3, "0")}
              {result.order.delivered_at && (
                <> — {new Date(result.order.delivered_at).toLocaleString("pt-BR")}</>
              )}
            </p>
          )}

          {!isValid && result.message && resultType !== "already_used" && (
            <p className="text-sm text-muted-foreground">{result.message}</p>
          )}
        </CardContent>
      </Card>

      <Button onClick={onReset} className="w-full" size="lg">
        <ScanLine className="h-4 w-4 mr-2" />
        {isValid ? t("bar_qr_next") : t("bar_qr_try_another")}
      </Button>

      {isValid && (
        <p className="text-xs text-center text-muted-foreground">{t("bar_qr_auto_reset")}</p>
      )}
    </div>
  );
}
