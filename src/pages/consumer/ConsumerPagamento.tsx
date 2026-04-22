import { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeft,
  CreditCard,
  Smartphone,
  CheckCircle2,
  XCircle,
  Shield,
  AlertTriangle,
  Banknote,
  Clock,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useConsumer } from "@/contexts/ConsumerContext";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import { supabase } from "@/integrations/supabase/client";
import { getLocation } from "@/lib/native-bridge";
import { logAudit } from "@/lib/audit";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type AsaasCard = {
  id: string;
  card_brand: string | null;
  card_last_four: string;
  card_holder_name: string | null;
  card_token: string;
  is_default: boolean;
};

type PaymentMethod = "pix" | "credit_card" | "debit_card" | "cash";
type FlowState =
  | "select"
  | "processing"
  | "pix_waiting"
  | "pix_waiting_then_card"
  | "cash_waiting_then_card"
  | "charging_card"
  | "success"
  | "success_cash"
  | "card_declined"
  | "card_declined_split"
  | "card_retry_pending"
  | "error";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: "PIX",
  credit_card: "Cartão de Crédito",
  debit_card: "Cartão de Débito",
  cash: "Dinheiro",
};

// ── Card number mask ──
function maskCardNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function isValidCPF(cpf: string): boolean {
  const d = onlyDigits(cpf);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  for (let t = 9; t < 11; t++) {
    let sum = 0;
    for (let c = 0; c < t; c++) sum += parseInt(d[c]) * ((t + 1) - c);
    sum = ((10 * sum) % 11) % 10;
    if (parseInt(d[t]) !== sum) return false;
  }
  return true;
}

interface CepData {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export default function ConsumerPagamento() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { cart, activeEvent, clearCart, setActiveOrder } = useConsumer();

  // ── Resume pending order via ?resume=<orderId> ──
  const [searchParams] = useSearchParams();
  const resumeOrderId = searchParams.get("resume");
  const [resumeOrder, setResumeOrder] = useState<{
    id: string;
    total: number;
    event_id: string;
    client_id: string;
    order_number: number;
    items: { name: string; quantity: number; price: number; id: string }[];
  } | null>(null);
  const [resumeLoading, setResumeLoading] = useState(!!resumeOrderId);

  // ── Saved cards (Asaas) ──
  const [savedCards, setSavedCards] = useState<AsaasCard[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("pix");
  const [selectedSavedCardId, setSelectedSavedCardId] = useState<string | null>(null);

  // ── New card form ──
  const [useNewCard, setUseNewCard] = useState(false);
  const [cardHolderName, setCardHolderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpMonth, setCardExpMonth] = useState("");
  const [cardExpYear, setCardExpYear] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [saveCard, setSaveCard] = useState(true);

  // ── Payment CPF ──
  const [paymentCpf, setPaymentCpf] = useState("");
  const [paymentCpfError, setPaymentCpfError] = useState("");

  // ── Address toggle ──
  const [useOtherAddress, setUseOtherAddress] = useState(false);
  const [otherCep, setOtherCep] = useState("");
  const [otherCepError, setOtherCepError] = useState("");
  const [otherCepLoading, setOtherCepLoading] = useState(false);
  const [otherCepAddress, setOtherCepAddress] = useState<CepData | null>(null);
  const [otherAddressNumber, setOtherAddressNumber] = useState("");

  // ── Split payment ──
  const [splitMode, setSplitMode] = useState(false);
  const [splitMethod1, setSplitMethod1] = useState<PaymentMethod>("pix");
  const [splitMethod2, setSplitMethod2] = useState<PaymentMethod>("cash");
  const [splitAmount1, setSplitAmount1] = useState("");

  // ── Flow state ──
  const [flowState, setFlowState] = useState<FlowState>("select");
  const [errorMessage, setErrorMessage] = useState("");

  // ── Limit warning ──
  const [limitWarning, setLimitWarning] = useState<{
    limit: number;
    alreadySpent: number;
    willSpend: number;
  } | null>(null);

  // ── Cash pending ──
  const [cashPendingInfo, setCashPendingInfo] = useState<{
    cashAmount: number;
    digitalAmount: number;
    orderId: string;
  } | null>(null);

  // ── PIX waiting ──
  const [pixQrCodeBase64, setPixQrCodeBase64] = useState("");
  const [pixCopyPaste, setPixCopyPaste] = useState("");
  const [pixExpiresAt, setPixExpiresAt] = useState<Date | null>(null);
  const [pixTimeLeft, setPixTimeLeft] = useState(900);
  const [pixCopied, setPixCopied] = useState(false);
  const [pixOrderId, setPixOrderId] = useState<string | null>(null);

  // ── Card declined ──
  const [declinedMessage, setDeclinedMessage] = useState("");
  const [declinedOrderId, setDeclinedOrderId] = useState<string | null>(null);

  // ── Split card pending ──
  const [pendingCardPayment, setPendingCardPayment] = useState<{ payRow: any; orderId: string } | null>(null);

  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const paymentsChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const splitAmount2 = splitMode
    ? Math.max(0, cart.total - (parseFloat(splitAmount1) || 0))
    : 0;

  // ── Check spending limit ──
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
      const { data: spentData } = await supabase
        .from("orders")
        .select("total")
        .eq("consumer_id", user.id)
        .eq("event_id", activeEvent.id)
        .in("status", ["paid", "preparing", "ready", "delivered"]);
      const alreadySpent = (spentData || []).reduce(
        (s: number, o: any) => s + Number(o.total),
        0
      );
      const willSpend = alreadySpent + cart.total;
      if (willSpend > limit) {
        setLimitWarning({ limit, alreadySpent, willSpend });
      } else {
        setLimitWarning(null);
      }
    })();
  }, [user, activeEvent, cart.total]);

  // ── Fetch saved cards (Asaas) ──
  useEffect(() => {
    if (!user) return;
    supabase
      .from("asaas_customer_cards")
      .select("id, card_brand, card_last_four, card_holder_name, card_token, is_default")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setSavedCards(data);
        }
      });
  }, [user]);

  // ── Pre-fill CPF and card holder name from profile ──
  useEffect(() => {
    if (!profile) return;
    const profileCpf = profile.last_payment_cpf || profile.cpf || "";
    setPaymentCpf(onlyDigits(profileCpf));
    if (profile.name) setCardHolderName(profile.name);
  }, [profile]);

  // ── Silent GPS ──
  useEffect(() => {
    getLocation().catch(() => {});
  }, []);

  // ── Redirect if cart empty ──
  useEffect(() => {
    if (cart.items.length === 0 && flowState === "select") {
      navigate("/app/cardapio", { replace: true });
    }
  }, [cart.items.length, flowState, navigate]);

  // ── Split mode init ──
  useEffect(() => {
    if (splitMode && !splitAmount1) {
      setSplitAmount1((cart.total / 2).toFixed(2));
    }
  }, [splitMode, cart.total, splitAmount1]);

  // ── Ensure split methods differ ──
  useEffect(() => {
    if (splitMode && splitMethod1 === splitMethod2) {
      const allMethods: PaymentMethod[] = ["pix", "credit_card", "debit_card", "cash"];
      const next = allMethods.find((m) => m !== splitMethod1);
      if (next) setSplitMethod2(next);
    }
  }, [splitMode, splitMethod1, splitMethod2]);

  // ── PIX countdown timer ──
  useEffect(() => {
    if ((flowState !== "pix_waiting" && flowState !== "pix_waiting_then_card") || !pixExpiresAt) return;
    const timer = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((pixExpiresAt.getTime() - now) / 1000));
      setPixTimeLeft(diff);
      if (diff <= 0) {
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [flowState, pixExpiresAt]);

  // ── Cleanup realtime on unmount ──
  useEffect(() => {
    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
      if (paymentsChannelRef.current) {
        supabase.removeChannel(paymentsChannelRef.current);
      }
    };
  }, []);

  // ── Check pending card payment on mount ──
  useEffect(() => {
    if (!user) return;
    const checkPending = async () => {
      const { data: pendingOrders } = await supabase
        .from("orders")
        .select("id, status")
        .eq("consumer_id", user.id)
        .in("status", ["pending", "partially_paid"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (pendingOrders && pendingOrders.length > 0) {
        const orderId = pendingOrders[0].id;
        const { data: pendingCard } = await supabase
          .from("payments")
          .select("id, payment_method, amount, status")
          .eq("order_id", orderId)
          .in("payment_method", ["credit_card", "debit_card"])
          .in("status", ["created", "processing"]);

        const { data: approvedOther } = await supabase
          .from("payments")
          .select("id")
          .eq("order_id", orderId)
          .eq("status", "approved");

        if (pendingCard && pendingCard.length > 0 && approvedOther && approvedOther.length > 0) {
          setPendingCardPayment({ payRow: pendingCard[0], orderId });
          setFlowState("card_retry_pending");
        }
      }
    };
    checkPending();
  }, [user]);

  const resolvePaymentMethod = (method: PaymentMethod): string => {
    if (method === "pix") return "pix";
    if (method === "cash") return "cash";
    if (method === "debit_card") return "debit_card";
    return "credit_card";
  };

  const hasCash = splitMode
    ? splitMethod1 === "cash" || splitMethod2 === "cash"
    : selectedMethod === "cash";

  const cashAmount = splitMode
    ? (splitMethod1 === "cash" ? parseFloat(splitAmount1) || 0 : 0) +
      (splitMethod2 === "cash" ? splitAmount2 : 0)
    : selectedMethod === "cash"
    ? cart.total
    : 0;

  const digitalAmount = cart.total - cashAmount;

  const isCardMethod = (method: PaymentMethod) =>
    method === "credit_card" || method === "debit_card";

  const splitHasCard = splitMode && (isCardMethod(splitMethod1) || isCardMethod(splitMethod2));

  const showCardForm =
    !splitMode && isCardMethod(selectedMethod) && !selectedSavedCardId;

  const showSplitCardForm = splitHasCard && !selectedSavedCardId;

  const isSplitValid = (): boolean => {
    if (!splitMode) return true;
    const a1 = parseFloat(splitAmount1) || 0;
    if (a1 <= 0 || splitAmount2 <= 0) return false;
    if (splitMethod1 === splitMethod2) return false;
    if (Math.abs(a1 + splitAmount2 - cart.total) > 0.01) return false;
    return true;
  };

  const isNewCardValid = (): boolean => {
    if (!showCardForm && !useNewCard) return true;
    if (!(isCardMethod(selectedMethod) || (splitMode && (isCardMethod(splitMethod1) || isCardMethod(splitMethod2))))) return true;
    if (selectedSavedCardId) return true;
    const digits = cardNumber.replace(/\D/g, "");
    return (
      cardHolderName.trim().length >= 2 &&
      digits.length >= 13 &&
      digits.length <= 19 &&
      cardExpMonth.length === 2 &&
      parseInt(cardExpMonth) >= 1 &&
      parseInt(cardExpMonth) <= 12 &&
      cardExpYear.length === 2 &&
      cardCvv.length >= 3 &&
      cardCvv.length <= 4
    );
  };

  // ── CPF handler ──
  const handlePaymentCpfChange = (val: string) => {
    setPaymentCpf(onlyDigits(val).slice(0, 11));
    setPaymentCpfError("");
  };
  const handlePaymentCpfBlur = () => {
    if (paymentCpf.length > 0 && !isValidCPF(paymentCpf)) {
      setPaymentCpfError("CPF inválido");
    }
  };

  // ── Other address CEP fetch ──
  const fetchOtherCep = useCallback(async (digits: string) => {
    setOtherCepLoading(true);
    setOtherCepError("");
    setOtherCepAddress(null);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data: CepData = await res.json();
      if (data.erro) {
        setOtherCepError("CEP não encontrado");
      } else {
        setOtherCepAddress(data);
      }
    } catch {
      setOtherCepError("CEP não encontrado");
    } finally {
      setOtherCepLoading(false);
    }
  }, []);

  const handleOtherCepChange = (val: string) => {
    const digits = onlyDigits(val).slice(0, 8);
    setOtherCep(digits);
    setOtherCepError("");
    setOtherCepAddress(null);
    if (digits.length === 8) fetchOtherCep(digits);
  };

  // ── Needs digital payment (not pure cash) ──
  const needsDigital = splitMode
    ? splitMethod1 !== "cash" || splitMethod2 !== "cash"
    : selectedMethod !== "cash";

  const needsCard = splitMode
    ? isCardMethod(splitMethod1) || isCardMethod(splitMethod2)
    : isCardMethod(selectedMethod);

  const isCpfValid = paymentCpf.length === 11 && isValidCPF(paymentCpf) && !paymentCpfError;

  const isAddressValid = !needsCard || !useOtherAddress || (
    otherCep.length === 8 && !!otherCepAddress && !otherCepError && otherAddressNumber.trim().length > 0
  );

  // ── Charge card function ──
  const chargeCard = useCallback(async (payRow: any, orderId: string) => {
    try {
      const method = payRow.payment_method;
      const body: any = {
        payment_id: payRow.id,
        order_id: orderId,
        amount: Number(payRow.amount),
        event_id: activeEvent?.id,
        client_id: activeEvent?.client_id,
        billing_type: method === "credit_card" ? "CREDIT_CARD" : "DEBIT_CARD",
        payment_cpf: paymentCpf,
        payment_postal_code: useOtherAddress ? otherCep : profile?.postal_code || "",
        payment_address_number: useOtherAddress ? otherAddressNumber.trim() : profile?.address_number || "",
      };

      if (selectedSavedCardId) {
        const savedCard = savedCards.find((c) => c.id === selectedSavedCardId);
        if (savedCard) body.card_token = savedCard.card_token;
      } else {
        body.card_holder_name = cardHolderName;
        body.card_number = cardNumber.replace(/\D/g, "");
        body.card_expiry_month = cardExpMonth;
        body.card_expiry_year = cardExpYear;
        body.card_cvv = cardCvv;
        body.save_card = saveCard;
      }

      const { data: chargeResult, error: chargeError } = await supabase.functions.invoke(
        "asaas-create-charge",
        { body }
      );

      if (chargeError) {
        console.error("Card charge error (edge function):", chargeError);
        setDeclinedMessage(chargeError.message || "Erro ao criar cobrança");
        setDeclinedOrderId(orderId);
        setFlowState("card_declined_split");
        return;
      }

      const charge = (chargeResult as any)?.data || chargeResult;
      if (charge?.error) {
        setDeclinedMessage(charge.detail || charge.error || "Pagamento recusado");
        setDeclinedOrderId(orderId);
        setFlowState("card_declined_split");
        return;
      }

      if (charge.card_approved) {
        setFlowState("success");
        setTimeout(() => navigate("/app/qr?order=" + orderId, { replace: true }), 1500);
      }
    } catch (err: any) {
      console.error("Card charge error:", err);
      setDeclinedMessage(err.message || "Erro ao cobrar cartão");
      setDeclinedOrderId(orderId);
      setFlowState("card_declined_split");
    }
  }, [activeEvent, paymentCpf, useOtherAddress, otherCep, otherAddressNumber, profile, selectedSavedCardId, savedCards, cardHolderName, cardNumber, cardExpMonth, cardExpYear, cardCvv, saveCard, navigate]);

  // ── Subscribe to order status changes ──
  const subscribeToOrder = useCallback(
    (orderId: string) => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
      const channel = supabase
        .channel(`order-status-${orderId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "orders",
            filter: `id=eq.${orderId}`,
          },
          (payload: any) => {
            const newStatus = payload.new?.status;
            if (newStatus === "paid") {
              try {
                navigator.vibrate?.(300);
              } catch {}
              setFlowState("success");
              setTimeout(() => {
                navigate(`/app/qr?order=${orderId}`, { replace: true });
              }, 1500);
            } else if (newStatus === "cancelled") {
              setFlowState("error");
              setErrorMessage("PIX expirado — o pedido foi cancelado");
            }
          }
        )
        .subscribe();
      realtimeChannelRef.current = channel;
    },
    [navigate]
  );

  // ── Subscribe to payments for split card auto-charge ──
  const subscribeToPayments = useCallback(
    (orderId: string) => {
      if (paymentsChannelRef.current) {
        supabase.removeChannel(paymentsChannelRef.current);
      }
      const channel = supabase
        .channel(`split-payments-${orderId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "payments",
            filter: `order_id=eq.${orderId}`,
          },
          (payload: any) => {
            const updated = payload.new;
            if (
              updated.status === "approved" &&
              updated.payment_method !== "credit_card" &&
              updated.payment_method !== "debit_card"
            ) {
              setPendingCardPayment((prev) => {
                if (prev) {
                  setFlowState("charging_card");
                  chargeCard(prev.payRow, prev.orderId);
                }
                return prev;
              });
            }
          }
        )
        .subscribe();
      paymentsChannelRef.current = channel;
    },
    [chargeCard]
  );

  // ── Process digital payments via Asaas ──
  const processDigitalPayments = async (
    orderId: string,
    payments: { method: string; amount: number }[],
    total: number
  ) => {
    const { data: paymentRows } = await supabase
      .from("payments")
      .select("id, payment_method, amount, status")
      .eq("order_id", orderId)
      .neq("payment_method", "cash");

    if (!paymentRows || paymentRows.length === 0) {
      throw new Error("Pagamento digital não encontrado");
    }

    const pixPayments = paymentRows.filter((p: any) => p.payment_method === "pix");
    const cardPayments = paymentRows.filter(
      (p: any) => p.payment_method === "credit_card" || p.payment_method === "debit_card"
    );

    const isSplitWithCard = cardPayments.length > 0 && (pixPayments.length > 0 || hasCash);

    // CENÁRIO 1: Split com cartão — PIX ou cash primeiro, cartão depois
    if (isSplitWithCard) {
      setPendingCardPayment({
        payRow: cardPayments[0],
        orderId,
      });

      if (pixPayments.length > 0) {
        const payRow = pixPayments[0];
        const body: any = {
          payment_id: payRow.id,
          order_id: orderId,
          amount: Number(payRow.amount),
          event_id: activeEvent?.id,
          client_id: activeEvent?.client_id,
          billing_type: "PIX",
          payment_cpf: paymentCpf,
        };

        const { data: chargeResult, error: chargeError } = await supabase.functions.invoke(
          "asaas-create-charge",
          { body }
        );

        if (chargeError) throw new Error(chargeError.message || "Erro ao criar cobrança");

        const charge = (chargeResult as any)?.data || chargeResult;
        if (charge?.error) throw new Error(charge.detail || charge.error);

        setPixQrCodeBase64(charge.pix_qr_code || "");
        setPixCopyPaste(charge.pix_copy_paste || "");
        const expiresAt = charge.pix_expires_at
          ? new Date(charge.pix_expires_at)
          : new Date(Date.now() + 15 * 60 * 1000);
        setPixExpiresAt(expiresAt);
        setPixTimeLeft(Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)));
        setPixOrderId(orderId);
        setFlowState("pix_waiting_then_card");
        subscribeToOrder(orderId);
        subscribeToPayments(orderId);
        return;
      }

      if (hasCash) {
        setFlowState("cash_waiting_then_card");
        subscribeToOrder(orderId);
        subscribeToPayments(orderId);
        return;
      }
    }

    // CENÁRIO 2: Só cartão (sem split)
    if (cardPayments.length > 0 && pixPayments.length === 0) {
      await chargeCard(cardPayments[0], orderId);
      return;
    }

    // CENÁRIO 3: Só PIX (sem cartão)
    if (pixPayments.length > 0 && cardPayments.length === 0) {
      const payRow = pixPayments[0];
      const body: any = {
        payment_id: payRow.id,
        order_id: orderId,
        amount: Number(payRow.amount),
        event_id: activeEvent?.id,
        client_id: activeEvent?.client_id,
        billing_type: "PIX",
        payment_cpf: paymentCpf,
      };

      const { data: chargeResult, error: chargeError } = await supabase.functions.invoke(
        "asaas-create-charge",
        { body }
      );

      if (chargeError) throw new Error(chargeError.message || "Erro ao criar cobrança");

      const charge = (chargeResult as any)?.data || chargeResult;
      if (charge?.error) throw new Error(charge.detail || charge.error);

      setPixQrCodeBase64(charge.pix_qr_code || "");
      setPixCopyPaste(charge.pix_copy_paste || "");
      const expiresAt = charge.pix_expires_at
        ? new Date(charge.pix_expires_at)
        : new Date(Date.now() + 15 * 60 * 1000);
      setPixExpiresAt(expiresAt);
      setPixTimeLeft(Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)));
      setPixOrderId(orderId);
      setFlowState("pix_waiting");
      subscribeToOrder(orderId);
      return;
    }
  };

  // ── Handle confirm ──
  const handleConfirm = async () => {
    if (!activeEvent || !user || cart.items.length === 0) return;
    if (splitMode && !isSplitValid()) return;

    setFlowState("processing");
    setErrorMessage("");

    try {
      const items = cart.items.map((i) => ({
        ...(i.type === "product" ? { product_id: i.id } : { combo_id: i.id }),
        quantity: i.quantity,
      }));

      let payments: { method: string; amount: number }[];

      if (splitMode) {
        payments = [
          { method: resolvePaymentMethod(splitMethod1), amount: parseFloat(splitAmount1) || 0 },
          { method: resolvePaymentMethod(splitMethod2), amount: splitAmount2 },
        ];
      } else {
        payments = [
          { method: resolvePaymentMethod(selectedMethod), amount: cart.total },
        ];
      }

      const { data, error } = await supabase.rpc("create_consumer_split_order", {
        params: {
          event_id: activeEvent.id,
          items,
          payments,
        },
      });

      if (error) throw new Error(error.message);

      const result = data as any;
      const orderId = result?.order_id;
      const orderNumber = result?.order_number;
      const qrToken = result?.qr_token;
      const total = result?.total;
      const hasCashPending = result?.has_cash_pending === true;
      const hasDigitalPending = result?.has_digital_pending === true;

      setActiveOrder({
        id: orderId,
        order_number: orderNumber,
        status: result?.status || "pending",
        total: total,
        qr_token: qrToken,
        items: cart.items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          unit_price: i.price,
          delivered_quantity: 0,
        })),
      });

      try {
        await logAudit({
          action: "CONSUMER_ORDER_CREATED",
          entityType: "order",
          entityId: orderId,
          metadata: {
            event_id: activeEvent.id,
            payments,
            total,
            items_count: cart.items.length,
            has_cash_pending: hasCashPending,
          },
        });
      } catch {}

      clearCart();

      if (hasCashPending) {
        setCashPendingInfo({ cashAmount, digitalAmount, orderId });
        if (digitalAmount > 0) {
          await processDigitalPayments(orderId, payments, total);
        }
        if (digitalAmount <= 0) {
          setFlowState("success_cash");
        }
        return;
      }

      if (hasDigitalPending) {
        await processDigitalPayments(orderId, payments, total);
        return;
      }

      setFlowState("success");
      setTimeout(() => {
        navigate(`/app/qr?order=${orderId}`, { replace: true });
      }, 1500);
    } catch (err: any) {
      console.error("Payment error:", err);
      setErrorMessage(err.message || "Erro ao processar pagamento");
      setFlowState("error");
    }
  };

  const handleCancel = () => navigate(-1);
  const handleRetry = () => {
    setFlowState("select");
    setErrorMessage("");
    setDeclinedMessage("");
    setDeclinedOrderId(null);
    setPixOrderId(null);
    setPendingCardPayment(null);
  };

  const handleCancelOrder = async (orderId: string) => {
    const { data, error } = await (supabase.rpc as any)("cancel_consumer_order", { p_order_id: orderId });
    if (error || !data || (data as any).ok !== true) {
      toast.error("Erro ao cancelar pedido");
      return;
    }
    navigate("/app/carrinho", { replace: true });
  };

  const handleCopyPix = async () => {
    try {
      await navigator.clipboard.writeText(pixCopyPaste);
      setPixCopied(true);
      setTimeout(() => setPixCopied(false), 3000);
    } catch {}
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleRetryCardSplit = () => {
    setSelectedSavedCardId(null);
    setUseNewCard(false);
    setCardNumber("");
    setCardExpMonth("");
    setCardExpYear("");
    setCardCvv("");
    setDeclinedMessage("");
    setFlowState("card_retry_pending");
  };

  const handleFinalizePendingCard = async () => {
    if (!pendingCardPayment) return;
    setFlowState("charging_card");
    try {
      await chargeCard(pendingCardPayment.payRow, pendingCardPayment.orderId);
    } catch (err: any) {
      setDeclinedMessage(err.message || "Erro ao cobrar cartão");
      setDeclinedOrderId(pendingCardPayment.orderId);
      setFlowState("card_declined_split");
    }
  };

  // ── Processing ──
  if (flowState === "processing") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background">
        <div className="h-20 w-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <div className="text-center">
          <h2 className="text-lg font-bold text-foreground">
            {hasCash ? "Criando pedido..." : t("consumer_payment_processing")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{t("consumer_payment_wait")}</p>
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5" />
          {t("consumer_payment_secure")}
        </p>
      </div>
    );
  }

  // ── PIX waiting (simple) ──
  if (flowState === "pix_waiting") {
    const expired = pixTimeLeft <= 0;
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-background px-6">
        <div className={cn(
          "text-4xl font-mono font-bold tabular-nums",
          expired ? "text-destructive" : pixTimeLeft < 120 ? "text-amber-400" : "text-primary"
        )}>
          {expired ? "00:00" : formatTime(pixTimeLeft)}
        </div>

        {expired ? (
          <>
            <XCircle className="h-16 w-16 text-destructive" />
            <h2 className="text-lg font-bold text-foreground">PIX expirado</h2>
            <p className="text-sm text-muted-foreground text-center">
              O tempo para pagamento expirou. Você pode tentar novamente.
            </p>
            <Button
              onClick={handleRetry}
              className="h-14 rounded-2xl text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground w-full max-w-[320px]"
            >
              Tentar novamente
            </Button>
            {pixOrderId && (
              <Button
                variant="ghost"
                onClick={() => handleCancelOrder(pixOrderId)}
                className="text-sm text-destructive"
              >
                Cancelar pedido
              </Button>
            )}
          </>
        ) : (
          <>
            {pixQrCodeBase64 && (
              <div className="bg-white p-4 rounded-2xl">
                <img
                  src={`data:image/png;base64,${pixQrCodeBase64}`}
                  alt="QR Code PIX"
                  className="w-48 h-48"
                />
              </div>
            )}

            <p className="text-sm font-semibold text-foreground text-center">
              Abra o app do seu banco e pague via PIX
            </p>
            <p className="text-xs text-muted-foreground text-center">
              O pagamento será confirmado automaticamente
            </p>

            {pixCopyPaste && (
              <Button
                onClick={handleCopyPix}
                variant="outline"
                className="h-12 rounded-xl w-full max-w-[320px] gap-2"
              >
                {pixCopied ? (
                  <>
                    <Check className="h-4 w-4 text-success" />
                    Código copiado!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copiar código PIX
                  </>
                )}
              </Button>
            )}

            {pixOrderId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCancelOrder(pixOrderId)}
                className="text-xs text-destructive"
              >
                Cancelar pedido
              </Button>
            )}
          </>
        )}
      </div>
    );
  }

  // ── PIX waiting then card ──
  if (flowState === "pix_waiting_then_card") {
    const expired = pixTimeLeft <= 0;
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-background px-6">
        {/* Warning banner */}
        <div className="w-full max-w-[320px] rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-xs font-semibold text-amber-500 text-center">
            ⚠️ Não feche o app. Após o PIX, o cartão será cobrado automaticamente.
          </p>
        </div>

        <div className={cn(
          "text-4xl font-mono font-bold tabular-nums",
          expired ? "text-destructive" : pixTimeLeft < 120 ? "text-amber-400" : "text-primary"
        )}>
          {expired ? "00:00" : formatTime(pixTimeLeft)}
        </div>

        {expired ? (
          <>
            <XCircle className="h-16 w-16 text-destructive" />
            <h2 className="text-lg font-bold text-foreground">PIX expirado</h2>
            <p className="text-sm text-muted-foreground text-center">
              O tempo para pagamento expirou. O pedido será cancelado.
            </p>
            {pixOrderId && (
              <Button
                onClick={() => handleCancelOrder(pixOrderId)}
                className="h-14 rounded-2xl text-base font-bold bg-destructive hover:bg-destructive/90 text-destructive-foreground w-full max-w-[320px]"
              >
                Fechar
              </Button>
            )}
          </>
        ) : (
          <>
            {pixQrCodeBase64 && (
              <div className="bg-white p-4 rounded-2xl">
                <img
                  src={`data:image/png;base64,${pixQrCodeBase64}`}
                  alt="QR Code PIX"
                  className="w-48 h-48"
                />
              </div>
            )}

            <p className="text-sm font-semibold text-foreground text-center">
              Abra o app do seu banco e pague via PIX
            </p>
            <p className="text-xs text-muted-foreground text-center">
              Após a confirmação do PIX, o cartão será cobrado automaticamente
            </p>

            {pixCopyPaste && (
              <Button
                onClick={handleCopyPix}
                variant="outline"
                className="h-12 rounded-xl w-full max-w-[320px] gap-2"
              >
                {pixCopied ? (
                  <>
                    <Check className="h-4 w-4 text-success" />
                    Código copiado!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copiar código PIX
                  </>
                )}
              </Button>
            )}

            {pixOrderId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCancelOrder(pixOrderId)}
                className="text-xs text-destructive"
              >
                Cancelar pedido
              </Button>
            )}
          </>
        )}
      </div>
    );
  }

  // ── Cash waiting then card ──
  if (flowState === "cash_waiting_then_card") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-background px-6">
        <div className="w-full max-w-[320px] rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-xs font-semibold text-amber-500 text-center">
            ⚠️ Não feche o app. Após o dinheiro, o cartão será cobrado automaticamente.
          </p>
        </div>

        <Loader2 className="h-16 w-16 text-primary animate-spin" />

        <div className="text-center max-w-[320px]">
          <h2 className="text-lg font-bold text-foreground">
            Aguardando confirmação do dinheiro
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Apresente o QR Code ao garçom para confirmar o pagamento em dinheiro
          </p>
        </div>

        {pendingCardPayment && (
          <Button
            onClick={() => navigate(`/app/qr?order=${pendingCardPayment.orderId}`, { replace: false })}
            variant="outline"
            className="h-12 rounded-xl w-full max-w-[320px] gap-2"
          >
            Ver meu QR Code
          </Button>
        )}
      </div>
    );
  }

  // ── Charging card ──
  if (flowState === "charging_card") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background">
        <Loader2 className="h-16 w-16 text-primary animate-spin" />
        <div className="text-center">
          <h2 className="text-lg font-bold text-foreground">Cobrando cartão...</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Aguarde, estamos finalizando seu pagamento
          </p>
        </div>
      </div>
    );
  }

  // ── Success (digital confirmed) ──
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

  // ── Success with cash pending ──
  if (flowState === "success_cash" && cashPendingInfo) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background px-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/30">
          <Clock className="h-10 w-10 text-amber-400" />
        </div>
        <div className="text-center max-w-[320px]">
          <h2 className="text-lg font-bold text-foreground">
            Pedido criado — procure um garçom
          </h2>
          <p className="text-sm text-amber-200/80 mt-2">
            Apresente seu QR Code para pagar{" "}
            <strong>R$ {cashPendingInfo.cashAmount.toFixed(2)}</strong> em dinheiro
          </p>
          {cashPendingInfo.digitalAmount > 0 && (
            <p className="text-sm text-success mt-2 flex items-center justify-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              Parte digital em processamento (R$ {cashPendingInfo.digitalAmount.toFixed(2)})
            </p>
          )}
        </div>
        <Button
          onClick={() =>
            navigate(`/app/qr?order=${cashPendingInfo.orderId}`, { replace: true })
          }
          className="h-14 rounded-2xl text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground w-full max-w-[320px]"
        >
          Ver meu QR Code
        </Button>
      </div>
    );
  }

  // ── Card declined (simple, no split) ──
  if (flowState === "card_declined") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background px-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 border border-destructive/30">
          <XCircle className="h-10 w-10 text-destructive" />
        </div>
        <div className="text-center max-w-[320px]">
          <h2 className="text-lg font-bold text-foreground">Pagamento recusado</h2>
          <p className="text-sm text-muted-foreground mt-1">{declinedMessage}</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-[320px]">
          <Button
            onClick={handleRetry}
            className="h-14 rounded-2xl text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground w-full"
          >
            Tentar com outro método
          </Button>
          {declinedOrderId && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleCancelOrder(declinedOrderId)}
              className="h-12 rounded-xl"
            >
              Cancelar pedido
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Card declined in split (PIX/cash already paid) ──
  if (flowState === "card_declined_split") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background px-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 border border-destructive/30">
          <XCircle className="h-10 w-10 text-destructive" />
        </div>
        <div className="text-center max-w-[320px]">
          <h2 className="text-lg font-bold text-foreground">Cartão recusado</h2>
          <p className="text-sm text-muted-foreground mt-1">{declinedMessage}</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-[320px]">
          <Button
            onClick={handleRetryCardSplit}
            className="h-14 rounded-2xl text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground w-full"
          >
            Tentar com outro cartão
          </Button>
          <Button
            onClick={handleRetryCardSplit}
            variant="outline"
            className="h-12 rounded-xl"
          >
            Tentar outro método
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground/60 text-center max-w-[280px]">
          O valor já pago via PIX/dinheiro será estornado caso não consiga finalizar o pagamento
        </p>
      </div>
    );
  }

  // ── Card retry pending (resumed session) ──
  if (flowState === "card_retry_pending") {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
        <div className="flex flex-col gap-5 px-6 py-8 max-w-[480px] mx-auto">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="h-8 w-8 text-amber-400" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-bold text-foreground">Pagamento pendente</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Você tem um pedido com pagamento parcial. Finalize o pagamento com cartão.
              </p>
            </div>
          </div>

          {/* CPF */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">CPF do pagador</label>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="CPF (apenas números)"
              value={paymentCpf}
              onChange={(e) => handlePaymentCpfChange(e.target.value)}
              onBlur={handlePaymentCpfBlur}
              maxLength={11}
              className={cn(
                "h-12 text-base rounded-xl bg-white/[0.04] border-white/[0.08]",
                paymentCpfError && "border-destructive"
              )}
              style={{ fontSize: "16px" }}
            />
            {paymentCpfError && <p className="text-xs text-destructive">{paymentCpfError}</p>}
          </div>

          {/* Saved cards */}
          {savedCards.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Cartões salvos
              </h4>
              <RadioGroup
                value={selectedSavedCardId || "new"}
                onValueChange={(val) => {
                  if (val === "new") {
                    setSelectedSavedCardId(null);
                    setUseNewCard(true);
                  } else {
                    setSelectedSavedCardId(val);
                    setUseNewCard(false);
                  }
                }}
              >
                {savedCards.map((card) => (
                  <div
                    key={card.id}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3",
                      selectedSavedCardId === card.id
                        ? "border-primary/50 bg-primary/5"
                        : "border-white/[0.08] bg-white/[0.02]"
                    )}
                  >
                    <RadioGroupItem value={card.id} id={`retry-card-${card.id}`} />
                    <Label htmlFor={`retry-card-${card.id}`} className="flex-1 cursor-pointer">
                      <p className="text-sm font-semibold text-foreground">
                        {card.card_brand || "Cartão"} ••••{card.card_last_four}
                      </p>
                      {card.card_holder_name && (
                        <p className="text-xs text-muted-foreground">{card.card_holder_name}</p>
                      )}
                    </Label>
                  </div>
                ))}
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3",
                    useNewCard && !selectedSavedCardId
                      ? "border-primary/50 bg-primary/5"
                      : "border-white/[0.08] bg-white/[0.02]"
                  )}
                >
                  <RadioGroupItem value="new" id="retry-card-new" />
                  <Label htmlFor="retry-card-new" className="cursor-pointer text-sm font-semibold text-foreground">
                    Usar novo cartão
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* New card form */}
          {(savedCards.length === 0 || useNewCard) && (
            <div className="space-y-3 rounded-xl bg-white/[0.04] border border-white/[0.06] p-4">
              <h4 className="text-sm font-bold text-foreground">Dados do cartão</h4>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nome no cartão</label>
                <Input
                  value={cardHolderName}
                  onChange={(e) => setCardHolderName(e.target.value)}
                  placeholder="Como aparece no cartão"
                  className="h-12 text-base rounded-xl bg-white/[0.04] border-white/[0.08]"
                  style={{ fontSize: "16px" }}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Número do cartão</label>
                <Input
                  value={cardNumber}
                  onChange={(e) => setCardNumber(maskCardNumber(e.target.value))}
                  placeholder="0000 0000 0000 0000"
                  inputMode="numeric"
                  maxLength={19}
                  className="h-12 text-base rounded-xl bg-white/[0.04] border-white/[0.08] font-mono"
                  style={{ fontSize: "16px" }}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Mês</label>
                  <Input
                    value={cardExpMonth}
                    onChange={(e) => setCardExpMonth(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    placeholder="MM"
                    inputMode="numeric"
                    maxLength={2}
                    className="h-12 text-base rounded-xl bg-white/[0.04] border-white/[0.08] text-center"
                    style={{ fontSize: "16px" }}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Ano</label>
                  <Input
                    value={cardExpYear}
                    onChange={(e) => setCardExpYear(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    placeholder="AA"
                    inputMode="numeric"
                    maxLength={2}
                    className="h-12 text-base rounded-xl bg-white/[0.04] border-white/[0.08] text-center"
                    style={{ fontSize: "16px" }}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">CVV</label>
                  <Input
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="000"
                    inputMode="numeric"
                    maxLength={4}
                    type="password"
                    className="h-12 text-base rounded-xl bg-white/[0.04] border-white/[0.08] text-center"
                    style={{ fontSize: "16px" }}
                  />
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={handleFinalizePendingCard}
            disabled={!isCpfValid || (!selectedSavedCardId && !isNewCardValid())}
            className="h-14 rounded-2xl text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl active:scale-[0.98] transition-transform w-full"
            style={{ boxShadow: "0 8px 32px hsl(24 100% 50% / 0.35)" }}
          >
            Finalizar pagamento
          </Button>
        </div>
      </div>
    );
  }

  // ── Error ──
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

  // ── Method selector button ──
  const MethodOption = ({
    method,
    label,
    desc,
    icon: Icon,
    selected,
    onSelect,
  }: {
    method: PaymentMethod;
    label: string;
    desc: string;
    icon: React.ElementType;
    selected: boolean;
    onSelect: () => void;
  }) => (
    <button
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-4 text-left active:scale-[0.99] transition-all",
        selected
          ? "border-primary/50 bg-primary/5"
          : "border-white/[0.08] bg-white/[0.02]"
      )}
    >
      <div
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-xl shrink-0",
          selected ? "bg-primary/20" : "bg-white/[0.06]"
        )}
      >
        <Icon
          className={cn(
            "h-5 w-5",
            selected ? "text-primary" : "text-muted-foreground"
          )}
        />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <div
        className={cn(
          "h-5 w-5 rounded-full border-2 flex items-center justify-center",
          selected ? "border-primary" : "border-white/20"
        )}
      >
        {selected && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
      </div>
    </button>
  );

  const allMethods: {
    method: PaymentMethod;
    label: string;
    desc: string;
    icon: React.ElementType;
  }[] = [
    { method: "pix", label: "PIX", desc: "Aprovação instantânea", icon: Smartphone },
    { method: "credit_card", label: "Crédito", desc: "Cartão de crédito", icon: CreditCard },
    { method: "debit_card", label: "Débito", desc: "Cartão de débito", icon: CreditCard },
    { method: "cash", label: "Dinheiro", desc: "Pagar com um garçom", icon: Banknote },
  ];

  const canConfirm =
    cart.items.length > 0 &&
    (!splitMode || isSplitValid()) &&
    (!(showCardForm || showSplitCardForm) || isNewCardValid()) &&
    (selectedMethod === "cash" && !splitMode ? true : isCpfValid) &&
    isAddressValid;

  // ── Select payment method ──
  return (
    <div className="flex flex-col gap-5 pb-4 max-w-[480px] mx-auto">
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
        <h3 className="text-sm font-semibold text-foreground mb-3">
          {t("consumer_payment_summary")}
        </h3>
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
          <div className="mt-2 flex justify-between border-t border-white/[0.06] pt-2">
            <span className="text-sm font-semibold text-foreground">Total</span>
            <span className="text-base font-bold text-primary">
              R$ {cart.total.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* CPF do pagador — shown for digital methods */}
      {needsDigital && (
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">CPF do pagador</label>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="CPF (apenas números)"
            value={paymentCpf}
            onChange={(e) => handlePaymentCpfChange(e.target.value)}
            onBlur={handlePaymentCpfBlur}
            maxLength={11}
            className={cn(
              "h-12 text-base rounded-xl bg-white/[0.04] border-white/[0.08]",
              paymentCpfError && "border-destructive"
            )}
            style={{ fontSize: "16px" }}
          />
          {paymentCpfError && <p className="text-xs text-destructive">{paymentCpfError}</p>}
        </div>
      )}

      {/* Address toggle — shown for card methods */}
      {needsCard && (
        <div className="space-y-3">
          <label className="text-xs text-muted-foreground">Endereço de cobrança</label>
          <div className="flex gap-2">
            <button
              onClick={() => setUseOtherAddress(false)}
              className={cn(
                "flex-1 rounded-xl border p-3 text-xs font-semibold transition-all",
                !useOtherAddress
                  ? "border-primary/50 bg-primary/5 text-primary"
                  : "border-white/[0.08] bg-white/[0.02] text-muted-foreground"
              )}
            >
              Meu endereço
            </button>
            <button
              onClick={() => setUseOtherAddress(true)}
              className={cn(
                "flex-1 rounded-xl border p-3 text-xs font-semibold transition-all",
                useOtherAddress
                  ? "border-primary/50 bg-primary/5 text-primary"
                  : "border-white/[0.08] bg-white/[0.02] text-muted-foreground"
              )}
            >
              Outro endereço
            </button>
          </div>
          {!useOtherAddress && profile?.postal_code && (
            <p className="text-xs text-muted-foreground">
              CEP {profile.postal_code}, nº {profile.address_number || "—"}
            </p>
          )}
          {useOtherAddress && (
            <div className="space-y-3">
              <div>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="CEP (apenas números)"
                  value={otherCep}
                  onChange={(e) => handleOtherCepChange(e.target.value)}
                  maxLength={8}
                  className={cn(
                    "h-12 text-base rounded-xl bg-white/[0.04] border-white/[0.08]",
                    otherCepError && "border-destructive"
                  )}
                  style={{ fontSize: "16px" }}
                />
                {otherCepLoading && <p className="mt-1 text-xs text-muted-foreground">Buscando CEP...</p>}
                {otherCepError && <p className="mt-1 text-xs text-destructive">{otherCepError}</p>}
                {otherCepAddress && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {otherCepAddress.logradouro}, {otherCepAddress.bairro} - {otherCepAddress.localidade}/{otherCepAddress.uf}
                  </p>
                )}
              </div>
              <Input
                type="text"
                placeholder="Número"
                value={otherAddressNumber}
                onChange={(e) => setOtherAddressNumber(e.target.value)}
                className="h-12 text-base rounded-xl bg-white/[0.04] border-white/[0.08] w-32"
                style={{ fontSize: "16px" }}
              />
            </div>
          )}
        </div>
      )}

      {/* Payment methods (single mode) */}
      {!splitMode && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            {t("consumer_payment_method")}
          </h3>

          {allMethods.map((m) => (
            <MethodOption
              key={m.method}
              {...m}
              selected={selectedMethod === m.method && !selectedSavedCardId}
              onSelect={() => {
                setSelectedMethod(m.method);
                setSelectedSavedCardId(null);
                setUseNewCard(false);
              }}
            />
          ))}

          {/* Saved cards (Asaas) — show for card method OR split with card */}
          {(isCardMethod(selectedMethod) || splitHasCard) && savedCards.length > 0 && (
            <div className="space-y-2 pl-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Cartões salvos
              </h4>
              <RadioGroup
                value={selectedSavedCardId || "new"}
                onValueChange={(val) => {
                  if (val === "new") {
                    setSelectedSavedCardId(null);
                    setUseNewCard(true);
                  } else {
                    setSelectedSavedCardId(val);
                    setUseNewCard(false);
                  }
                }}
              >
                {savedCards.map((card) => (
                  <div
                    key={card.id}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3",
                      selectedSavedCardId === card.id
                        ? "border-primary/50 bg-primary/5"
                        : "border-white/[0.08] bg-white/[0.02]"
                    )}
                  >
                    <RadioGroupItem value={card.id} id={`card-${card.id}`} />
                    <Label htmlFor={`card-${card.id}`} className="flex-1 cursor-pointer">
                      <p className="text-sm font-semibold text-foreground">
                        {card.card_brand || "Cartão"} ••••{card.card_last_four}
                      </p>
                      {card.card_holder_name && (
                        <p className="text-xs text-muted-foreground">{card.card_holder_name}</p>
                      )}
                    </Label>
                  </div>
                ))}
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3",
                    useNewCard && !selectedSavedCardId
                      ? "border-primary/50 bg-primary/5"
                      : "border-white/[0.08] bg-white/[0.02]"
                  )}
                >
                  <RadioGroupItem value="new" id="card-new" />
                  <Label htmlFor="card-new" className="cursor-pointer text-sm font-semibold text-foreground">
                    Usar novo cartão
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* New card form */}
          {isCardMethod(selectedMethod) && (savedCards.length === 0 || useNewCard) && (
            <div className="space-y-3 rounded-xl bg-white/[0.04] border border-white/[0.06] p-4">
              <h4 className="text-sm font-bold text-foreground">Dados do cartão</h4>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nome no cartão</label>
                <Input
                  value={cardHolderName}
                  onChange={(e) => setCardHolderName(e.target.value)}
                  placeholder="Como aparece no cartão"
                  className="h-12 text-base rounded-xl bg-white/[0.04] border-white/[0.08]"
                  style={{ fontSize: "16px" }}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Número do cartão</label>
                <Input
                  value={cardNumber}
                  onChange={(e) => setCardNumber(maskCardNumber(e.target.value))}
                  placeholder="0000 0000 0000 0000"
                  inputMode="numeric"
                  maxLength={19}
                  className="h-12 text-base rounded-xl bg-white/[0.04] border-white/[0.08] font-mono"
                  style={{ fontSize: "16px" }}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Mês</label>
                  <Input
                    value={cardExpMonth}
                    onChange={(e) => setCardExpMonth(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    placeholder="MM"
                    inputMode="numeric"
                    maxLength={2}
                    className="h-12 text-base rounded-xl bg-white/[0.04] border-white/[0.08] text-center"
                    style={{ fontSize: "16px" }}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Ano</label>
                  <Input
                    value={cardExpYear}
                    onChange={(e) => setCardExpYear(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    placeholder="AA"
                    inputMode="numeric"
                    maxLength={2}
                    className="h-12 text-base rounded-xl bg-white/[0.04] border-white/[0.08] text-center"
                    style={{ fontSize: "16px" }}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">CVV</label>
                  <Input
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="000"
                    inputMode="numeric"
                    maxLength={4}
                    type="password"
                    className="h-12 text-base rounded-xl bg-white/[0.04] border-white/[0.08] text-center"
                    style={{ fontSize: "16px" }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="save-card"
                  checked={saveCard}
                  onCheckedChange={(checked) => setSaveCard(!!checked)}
                />
                <Label htmlFor="save-card" className="text-xs text-muted-foreground cursor-pointer">
                  Salvar cartão para próximas compras
                </Label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Split mode toggle */}
      <div className="flex items-center justify-between rounded-xl bg-white/[0.04] border border-white/[0.06] p-4">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Dividir em 2 formas de pagamento
          </p>
          <p className="text-xs text-muted-foreground">
            Combine diferentes métodos
          </p>
        </div>
        <Switch checked={splitMode} onCheckedChange={setSplitMode} />
      </div>

      {/* Split mode UI */}
      {splitMode && (
        <div className="space-y-4">
          {/* Payment 1 */}
          <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-4 space-y-3">
            <h4 className="text-sm font-bold text-foreground">Pagamento 1</h4>
            <div className="grid grid-cols-2 gap-2">
              {allMethods.map((m) => (
                <button
                  key={m.method}
                  onClick={() => setSplitMethod1(m.method)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border p-3 text-left transition-all",
                    splitMethod1 === m.method
                      ? "border-primary/50 bg-primary/5"
                      : "border-white/[0.08] bg-white/[0.02]"
                  )}
                >
                  <m.icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      splitMethod1 === m.method
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  />
                  <span className="text-xs font-semibold text-foreground">
                    {m.label}
                  </span>
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Valor (R$)
              </label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                max={cart.total}
                value={splitAmount1}
                onChange={(e) => setSplitAmount1(e.target.value)}
                className="h-12 text-base rounded-xl bg-white/[0.04] border-white/[0.08]"
                style={{ fontSize: "16px" }}
              />
            </div>
          </div>

          {/* Payment 2 */}
          <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-4 space-y-3">
            <h4 className="text-sm font-bold text-foreground">Pagamento 2</h4>
            <div className="grid grid-cols-2 gap-2">
              {allMethods
                .filter((m) => m.method !== splitMethod1)
                .map((m) => (
                  <button
                    key={m.method}
                    onClick={() => setSplitMethod2(m.method)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border p-3 text-left transition-all",
                      splitMethod2 === m.method
                        ? "border-primary/50 bg-primary/5"
                        : "border-white/[0.08] bg-white/[0.02]"
                    )}
                  >
                    <m.icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        splitMethod2 === m.method
                          ? "text-primary"
                          : "text-muted-foreground"
                      )}
                    />
                    <span className="text-xs font-semibold text-foreground">
                      {m.label}
                    </span>
                  </button>
                ))}
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Valor (R$)
              </label>
              <Input
                type="number"
                readOnly
                value={splitAmount2.toFixed(2)}
                className="h-12 text-base rounded-xl bg-white/[0.04] border-white/[0.08] opacity-70 cursor-not-allowed"
                style={{ fontSize: "16px" }}
              />
            </div>
          </div>

          {/* Split validation error */}
          {splitMode && !isSplitValid() && parseFloat(splitAmount1) > 0 && (
            <p className="text-xs text-destructive text-center">
              {splitMethod1 === splitMethod2
                ? "Selecione métodos diferentes"
                : splitAmount2 <= 0
                ? "O valor do pagamento 2 deve ser maior que zero"
                : "Os valores devem somar o total do pedido"}
            </p>
          )}

          {/* Saved cards for split */}
          {splitHasCard && savedCards.length > 0 && (
            <div className="space-y-2 pl-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Cartões salvos
              </h4>
              <RadioGroup
                value={selectedSavedCardId || "new"}
                onValueChange={(val) => {
                  if (val === "new") {
                    setSelectedSavedCardId(null);
                    setUseNewCard(true);
                  } else {
                    setSelectedSavedCardId(val);
                    setUseNewCard(false);
                  }
                }}
              >
                {savedCards.map((card) => (
                  <div
                    key={card.id}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3",
                      selectedSavedCardId === card.id
                        ? "border-primary/50 bg-primary/5"
                        : "border-white/[0.08] bg-white/[0.02]"
                    )}
                  >
                    <RadioGroupItem value={card.id} id={`split-card-${card.id}`} />
                    <Label htmlFor={`split-card-${card.id}`} className="flex-1 cursor-pointer">
                      <p className="text-sm font-semibold text-foreground">
                        {card.card_brand || "Cartão"} ••••{card.card_last_four}
                      </p>
                      {card.card_holder_name && (
                        <p className="text-xs text-muted-foreground">{card.card_holder_name}</p>
                      )}
                    </Label>
                  </div>
                ))}
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3",
                    useNewCard && !selectedSavedCardId
                      ? "border-primary/50 bg-primary/5"
                      : "border-white/[0.08] bg-white/[0.02]"
                  )}
                >
                  <RadioGroupItem value="new" id="split-card-new" />
                  <Label htmlFor="split-card-new" className="cursor-pointer text-sm font-semibold text-foreground">
                    Usar novo cartão
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Card form for split mode */}
          {showSplitCardForm && (savedCards.length === 0 || useNewCard) && (
            <div className="space-y-3 rounded-xl bg-white/[0.04] border border-white/[0.06] p-4">
              <h4 className="text-sm font-bold text-foreground">Dados do cartão</h4>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nome no cartão</label>
                <Input
                  value={cardHolderName}
                  onChange={(e) => setCardHolderName(e.target.value)}
                  placeholder="Como aparece no cartão"
                  className="h-12 text-base rounded-xl bg-white/[0.04] border-white/[0.08]"
                  style={{ fontSize: "16px" }}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Número do cartão</label>
                <Input
                  value={cardNumber}
                  onChange={(e) => setCardNumber(maskCardNumber(e.target.value))}
                  placeholder="0000 0000 0000 0000"
                  inputMode="numeric"
                  maxLength={19}
                  className="h-12 text-base rounded-xl bg-white/[0.04] border-white/[0.08] font-mono"
                  style={{ fontSize: "16px" }}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Mês</label>
                  <Input
                    value={cardExpMonth}
                    onChange={(e) => setCardExpMonth(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    placeholder="MM"
                    inputMode="numeric"
                    maxLength={2}
                    className="h-12 text-base rounded-xl bg-white/[0.04] border-white/[0.08] text-center"
                    style={{ fontSize: "16px" }}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Ano</label>
                  <Input
                    value={cardExpYear}
                    onChange={(e) => setCardExpYear(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    placeholder="AA"
                    inputMode="numeric"
                    maxLength={2}
                    className="h-12 text-base rounded-xl bg-white/[0.04] border-white/[0.08] text-center"
                    style={{ fontSize: "16px" }}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">CVV</label>
                  <Input
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="000"
                    inputMode="numeric"
                    maxLength={4}
                    type="password"
                    className="h-12 text-base rounded-xl bg-white/[0.04] border-white/[0.08] text-center"
                    style={{ fontSize: "16px" }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="save-card-split"
                  checked={saveCard}
                  onCheckedChange={(checked) => setSaveCard(!!checked)}
                />
                <Label htmlFor="save-card-split" className="text-xs text-muted-foreground cursor-pointer">
                  Salvar cartão para próximas compras
                </Label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Security note */}
      <p className="text-[11px] text-muted-foreground/60 text-center flex items-center justify-center gap-1.5">
        <Shield className="h-3.5 w-3.5" />
        {t("consumer_payment_secure")}
      </p>

      {/* Cash warning */}
      {hasCash && (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-1 mt-0.5 shrink-0">
            <Banknote className="h-5 w-5 text-amber-400" />
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-300">
              Pagamento inclui dinheiro
            </p>
            <p className="text-xs text-amber-200/70 mt-1 leading-relaxed">
              {digitalAmount <= 0 ? (
                <>
                  Procure um garçom para pagar{" "}
                  <strong>R$ {cashAmount.toFixed(2)}</strong> em dinheiro e
                  validar seu QR Code.
                </>
              ) : (
                <>
                  A parte em dinheiro (
                  <strong>R$ {cashAmount.toFixed(2)}</strong>) será confirmada
                  por um garçom. A parte digital (
                  <strong>R$ {digitalAmount.toFixed(2)}</strong>) será processada
                  pelo Asaas.
                </>
              )}
            </p>
            <p className="text-[11px] text-amber-200/50 mt-1.5">
              Seu pedido só será enviado ao bar após o garçom confirmar o
              recebimento do dinheiro.
            </p>
          </div>
        </div>
      )}

      {/* Spending limit warning */}
      {limitWarning && (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 animate-in fade-in slide-in-from-top-2">
          <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-300">
              Limite de gastos atingido
            </p>
            <p className="text-xs text-amber-200/70 mt-1 leading-relaxed">
              Seu limite para esta noite é de{" "}
              <strong>R$ {limitWarning.limit.toFixed(2)}</strong>. Você já gastou{" "}
              <strong>R$ {limitWarning.alreadySpent.toFixed(2)}</strong> e com
              este pedido totalizará{" "}
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
        disabled={!canConfirm}
        className="h-14 rounded-2xl text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl active:scale-[0.98] transition-transform w-full"
        style={{ boxShadow: "0 8px 32px hsl(24 100% 50% / 0.35)" }}
      >
        {hasCash
          ? `Criar pedido · R$ ${cart.total.toFixed(2)}`
          : `${t("consumer_payment_confirm")} · R$ ${cart.total.toFixed(2)}`}
      </Button>
    </div>
  );
}
