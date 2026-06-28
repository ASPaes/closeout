import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Banknote, Smartphone, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useConsumer } from "@/contexts/ConsumerContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type FlowState = "choose" | "caixa" | "pix" | "processing";

type CloseResult = {
  comanda_id: string;
  order_id: string;
  payment_id: string;
  amount: number;
  event_id: string;
  client_id: string;
};

export default function ConsumerComandaFinalizar() {
  const navigate = useNavigate();
  const { activeComanda } = useConsumer();
  const { profile } = useAuth();

  const [flowState, setFlowState] = useState<FlowState>("choose");
  const [pixData, setPixData] = useState<{
    qr: string;
    copyPaste: string;
    expiresAt: string | null;
  } | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const orderIdRef = useRef<string | null>(null);
  const paymentIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeComanda) navigate("/app/comanda");
  }, [activeComanda, navigate]);

  // Countdown
  useEffect(() => {
    if (flowState !== "pix" || !pixData?.expiresAt) return;
    const tick = () => {
      const diff = Math.max(
        0,
        Math.floor((new Date(pixData.expiresAt!).getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(diff);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [flowState, pixData]);

  // Realtime listener
  useEffect(() => {
    if (flowState !== "pix" || !paymentIdRef.current) return;
    const paymentId = paymentIdRef.current;
    const channel = supabase
      .channel(`comanda-pay-${paymentId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "payments",
          filter: `id=eq.${paymentId}`,
        },
        (payload: any) => {
          if (payload.new?.status === "approved" && orderIdRef.current) {
            navigate(`/app/comanda/comprovante?order=${orderIdRef.current}`);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [flowState, navigate]);

  const startPix = useCallback(async () => {
    if (!activeComanda) return;
    setFlowState("processing");
    try {
      const { data: closeData, error: closeErr } = await supabase.rpc(
        "close_comanda_app",
        { p_comanda_id: activeComanda.id, p_payment_method: "pix" },
      );
      if (closeErr || !closeData) {
        throw new Error(closeErr?.message ?? "Erro ao finalizar comanda");
      }
      const result = closeData as unknown as CloseResult;

      const { data: chargeData, error: chargeErr } =
        await supabase.functions.invoke("asaas-create-charge", {
          body: {
            payment_id: result.payment_id,
            order_id: result.order_id,
            amount: result.amount,
            event_id: result.event_id,
            client_id: result.client_id,
            billing_type: "PIX",
            payment_cpf: profile?.cpf,
          },
        });
      if (chargeErr) throw new Error(chargeErr.message);
      if (chargeData?.error) throw new Error(chargeData.error);
      if (!chargeData?.pix_qr_code) throw new Error("PIX indisponível");

      orderIdRef.current = result.order_id;
      paymentIdRef.current = result.payment_id;
      setAmount(Number(result.amount ?? 0));
      setPixData({
        qr: chargeData.pix_qr_code,
        copyPaste: chargeData.pix_copy_paste,
        expiresAt: chargeData.pix_expires_at ?? null,
      });
      setFlowState("pix");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao gerar PIX");
      setFlowState("choose");
    }
  }, [activeComanda, profile?.cpf]);

  const handleCopy = async () => {
    if (!pixData?.copyPaste) return;
    try {
      await navigator.clipboard.writeText(pixData.copyPaste);
      toast.success("Copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handleRefresh = async () => {
    if (!paymentIdRef.current) return;
    const { data } = await supabase
      .from("payments")
      .select("status")
      .eq("id", paymentIdRef.current)
      .maybeSingle();
    if (data?.status === "approved" && orderIdRef.current) {
      navigate(`/app/comanda/comprovante?order=${orderIdRef.current}`);
    } else {
      toast("Pagamento ainda não confirmado");
    }
  };

  if (!activeComanda) return null;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col gap-5 pb-28 max-w-[480px] mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            if (flowState === "choose") navigate(-1);
            else setFlowState("choose");
          }}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08] active:scale-95 transition-transform"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold text-foreground">Finalizar comanda</h1>
          <p className="text-xs text-muted-foreground">
            Comanda #{activeComanda.card_number}
          </p>
        </div>
      </div>

      {flowState === "choose" && (
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setFlowState("caixa")}
            className={cn(
              "flex items-center gap-4 h-[100px] rounded-xl border px-5 transition-all active:scale-[0.98]",
              "border-white/10 bg-white/[0.04] hover:border-primary hover:bg-primary/10",
            )}
          >
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Banknote className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-base font-bold text-foreground">Pagar no caixa</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Vá até o caixa para finalizar
              </p>
            </div>
          </button>

          <button
            onClick={startPix}
            className={cn(
              "flex items-center gap-4 h-[100px] rounded-xl border px-5 transition-all active:scale-[0.98]",
              "border-white/10 bg-white/[0.04] hover:border-primary hover:bg-primary/10",
            )}
          >
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Smartphone className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-base font-bold text-foreground">Pagar pelo app</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                PIX direto pelo celular
              </p>
            </div>
          </button>
        </div>
      )}

      {flowState === "caixa" && (
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border border-primary/20 p-6 bg-primary/5 text-center">
            <Banknote className="h-10 w-10 text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-1">Sua comanda</p>
            <p className="text-3xl font-extrabold text-foreground">
              #{activeComanda.card_number}
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              Vá até o caixa e informe sua comanda. O caixa finaliza seu pagamento.
            </p>
          </div>
          <Button
            onClick={() => setFlowState("choose")}
            variant="outline"
            className="h-14 rounded-2xl"
          >
            Voltar
          </Button>
        </div>
      )}

      {flowState === "processing" && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Gerando pagamento...</p>
        </div>
      )}

      {flowState === "pix" && pixData && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-white p-5 flex flex-col items-center gap-3">
            <img
              src={`data:image/png;base64,${pixData.qr}`}
              alt="QR Code PIX"
              className="w-full max-w-[260px] aspect-square"
            />
            <p className="text-xs text-black/60">Aponte a câmera do banco</p>
          </div>

          <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
            <p className="text-3xl font-extrabold text-primary">
              R$ {amount.toFixed(2)}
            </p>
            {secondsLeft !== null && (
              <p className="text-xs text-muted-foreground mt-2">
                {secondsLeft > 0
                  ? `Expira em ${formatTime(secondsLeft)}`
                  : "PIX expirado"}
              </p>
            )}
          </div>

          <Button
            onClick={handleCopy}
            className="h-14 rounded-2xl text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
            style={{ boxShadow: "0 8px 32px hsl(24 100% 50% / 0.35)" }}
          >
            <Copy className="h-5 w-5 mr-2" />
            Copiar código
          </Button>

          <Button
            onClick={handleRefresh}
            variant="outline"
            className="h-12 rounded-2xl"
          >
            Já paguei / atualizar
          </Button>
        </div>
      )}
    </div>
  );
}