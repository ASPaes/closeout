import { useState, useEffect } from "react";
import { ArrowLeft, CreditCard, Smartphone, Plus, CheckCircle2, XCircle, Loader2, Shield, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useConsumer } from "@/contexts/ConsumerContext";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import { supabase } from "@/integrations/supabase/client";
import { getLocation } from "@/lib/native-bridge";
import { logAudit } from "@/lib/audit";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type SavedCard = {
  id: string;
  card_brand: string | null;
  card_last_four: string;
  method_type: string;
  is_default: boolean | null;
};

type PaymentMethod = "pix" | "credit_card" | "debit_card" | "saved";
type FlowState = "select" | "processing" | "success" | "error";

export default function ConsumerPagamento() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cart, activeEvent, clearCart, refreshActiveOrder, setActiveOrder } = useConsumer();

  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("pix");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [flowState, setFlowState] = useState<FlowState>("select");
  const [errorMessage, setErrorMessage] = useState("");
  const [limitWarning, setLimitWarning] = useState<{ limit: number; alreadySpent: number; willSpend: number } | null>(null);

  // Check spending limit
  useEffect(() => {
    if (!user || !activeEvent) return;
    (async () => {
      const { data: limRow } = await supabase
        .from("user_consumption_limits")
        .select("max_order_value, is_active")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!limRow || !limRow.max_order_value) return;

      const limit = limRow.max_order_value;

      // Sum already spent in this event
      const { data: spentData } = await supabase
        .from("orders")
        .select("total")
        .eq("consumer_id", user.id)
        .eq("event_id", activeEvent.id)
        .in("status", ["paid", "preparing", "ready", "delivered"]);

      const alreadySpent = (spentData || []).reduce((s: number, o: any) => s + Number(o.total), 0);
      const willSpend = alreadySpent + cart.total;

      if (willSpend > limit) {
        setLimitWarning({ limit, alreadySpent, willSpend });
      } else {
        setLimitWarning(null);
      }
    })();
  }, [user, activeEvent, cart.total]);

  // Fetch saved cards
  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_payment_methods")
      .select("id, card_brand, card_last_four, method_type, is_default")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setSavedCards(data);
          const def = data.find((c) => c.is_default);
          if (def) {
            setSelectedMethod("saved");
            setSelectedCardId(def.id);
          }
        }
      });
  }, [user]);

  // Silent GPS
  useEffect(() => {
    getLocation().catch(() => {});
  }, []);

  // Redirect if cart empty
  useEffect(() => {
    if (cart.items.length === 0 && flowState === "select") {
      navigate("/app/cardapio", { replace: true });
    }
  }, [cart.items.length, flowState, navigate]);

  const getPaymentMethodString = (): string => {
    if (selectedMethod === "pix") return "pix";
    if (selectedMethod === "saved") {
      const card = savedCards.find((c) => c.id === selectedCardId);
      return card?.method_type === "debit" ? "debit_card" : "credit_card";
    }
    return "credit_card";
  };

  const handleConfirm = async () => {
    if (!activeEvent || !user || cart.items.length === 0) return;

    setFlowState("processing");
    setErrorMessage("");

    try {
      const paymentMethod = getPaymentMethodString();

      const items = cart.items.map((i) => ({
        ...(i.type === "product" ? { product_id: i.id } : { combo_id: i.id }),
        quantity: i.quantity,
      }));

      const { data, error } = await supabase.rpc("create_consumer_order", {
        params: {
          event_id: activeEvent.id,
          payment_method: paymentMethod,
          items,
        },
      });

      if (error) throw new Error(error.message);

      const result = data as any;
      const orderId = result?.order_id;
      const orderNumber = result?.order_number;
      const qrToken = result?.qr_token;
      const total = result?.total;

      // Set active order immediately so QR page shows it
      setActiveOrder({
        id: orderId,
        order_number: orderNumber,
        status: "paid",
        total: total,
        qr_token: qrToken,
        items: cart.items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          unit_price: i.price,
          delivered_quantity: 0,
        })),
      });

      // Audit log (best-effort)
      try {
        await logAudit({
          action: "CONSUMER_ORDER_CREATED",
          entityType: "order",
          entityId: orderId,
          metadata: {
            event_id: activeEvent.id,
            payment_method: paymentMethod,
            total,
            items_count: cart.items.length,
          },
        });
      } catch {
        // ignore audit errors
      }

      clearCart();
      setFlowState("success");

      // Navigate after brief success display
      setTimeout(() => {
        navigate(`/app/qr?order=${orderId}`, { replace: true });
      }, 1500);
    } catch (err: any) {
      console.error("Payment error:", err);
      setErrorMessage(err.message || "Erro ao processar pagamento");
      setFlowState("error");
    }
  };

  const handleCancel = async () => {
    navigate(-1);
  };

  const handleRetry = () => {
    setFlowState("select");
    setErrorMessage("");
  };

  // ── Processing fullscreen ──
  if (flowState === "processing") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background">
        <div className="relative">
          <div className="h-20 w-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-bold text-foreground">{t("consumer_payment_processing")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("consumer_payment_wait")}</p>
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5" />
          {t("consumer_payment_secure")}
        </p>
      </div>
    );
  }

  // ── Success fullscreen ──
  if (flowState === "success") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/10 border border-success/30">
          <CheckCircle2 className="h-10 w-10 text-success" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-bold text-foreground">{t("consumer_payment_success")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("consumer_payment_redirect")}</p>
        </div>
      </div>
    );
  }

  // ── Error fullscreen ──
  if (flowState === "error") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background px-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 border border-destructive/30">
          <XCircle className="h-10 w-10 text-destructive" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-bold text-foreground">{t("consumer_payment_error")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{errorMessage}</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-[320px]">
          <Button
            onClick={handleRetry}
            className="h-14 rounded-2xl text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground w-full"
          >
            {t("consumer_payment_retry")}
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate("/app/carrinho")}
            className="h-12 rounded-xl text-sm text-muted-foreground"
          >
            {t("consumer_payment_back_cart")}
          </Button>
        </div>
      </div>
    );
  }

  // ── Select payment method ──
  return (
    <div className="flex flex-col gap-5 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleCancel}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08] active:scale-95 transition-transform"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-xl font-extrabold text-foreground">{t("consumer_payment_title")}</h1>
      </div>

      {/* Order summary */}
      <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">{t("consumer_payment_summary")}</h3>
        <div className="flex flex-col gap-1.5">
          {cart.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-muted-foreground truncate mr-2">
                {item.quantity}x {item.name}
              </span>
              <span className="text-foreground font-medium shrink-0">
                R$ {(item.price * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
          <div className="border-t border-white/[0.06] pt-2 mt-1 flex justify-between">
            <span className="text-base font-bold text-foreground">{t("consumer_total")}</span>
            <span className="text-base font-bold text-primary">R$ {cart.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Payment methods */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{t("consumer_payment_method")}</h3>

        {/* PIX */}
        <button
          onClick={() => { setSelectedMethod("pix"); setSelectedCardId(null); }}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl border p-4 text-left active:scale-[0.99] transition-all",
            selectedMethod === "pix"
              ? "border-primary/50 bg-primary/5"
              : "border-white/[0.08] bg-white/[0.02]"
          )}
        >
          <div className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl shrink-0",
            selectedMethod === "pix" ? "bg-primary/20" : "bg-white/[0.06]"
          )}>
            <Smartphone className={cn("h-5 w-5", selectedMethod === "pix" ? "text-primary" : "text-muted-foreground")} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">PIX</p>
            <p className="text-xs text-muted-foreground">{t("consumer_payment_pix_desc")}</p>
          </div>
          <div className={cn(
            "h-5 w-5 rounded-full border-2 flex items-center justify-center",
            selectedMethod === "pix" ? "border-primary" : "border-white/20"
          )}>
            {selectedMethod === "pix" && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
          </div>
        </button>

        {/* Saved cards */}
        {savedCards.map((card) => (
          <button
            key={card.id}
            onClick={() => { setSelectedMethod("saved"); setSelectedCardId(card.id); }}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border p-4 text-left active:scale-[0.99] transition-all",
              selectedMethod === "saved" && selectedCardId === card.id
                ? "border-primary/50 bg-primary/5"
                : "border-white/[0.08] bg-white/[0.02]"
            )}
          >
            <div className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl shrink-0",
              selectedMethod === "saved" && selectedCardId === card.id ? "bg-primary/20" : "bg-white/[0.06]"
            )}>
              <CreditCard className={cn("h-5 w-5",
                selectedMethod === "saved" && selectedCardId === card.id ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                {card.card_brand || "Cartão"} ••••{card.card_last_four}
              </p>
              <p className="text-xs text-muted-foreground capitalize">{card.method_type}</p>
            </div>
            <div className={cn(
              "h-5 w-5 rounded-full border-2 flex items-center justify-center",
              selectedMethod === "saved" && selectedCardId === card.id ? "border-primary" : "border-white/20"
            )}>
              {selectedMethod === "saved" && selectedCardId === card.id && (
                <div className="h-2.5 w-2.5 rounded-full bg-primary" />
              )}
            </div>
          </button>
        ))}

        {/* New card (credit) */}
        <button
          onClick={() => { setSelectedMethod("credit_card"); setSelectedCardId(null); }}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl border p-4 text-left active:scale-[0.99] transition-all",
            selectedMethod === "credit_card"
              ? "border-primary/50 bg-primary/5"
              : "border-white/[0.08] bg-white/[0.02]"
          )}
        >
          <div className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl shrink-0",
            selectedMethod === "credit_card" ? "bg-primary/20" : "bg-white/[0.06]"
          )}>
            <Plus className={cn("h-5 w-5", selectedMethod === "credit_card" ? "text-primary" : "text-muted-foreground")} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">{t("consumer_payment_new_card")}</p>
            <p className="text-xs text-muted-foreground">{t("consumer_payment_new_card_desc")}</p>
          </div>
          <div className={cn(
            "h-5 w-5 rounded-full border-2 flex items-center justify-center",
            selectedMethod === "credit_card" ? "border-primary" : "border-white/20"
          )}>
            {selectedMethod === "credit_card" && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
          </div>
        </button>
      </div>

      {/* Security note */}
      <p className="text-[11px] text-muted-foreground/60 text-center flex items-center justify-center gap-1.5">
        <Shield className="h-3.5 w-3.5" />
        {t("consumer_payment_secure")}
      </p>


      {/* Spending limit warning */}
      {limitWarning && (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 animate-in fade-in slide-in-from-top-2">
          <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-300">Limite de gastos atingido</p>
            <p className="text-xs text-amber-200/70 mt-1 leading-relaxed">
              Seu limite para esta noite é de{" "}
              <strong>R$ {limitWarning.limit.toFixed(2)}</strong>. Você já gastou{" "}
              <strong>R$ {limitWarning.alreadySpent.toFixed(2)}</strong> e com este pedido totalizará{" "}
              <strong>R$ {limitWarning.willSpend.toFixed(2)}</strong>.
            </p>
            <p className="text-[11px] text-amber-200/50 mt-1.5">
              A compra não será bloqueada, mas fique atento aos seus gastos.
            </p>
          </div>
        </div>
      )}

      {/* Confirm button */}
      <Button
        onClick={handleConfirm}
        disabled={cart.items.length === 0}
        className="h-14 rounded-2xl text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl active:scale-[0.98] transition-transform w-full"
        style={{ boxShadow: "0 8px 32px hsl(24 100% 50% / 0.35)" }}
      >
        {t("consumer_payment_confirm")} · R$ {cart.total.toFixed(2)}
      </Button>
    </div>
  );
}
