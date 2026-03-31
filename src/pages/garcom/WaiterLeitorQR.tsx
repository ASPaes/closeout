import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "@/i18n/use-translation";
import { WaiterSessionGuard } from "@/components/WaiterSessionGuard";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTION } from "@/config/audit-actions";
import { vibrate } from "@/lib/native-bridge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ScanLine, CheckCircle2, XCircle, Camera, Keyboard, Loader2,
  Minus, Plus, Package, Banknote, AlertTriangle, Clock,
} from "lucide-react";
import { toast as sonnerToast } from "sonner";

type OrderItem = {
  order_item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
  delivered_quantity: number;
  remaining: number;
};

type ValidationResult = {
  success: boolean;
  error?: string;
  message?: string;
  cash_pending?: boolean;
  order?: {
    id: string;
    order_number: number;
    total?: number;
    items?: OrderItem[];
    delivered_at?: string;
  };
  payments?: Array<{ payment_method: string; amount: number; status: string }>;
};

type DeliveryResult = {
  fully_delivered: boolean;
};

type ViewState = "scanner" | "loading" | "result" | "confirming" | "done" | "cash_pending";

function playBeep(type: "success" | "partial" | "error") {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = type === "success" ? 1000 : type === "partial" ? 600 : 300;
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    // audio not available
  }
}

export default function WaiterLeitorQR() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [viewState, setViewState] = useState<ViewState>("scanner");
  const [useCamera, setUseCamera] = useState(true);
  const [manualToken, setManualToken] = useState("");
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [resultType, setResultType] = useState<string>("invalid");
  const [deliveryQty, setDeliveryQty] = useState<Record<string, number>>({});
  const [fullyDelivered, setFullyDelivered] = useState<boolean | null>(null);
  const [cashPendingData, setCashPendingData] = useState<{
    order_id: string;
    order_number: number;
    cash_amount: number;
    digital_amount: number;
    is_split: boolean;
  } | null>(null);
  const [confirmingCash, setConfirmingCash] = useState(false);
  const autoResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scannerRef = useRef<any>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const isProcessingRef = useRef(false);

  const validate = useCallback(async (token: string) => {
    if (!user?.id || !token.trim() || isProcessingRef.current) return;
    isProcessingRef.current = true;
    setViewState("loading");

    try {
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

      if (res.success && res.cash_pending) {
        // Order is partially_paid — show cash confirmation screen
        const cashPayment = (res.payments || []).find((p) => p.payment_method === "cash" && p.status === "created");
        const digitalPayments = (res.payments || []).filter((p) => p.payment_method !== "cash" && p.status === "approved");
        const digitalAmount = digitalPayments.reduce((s, p) => s + Number(p.amount), 0);

        setCashPendingData({
          order_id: res.order?.id || "",
          order_number: res.order?.order_number || 0,
          cash_amount: cashPayment ? Number(cashPayment.amount) : 0,
          digital_amount: digitalAmount,
          is_split: digitalAmount > 0,
        });
        playBeep("partial");
        setViewState("cash_pending");
      } else if (res.success) {
        const items = res.order?.items || [];
        const allDone = items.every((it) => it.remaining === 0);

        if (allDone) {
          setResultType("all_delivered");
          playBeep("error");
          setViewState("result");
        } else {
          setResultType("valid");
          const init: Record<string, number> = {};
          items.forEach((it) => {
            init[it.order_item_id] = 0;
          });
          setDeliveryQty(init);
          setViewState("result");
        }
      } else if (res.error === "ALREADY_USED") {
        setResultType("already_used");
        playBeep("error");
        setViewState("result");
      } else if (res.error === "CANCELLED") {
        setResultType("cancelled");
        playBeep("error");
        setViewState("result");
      } else {
        setResultType("invalid");
        playBeep("error");
        setViewState("result");
      }
    } catch (err: any) {
      setResult({ success: false, error: "UNKNOWN", message: err.message || "Erro desconhecido" });
      setResultType("invalid");
      playBeep("error");
      setViewState("result");
    } finally {
      isProcessingRef.current = false;
    }
  }, [user?.id]);

  const handleConfirmCashFromQR = useCallback(async () => {
    if (!cashPendingData || !user?.id) return;
    setConfirmingCash(true);
    try {
      const { data, error } = await supabase.rpc("confirm_cash_split_payment", {
        p_order_id: cashPendingData.order_id,
        p_staff_id: user.id,
      });
      if (error) throw error;
      const res = data as any;
      if (res?.fully_paid) {
        vibrate(200);
        sonnerToast.success(t("waiter_cash_confirmed_toast"));
      }
      await logAudit({
        action: AUDIT_ACTION.PAYMENT_CASH_CONFIRMED,
        entityType: "order",
        entityId: cashPendingData.order_id,
        metadata: { staff_id: user.id },
      });
      // After confirming cash, reset scanner so they can scan again for delivery
      resetScanner();
    } catch (err: any) {
      sonnerToast.error(t("waiter_cash_confirm_error"), { description: err.message });
    } finally {
      setConfirmingCash(false);
    }
  }, [cashPendingData, user?.id, t]);
  const confirmDelivery = useCallback(async () => {
    if (!result?.order?.id || !user?.id) return;

    const items = Object.entries(deliveryQty)
      .filter(([, qty]) => qty > 0)
      .map(([order_item_id, quantity]) => ({ order_item_id, quantity }));

    if (items.length === 0) return;

    setViewState("confirming");

    try {
      const { data, error } = await supabase.rpc("confirm_partial_delivery", {
        p_order_id: result.order.id,
        p_items: items as any,
        p_staff_id: user.id,
      });

      if (error) throw error;

      const deliveryRes = data as unknown as DeliveryResult;
      setFullyDelivered(deliveryRes.fully_delivered);
      setViewState("done");

      if (deliveryRes.fully_delivered) {
        playBeep("success");
      } else {
        playBeep("partial");
      }

      await logAudit({
        action: deliveryRes.fully_delivered
          ? AUDIT_ACTION.WAITER_PICKUP_CONFIRMED
          : AUDIT_ACTION.BAR_ORDER_PARTIAL_DELIVERY,
        entityType: "order",
        entityId: result.order.id,
        metadata: {
          order_number: result.order.order_number,
          delivery_type: deliveryRes.fully_delivered ? "complete" : "partial",
          items,
        },
      });

      autoResetRef.current = setTimeout(() => resetScanner(), 5000);
    } catch (err: any) {
      setResult({ success: false, error: "UNKNOWN", message: err.message || "Erro ao registrar entrega" });
      setResultType("invalid");
      playBeep("error");
      setViewState("result");
    }
  }, [result, user?.id, deliveryQty]);

  const resetScanner = useCallback(() => {
    if (autoResetRef.current) clearTimeout(autoResetRef.current);
    setViewState("scanner");
    setResult(null);
    setResultType("invalid");
    setManualToken("");
    setDeliveryQty({});
    setFullyDelivered(null);
    setCashPendingData(null);
    setConfirmingCash(false);
    isProcessingRef.current = false;
  }, []);

  const fillAll = useCallback(() => {
    const items = result?.order?.items || [];
    const init: Record<string, number> = {};
    items.forEach((it) => {
      init[it.order_item_id] = it.remaining;
    });
    setDeliveryQty(init);
  }, [result]);

  // Camera scanner
  useEffect(() => {
    if (viewState !== "scanner" || !useCamera || !videoContainerRef.current) return;
    let html5QrCode: any = null;
    let mounted = true;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!mounted) return;
        html5QrCode = new Html5Qrcode("waiter-qr-reader");
        scannerRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            if (!isProcessingRef.current) validate(decodedText);
          },
          () => {}
        );
      } catch (err) {
        console.error("Camera error:", err);
      }
    };
    startScanner();

    return () => {
      mounted = false;
      if (html5QrCode) { try { html5QrCode.stop(); } catch { /* */ } }
      scannerRef.current = null;
    };
  }, [viewState, useCamera, validate]);

  useEffect(() => {
    return () => { if (autoResetRef.current) clearTimeout(autoResetRef.current); };
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualToken.trim()) validate(manualToken.trim());
  };

  const totalSelected = Object.values(deliveryQty).reduce((sum, q) => sum + q, 0);

  return (
    <WaiterSessionGuard>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-foreground">{t("waiter_qr_reader")}</h1>

        {/* Loading */}
        {viewState === "loading" && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <p className="text-lg text-muted-foreground">{t("bar_qr_validating")}</p>
          </div>
        )}

        {/* Cash Pending */}
        {viewState === "cash_pending" && cashPendingData && (
          <div className="max-w-lg mx-auto space-y-4">
            <Card className="border-2 border-warning/50 bg-warning/10">
              <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-4">
                <div className="relative">
                  <Banknote className="h-20 w-20 text-warning" />
                  <AlertTriangle className="h-8 w-8 text-warning absolute -bottom-1 -right-1" />
                </div>
                <h2 className="text-xl font-bold text-foreground">
                  {t("waiter_qr_cash_pending")}
                </h2>
                <p className="text-2xl font-mono font-bold text-primary">
                  #{String(cashPendingData.order_number).padStart(3, "0")}
                </p>

                <div className="w-full space-y-2 text-left px-4">
                  <div className="flex items-center justify-between rounded-lg bg-warning/10 border border-warning/20 p-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-warning" />
                      <span className="text-sm text-foreground">{t("waiter_qr_cash_to_receive")}</span>
                    </div>
                    <span className="font-mono font-bold text-warning">
                      R$ {cashPendingData.cash_amount.toFixed(2)}
                    </span>
                  </div>

                  {cashPendingData.is_split && cashPendingData.digital_amount > 0 && (
                    <div className="flex items-center justify-between rounded-lg bg-success/10 border border-success/20 p-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        <span className="text-sm text-foreground">{t("waiter_qr_cash_already_paid")}</span>
                      </div>
                      <span className="font-mono font-bold text-success">
                        R$ {cashPendingData.digital_amount.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                <Button
                  className="w-full h-14 rounded-2xl text-base"
                  onClick={handleConfirmCashFromQR}
                  disabled={confirmingCash}
                >
                  {confirmingCash ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <Banknote className="h-5 w-5 mr-2" />
                  )}
                  {t("waiter_confirm_cash")} · R$ {cashPendingData.cash_amount.toFixed(2)}
                </Button>
              </CardContent>
            </Card>

            <Button variant="ghost" className="w-full" onClick={resetScanner}>
              <ScanLine className="h-4 w-4 mr-2" />
              {t("bar_qr_try_another")}
            </Button>
          </div>
        )}

        {/* Confirming delivery */}
        {viewState === "confirming" && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <p className="text-lg text-muted-foreground">{t("bar_qr_confirming")}</p>
          </div>
        )}

        {/* Scanner */}
        {viewState === "scanner" && (
          <div className="space-y-4 max-w-lg mx-auto">
            <div className="flex gap-2 justify-center">
              <Button variant={useCamera ? "default" : "outline"} size="sm" onClick={() => setUseCamera(true)}>
                <Camera className="h-4 w-4 mr-2" />
                {t("bar_qr_camera")}
              </Button>
              <Button variant={!useCamera ? "default" : "outline"} size="sm" onClick={() => setUseCamera(false)}>
                <Keyboard className="h-4 w-4 mr-2" />
                {t("bar_qr_manual")}
              </Button>
            </div>

            {useCamera ? (
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div id="waiter-qr-reader" ref={videoContainerRef} className="w-full min-h-[300px]" />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <form onSubmit={handleManualSubmit} className="space-y-4">
                    <Input
                      value={manualToken}
                      onChange={e => setManualToken(e.target.value)}
                      placeholder={t("bar_qr_token_placeholder")}
                      autoFocus
                      className="text-lg"
                    />
                    <Button type="submit" className="w-full h-12" disabled={!manualToken.trim()}>
                      <ScanLine className="h-4 w-4 mr-2" />
                      {t("bar_validate")}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Delivery done */}
        {viewState === "done" && result?.order && (
          <div className="max-w-lg mx-auto space-y-4">
            <Card className={`border-2 ${fullyDelivered ? "bg-green-500/20 border-green-500/50" : "bg-warning/20 border-warning/50"}`}>
              <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-4">
                <CheckCircle2 className={`h-20 w-20 ${fullyDelivered ? "text-green-500" : "text-warning"}`} />
                <h2 className="text-2xl font-bold">
                  {fullyDelivered ? t("bar_full_delivery") : t("bar_partial_delivery")}
                </h2>
                <p className="text-xl font-mono font-bold text-primary">
                  {t("bar_qr_order_prefix")} #{String(result.order.order_number).padStart(3, "0")}
                </p>
                {!fullyDelivered && (
                  <p className="text-sm text-muted-foreground">{t("bar_qr_continue_active")}</p>
                )}
              </CardContent>
            </Card>
            <Button onClick={resetScanner} className="w-full" size="lg">
              <ScanLine className="h-4 w-4 mr-2" />
              {t("bar_qr_next")}
            </Button>
            <p className="text-xs text-center text-muted-foreground">{t("bar_qr_auto_reset")}</p>
          </div>
        )}

        {/* Result — valid: item selection */}
        {viewState === "result" && result && resultType === "valid" && result.order && (
          <div className="max-w-lg mx-auto space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">
                    {t("bar_qr_order_prefix")} #{String(result.order.order_number).padStart(3, "0")}
                  </h2>
                  <Badge variant="outline" className="text-primary border-primary">
                    <Package className="h-3 w-3 mr-1" />
                    {t("bar_select_items_deliver")}
                  </Badge>
                </div>

                <div className="space-y-3 mt-4">
                  {(result.order.items || []).map((item) => {
                    const selected = deliveryQty[item.order_item_id] || 0;
                    const isDone = item.remaining === 0;
                    const isMaxed = selected === item.remaining;

                    return (
                      <div
                        key={item.order_item_id}
                        className={`rounded-lg border p-3 transition-colors ${
                          isDone
                            ? "opacity-50 bg-muted/30 border-border/40"
                            : isMaxed
                            ? "bg-green-500/10 border-green-500/30"
                            : selected === 0
                            ? "opacity-50 bg-secondary/30 border-border/60"
                            : "bg-secondary/50 border-border/60"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.quantity} {t("bar_qr_units")}
                              {item.delivered_quantity > 0 && (
                                <> · {item.delivered_quantity} {t("bar_already_delivered")}</>
                              )}
                              {!isDone && (
                                <> · <span className="text-primary">{item.remaining} {t("bar_remaining")}</span></>
                              )}
                            </p>
                          </div>

                          {isDone ? (
                            <Badge variant="secondary" className="shrink-0">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {t("bar_already_delivered")}
                            </Badge>
                          ) : (
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-full"
                                onClick={() =>
                                  setDeliveryQty((prev) => ({
                                    ...prev,
                                    [item.order_item_id]: Math.max(0, (prev[item.order_item_id] || 0) - 1),
                                  }))
                                }
                                disabled={selected === 0}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="w-8 text-center font-mono text-lg font-bold">
                                {selected}
                              </span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-full"
                                onClick={() =>
                                  setDeliveryQty((prev) => ({
                                    ...prev,
                                    [item.order_item_id]: Math.min(item.remaining, (prev[item.order_item_id] || 0) + 1),
                                  }))
                                }
                                disabled={selected === item.remaining}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={fillAll}>
                {t("bar_deliver_all")}
              </Button>
            </div>

            <Button
              className="w-full"
              size="lg"
              disabled={totalSelected === 0}
              onClick={confirmDelivery}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {t("bar_deliver_selected")} ({totalSelected})
            </Button>

            <Button variant="ghost" className="w-full" onClick={resetScanner}>
              <ScanLine className="h-4 w-4 mr-2" />
              {t("bar_qr_try_another")}
            </Button>
          </div>
        )}

        {/* Result — errors */}
        {viewState === "result" && result && resultType !== "valid" && (
          <ErrorCard result={result} resultType={resultType} onReset={resetScanner} t={t} />
        )}
      </div>
    </WaiterSessionGuard>
  );
}

function ErrorCard({
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
  const titleMap: Record<string, string> = {
    already_used: t("bar_qr_used"),
    cancelled: t("bar_qr_cancelled"),
    invalid: t("bar_qr_invalid"),
    all_delivered: t("bar_qr_all_delivered"),
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <Card className="bg-destructive/20 border-destructive/50 border-2">
        <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-4">
          <XCircle className="h-20 w-20 text-destructive" />
          <h2 className="text-2xl font-bold">{titleMap[resultType] || titleMap.invalid}</h2>

          {resultType === "already_used" && result.order && (
            <p className="text-sm text-muted-foreground">
              {t("bar_qr_order_prefix")} #{String(result.order.order_number).padStart(3, "0")}
              {result.order.delivered_at && (
                <> — {new Date(result.order.delivered_at).toLocaleString("pt-BR")}</>
              )}
            </p>
          )}

          {result.message && resultType !== "already_used" && (
            <p className="text-sm text-muted-foreground">{result.message}</p>
          )}
        </CardContent>
      </Card>

      <Button onClick={onReset} className="w-full" size="lg">
        <ScanLine className="h-4 w-4 mr-2" />
        {t("bar_qr_try_another")}
      </Button>
    </div>
  );
}
