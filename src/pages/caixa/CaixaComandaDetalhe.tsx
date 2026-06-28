import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Banknote, CreditCard, QrCode, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

type PayMethod = "dinheiro" | "pix" | "credit_card" | "debit_card";

type OrderItem = {
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
  delivered_quantity: number;
};

type OrderDetail = {
  order_id: string;
  order_number: number | string;
  status: string;
  table_number: number | string | null;
  is_external_area: boolean;
  created_at: string;
  items: OrderItem[];
};

type ComandaDetail = {
  comanda_id: string;
  card_number: number | string;
  status: "open" | "paid" | "unsettled" | string;
  consumer_name: string;
  consumer_phone: string | null;
  opened_at: string;
  paid_at: string | null;
  paid_method: string | null;
  paid_via: string | null;
  total: number;
  orders: OrderDetail[];
};

function brl(v: number) {
  return Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  preparing: "Preparando",
  ready: "Pronto",
  partially_delivered: "Entrega parcial",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

function orderStatusBadge(status: string) {
  const label = ORDER_STATUS_LABEL[status] ?? status;
  const cls =
    status === "delivered"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : status === "ready"
      ? "bg-primary/15 text-primary border-primary/30"
      : status === "preparing"
      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
      : status === "partially_delivered"
      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
      : status === "cancelled"
      ? "bg-muted text-muted-foreground"
      : "bg-muted text-muted-foreground";
  return <Badge variant="outline" className={cls}>{label}</Badge>;
}

function comandaStatusBadge(status: string) {
  if (status === "paid") {
    return <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Paga</Badge>;
  }
  if (status === "unsettled") {
    return <Badge variant="destructive">Não recebida</Badge>;
  }
  return <Badge variant="outline">Aberta</Badge>;
}

const METHOD_OPTIONS: { value: PayMethod; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "dinheiro", label: "Dinheiro", icon: Banknote },
  { value: "pix", label: "PIX", icon: QrCode },
  { value: "credit_card", label: "Crédito", icon: CreditCard },
  { value: "debit_card", label: "Débito", icon: CreditCard },
];

export default function CaixaComandaDetalhe() {
  const { comandaId } = useParams<{ comandaId: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<ComandaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState<PayMethod | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const loadDetail = async () => {
    if (!comandaId) return;
    const { data, error } = await supabase.rpc("get_comanda_detail", { p_comanda_id: comandaId });
    if (error || !data) {
      toast.error("Comanda não encontrada");
      navigate("/caixa/comandas");
      return;
    }
    setDetail(data as unknown as ComandaDetail);
    setLoading(false);
  };

  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comandaId]);

  const handleCancelOrder = async (orderId: string) => {
    setCancelingId(orderId);
    try {
      const { error } = await supabase.rpc("cancel_comanda_order", {
        p_order_id: orderId,
        p_reason: "cashier_cancel",
      });
      if (error) {
        toast.error(error.message || "Não foi possível cancelar este pedido");
        return;
      }
      toast.success("Pedido cancelado");
      await loadDetail();
    } finally {
      setCancelingId(null);
    }
  };

  const handleFinalize = async () => {
    if (!comandaId || !selectedMethod) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("close_comanda_caixa", {
        p_comanda_id: comandaId,
        p_method: selectedMethod,
      });
      if (error) {
        toast.error(error.message || "Erro ao finalizar comanda");
        return;
      }
      toast.success("Comanda finalizada");
      navigate(`/caixa/comandas/${comandaId}/comprovante`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !detail) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isOpen = detail.status === "open";

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/caixa/comandas")} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">Comanda #{detail.card_number}</h1>
              {!isOpen && comandaStatusBadge(detail.status)}
            </div>
            <p className="text-muted-foreground mt-1">{detail.consumer_name}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total</p>
          <p className="text-3xl font-bold text-primary">{brl(Number(detail.total))}</p>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Pedidos ({detail.orders?.length ?? 0})
        </h2>
        {(detail.orders ?? []).map((order) => {
          const isCancelled = order.status === "cancelled";
          const isUntouched =
            !isCancelled && (order.items ?? []).every((it) => Number(it.delivered_quantity ?? 0) === 0);
          const canCancel = isOpen && isUntouched;

          return (
            <Card key={order.order_id} className={isCancelled ? "opacity-50" : ""}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-semibold">Pedido #{order.order_number}</span>
                    {orderStatusBadge(order.status)}
                    {order.is_external_area ? (
                      <Badge variant="outline">Área externa</Badge>
                    ) : order.table_number != null ? (
                      <Badge variant="outline">Mesa {order.table_number}</Badge>
                    ) : null}
                  </div>
                  {canCancel && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={cancelingId === order.order_id}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Cancelar pedido
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancelar pedido #{order.order_number}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. O pedido será removido da comanda e o estoque
                            devolvido.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Voltar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleCancelOrder(order.order_id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Cancelar pedido
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
                <ul className="divide-y divide-border/50 text-sm">
                  {(order.items ?? []).map((it, idx) => (
                    <li key={idx} className="py-1.5 flex items-center justify-between gap-2">
                      <span>
                        {it.quantity}x {it.name}
                      </span>
                      <span className="text-muted-foreground">{brl(Number(it.total))}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
        {(!detail.orders || detail.orders.length === 0) && (
          <p className="text-sm text-muted-foreground">Nenhum pedido nesta comanda.</p>
        )}
      </div>

      {isOpen && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <h2 className="text-base font-semibold">Forma de pagamento</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pagamento recebido fora do app (controle).
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {METHOD_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = selectedMethod === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedMethod(opt.value)}
                    className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-4 transition-colors ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/40 hover:bg-accent/40"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-sm font-medium">{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <Button
              className="w-full h-14 text-base rounded-2xl"
              disabled={!selectedMethod || submitting}
              onClick={handleFinalize}
              style={selectedMethod ? { boxShadow: "0 8px 32px hsl(24 100% 50% / 0.35)" } : undefined}
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 mr-1" />
                  Finalizar pagamento · {brl(Number(detail.total))}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}