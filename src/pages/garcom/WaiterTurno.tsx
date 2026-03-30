import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@/i18n/use-translation";
import { useWaiter } from "@/contexts/WaiterContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTION } from "@/config/audit-actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  StopCircle, PlayCircle, DollarSign, ShoppingCart,
  Banknote, CreditCard, Smartphone, Loader2, AlertTriangle,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

type ShiftStats = {
  totalSold: number;
  orderCount: number;
  cashTotal: number;
  posTotal: number;
  pixTotal: number;
  appTotal: number;
};

export default function WaiterTurno() {
  const { t } = useTranslation();
  const {
    sessionId, eventId, eventName, startedAt,
    assignmentType, assignmentValue, cashCollected,
    refreshSession,
  } = useWaiter();
  const { user } = useAuth();

  const [stats, setStats] = useState<ShiftStats>({
    totalSold: 0, orderCount: 0, cashTotal: 0, posTotal: 0, pixTotal: 0, appTotal: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showClosing, setShowClosing] = useState(false);
  const [cashHandover, setCashHandover] = useState("");
  const [notes, setNotes] = useState("");
  const [closing, setClosing] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!user?.id || !eventId || !startedAt) { setLoading(false); return; }

    const { data: orders } = await supabase
      .from("orders")
      .select("total, payment_method, status")
      .eq("event_id", eventId)
      .eq("waiter_id", user.id)
      .gte("created_at", startedAt)
      .neq("status", "cancelled");

    if (!orders) { setLoading(false); return; }

    const active = orders as any[];
    const totalSold = active.reduce((s, o) => s + Number(o.total), 0);
    const orderCount = active.length;
    const cashTotal = active.filter(o => o.payment_method === "cash").reduce((s, o) => s + Number(o.total), 0);
    const posTotal = active.filter(o => ["pos", "debit_card", "credit_card"].includes(o.payment_method)).reduce((s, o) => s + Number(o.total), 0);
    const pixTotal = active.filter(o => o.payment_method === "pix").reduce((s, o) => s + Number(o.total), 0);
    const appTotal = active.filter(o => !["cash", "pos", "debit_card", "credit_card", "pix"].includes(o.payment_method || "")).reduce((s, o) => s + Number(o.total), 0);

    setStats({ totalSold, orderCount, cashTotal, posTotal, pixTotal, appTotal });
    setLoading(false);
  }, [user?.id, eventId, startedAt]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const startedTime = startedAt ? new Date(startedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";

  const handleConfirmClose = () => {
    setShowConfirm(false);
    setCashHandover(stats.cashTotal.toFixed(2));
    setShowClosing(true);
  };

  const cashHandoverNum = parseFloat(cashHandover) || 0;
  const discrepancy = cashHandoverNum - stats.cashTotal;

  const handleClose = async () => {
    if (!sessionId) return;
    setClosing(true);
    try {
      const { data, error } = await supabase.rpc("close_waiter_session", {
        p_session_id: sessionId,
        p_cash_handed_over: cashHandoverNum,
      });
      if (error) throw error;
      const res = data as any;
      if (res?.ok === false) {
        toast({ title: "Erro", description: res.error, variant: "destructive" });
        setClosing(false);
        return;
      }

      // Update notes if provided
      if (notes.trim()) {
        await supabase
          .from("waiter_sessions" as any)
          .update({ notes: notes.trim() } as any)
          .eq("id", sessionId);
      }

      await logAudit({
        action: AUDIT_ACTION.WAITER_SESSION_CLOSED,
        entityType: "waiter_session",
        entityId: sessionId,
        metadata: { cash_handed_over: cashHandoverNum, discrepancy },
      });
      await logAudit({
        action: AUDIT_ACTION.WAITER_CASH_HANDOVER,
        entityType: "waiter_session",
        entityId: sessionId,
        metadata: { amount: cashHandoverNum, expected: stats.cashTotal, discrepancy },
      });

      toast({ title: "Turno encerrado com sucesso" });
      setShowClosing(false);
      await refreshSession();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setClosing(false);
    }
  };

  // No active session — show placeholder
  if (!sessionId) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
          <PlayCircle className="h-10 w-10 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">{t("waiter_start_shift")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Selecione o evento e inicie seu turno para começar.
          </p>
        </div>
      </div>
    );
  }

  // Closing screen
  if (showClosing) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-bold text-foreground">Fechamento de Turno</h1>

        {/* Summary */}
        <Card className="border-border/40 bg-card/60">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Resumo de vendas</h3>
            <div className="space-y-2 text-sm">
              <Row label="Total vendido" value={`R$ ${stats.totalSold.toFixed(2)}`} />
              <Row label="Pedidos" value={String(stats.orderCount)} />
              <div className="border-t border-border/30 pt-2 space-y-1">
                <Row label="Dinheiro" value={`R$ ${stats.cashTotal.toFixed(2)}`} />
                <Row label="POS/Cartão" value={`R$ ${stats.posTotal.toFixed(2)}`} />
                <Row label="PIX" value={`R$ ${stats.pixTotal.toFixed(2)}`} />
                {stats.appTotal > 0 && <Row label="App do Cliente" value={`R$ ${stats.appTotal.toFixed(2)}`} />}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cash handover */}
        <Card className="border-border/40 bg-card/60">
          <CardContent className="p-4 space-y-3">
            <label className="text-sm font-semibold text-muted-foreground">
              Valor em dinheiro a repassar *
            </label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={cashHandover}
              onChange={e => setCashHandover(e.target.value)}
              placeholder="0.00"
              className="text-lg h-12"
            />

            {cashHandover && Math.abs(discrepancy) > 0.01 && (
              <div className={`flex items-center gap-2 rounded-xl p-3 text-sm ${
                discrepancy > 0
                  ? "bg-yellow-500/10 border border-yellow-500/30 text-yellow-400"
                  : "bg-destructive/10 border border-destructive/30 text-destructive"
              }`}>
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  Diferença de R$ {Math.abs(discrepancy).toFixed(2)}
                  {discrepancy > 0 ? " (a mais)" : " (a menos)"}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card className="border-border/40 bg-card/60">
          <CardContent className="p-4 space-y-2">
            <label className="text-sm font-semibold text-muted-foreground">
              Observações (opcional)
            </label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ex: diferença explicada por troco..."
              className="min-h-[80px]"
            />
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 h-12" onClick={() => setShowClosing(false)}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            className="flex-1 h-12"
            disabled={!cashHandover || closing}
            onClick={handleClose}
          >
            {closing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Confirmar Fechamento
          </Button>
        </div>
      </div>
    );
  }

  // Active shift dashboard
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-foreground">{t("waiter_shift")}</h1>

      {/* Active badge */}
      <div className="flex items-center gap-2 rounded-xl bg-green-500/10 border border-green-500/30 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
        <span className="text-sm font-semibold text-green-400">
          Turno ativo desde {startedTime}
        </span>
      </div>

      {/* Event info */}
      {eventName && (
        <p className="text-sm text-muted-foreground">
          Evento: <span className="text-foreground font-medium">{eventName}</span>
          {assignmentType && (
            <> · {t(assignmentType === "tables" ? "waiter_tables" : assignmentType === "sector" ? "waiter_sector" : "waiter_free")}
            {assignmentValue ? `: ${assignmentValue}` : ""}</>
          )}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={DollarSign} label="Total vendido" value={`R$ ${stats.totalSold.toFixed(2)}`} />
            <StatCard icon={ShoppingCart} label="Pedidos" value={String(stats.orderCount)} />
            <StatCard icon={Banknote} label="Dinheiro" value={`R$ ${stats.cashTotal.toFixed(2)}`} highlight />
            <StatCard icon={CreditCard} label="POS/Cartão" value={`R$ ${stats.posTotal.toFixed(2)}`} />
            <StatCard icon={Smartphone} label="PIX" value={`R$ ${stats.pixTotal.toFixed(2)}`} />
            {stats.appTotal > 0 && (
              <StatCard icon={Smartphone} label="App" value={`R$ ${stats.appTotal.toFixed(2)}`} />
            )}
          </div>
        </>
      )}

      {/* End shift */}
      <Button
        variant="destructive"
        className="w-full h-14 text-base"
        onClick={() => setShowConfirm(true)}
      >
        <StopCircle className="h-5 w-5 mr-2" />
        {t("waiter_end_shift")}
      </Button>

      {/* Confirm dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="max-w-[360px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar turno?</AlertDialogTitle>
            <AlertDialogDescription>
              Você não poderá mais criar pedidos ou aceitar chamados após encerrar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClose} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, highlight }: {
  icon: React.ElementType; label: string; value: string; highlight?: boolean;
}) {
  return (
    <Card className={`border-border/40 ${highlight ? "bg-primary/10 border-primary/30" : "bg-card/60"}`}>
      <CardContent className="p-4 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${highlight ? "text-primary" : "text-muted-foreground"}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <span className={`text-lg font-bold ${highlight ? "text-primary" : "text-foreground"}`}>
          {value}
        </span>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
