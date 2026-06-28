import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useConsumer } from "@/contexts/ConsumerContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ScanLine,
  Camera,
  Keyboard,
  XCircle,
  ArrowLeft,
  Loader2,
} from "lucide-react";

type ViewState = "scanner" | "loading" | "error";

export default function ConsumerComandaScan() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setActiveComanda } = useConsumer();

  const [viewState, setViewState] = useState<ViewState>("scanner");
  const [useCamera, setUseCamera] = useState(true);
  const [manualToken, setManualToken] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const scannerRef = useRef<any>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const isProcessingRef = useRef(false);

  const handleScan = useCallback(
    async (token: string) => {
      if (!user?.id || !token.trim() || isProcessingRef.current) return;
      isProcessingRef.current = true;
      setViewState("loading");

      try {
        if (scannerRef.current) {
          try {
            await scannerRef.current.stop();
          } catch {
            /* ignore */
          }
        }

        const { data, error } = await supabase.rpc("open_comanda", {
          p_qr_token: token.trim(),
        });

        if (error) {
          setErrorMsg(error.message);
          setViewState("error");
          return;
        }

        const res = data as {
          comanda_id: string;
          card_number: number;
          event_id: string;
          event_name: string;
          consumer_name: string;
          status: string;
        };

        setActiveComanda({
          id: res.comanda_id,
          card_number: res.card_number,
          status: res.status || "open",
        });

        toast.success(`Comanda #${res.card_number} aberta`);
        navigate(`/app/evento/${eventId}`);
      } catch (err: any) {
        setErrorMsg(err.message || "Erro ao abrir comanda");
        setViewState("error");
      } finally {
        isProcessingRef.current = false;
      }
    },
    [user?.id, eventId, navigate, setActiveComanda],
  );

  // Camera scanner
  useEffect(() => {
    if (viewState !== "scanner" || !useCamera || !videoContainerRef.current) return;
    let html5QrCode: any = null;
    let mounted = true;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!mounted) return;
        html5QrCode = new Html5Qrcode("comanda-qr-reader");
        scannerRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            if (!isProcessingRef.current) handleScan(decodedText);
          },
          () => {},
        );
      } catch (err) {
        console.error("Camera error:", err);
      }
    };

    startScanner();

    return () => {
      mounted = false;
      if (html5QrCode) {
        try {
          html5QrCode.stop();
        } catch {
          /* ignore */
        }
      }
      scannerRef.current = null;
    };
  }, [viewState, useCamera, handleScan]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualToken.trim()) handleScan(manualToken.trim());
  };

  const handleBack = () => {
    navigate(`/app/evento/${eventId}`);
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="max-w-[480px] mx-auto px-4 h-14 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-full"
            onClick={handleBack}
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Leia o QR da comanda</h1>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-[480px] mx-auto w-full">
        {/* Loading */}
        {viewState === "loading" && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <p className="text-lg text-muted-foreground">Abrindo comanda...</p>
          </div>
        )}

        {/* Error */}
        {viewState === "error" && (
          <div className="max-w-lg mx-auto space-y-4">
            <Card className="bg-destructive/20 border-destructive/50">
              <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-4">
                <XCircle className="h-20 w-20 text-destructive" />
                <h2 className="text-xl font-bold text-foreground">Não foi possível abrir</h2>
                <p className="text-muted-foreground">{errorMsg}</p>
                <Button
                  className="w-full h-14 rounded-2xl text-base"
                  onClick={() => {
                    setViewState("scanner");
                    setErrorMsg("");
                    setManualToken("");
                  }}
                >
                  <ScanLine className="h-5 w-5 mr-2" />
                  Tentar de novo
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Scanner */}
        {viewState === "scanner" && (
          <div className="space-y-4 max-w-lg mx-auto">
            <div className="flex gap-2 justify-center">
              <Button
                variant={useCamera ? "default" : "outline"}
                size="sm"
                onClick={() => setUseCamera(true)}
                className="rounded-xl"
              >
                <Camera className="h-4 w-4 mr-2" />
                Câmera
              </Button>
              <Button
                variant={!useCamera ? "default" : "outline"}
                size="sm"
                onClick={() => setUseCamera(false)}
                className="rounded-xl"
              >
                <Keyboard className="h-4 w-4 mr-2" />
                Digitar
              </Button>
            </div>

            {useCamera ? (
              <Card className="overflow-hidden border-2 border-border">
                <CardContent className="p-0">
                  <div
                    id="comanda-qr-reader"
                    ref={videoContainerRef}
                    className="w-full min-h-[300px]"
                  />
                </CardContent>
              </Card>
            ) : (
              <Card className="border-2 border-border">
                <CardContent className="pt-6">
                  <form onSubmit={handleManualSubmit} className="space-y-4">
                    <Input
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                      placeholder="Código da comanda"
                      autoFocus
                      className="h-12 text-lg"
                    />
                    <Button
                      type="submit"
                      className="w-full h-14 rounded-2xl text-base"
                      disabled={!manualToken.trim()}
                    >
                      <ScanLine className="h-5 w-5 mr-2" />
                      Abrir comanda
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
