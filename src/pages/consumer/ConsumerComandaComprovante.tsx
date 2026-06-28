import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, Receipt } from "lucide-react";
import { toast } from "sonner";

type ComprovanteData = {
  card_number: string;
  consumer_name: string;
  event_name: string;
  total: number;
  paid_at: string;
  paid_method: string;
};

const methodLabels: Record<string, string> = {
  pix: "PIX",
  credit_card: "Crédito",
  debit_card: "Débito",
  dinheiro: "Dinheiro",
  cash: "Dinheiro",
};

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function ConsumerComandaComprovante() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const orderId = params.get("order");
  const { user } = useAuth();

  const [data, setData] = useState<ComprovanteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function load() {
      if (!orderId || !user) {
        setError(true);
        setLoading(false);
        return;
      }

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("comanda_id, event_id")
        .eq("id", orderId)
        .eq("consumer_id", user.id)
        .single();

      if (orderError || !order?.comanda_id || !order?.event_id) {
        setError(true);
        setLoading(false);
        return;
      }

      const { data: detail, error: detailError } = await supabase.rpc(
        "get_comanda_detail",
        { p_comanda_id: order.comanda_id },
      );

      if (detailError || !detail || detail.status !== "paid") {
        setError(true);
        setLoading(false);
        return;
      }

      const { data: eventRow, error: eventError } = await supabase
        .from("events")
        .select("name")
        .eq("id", order.event_id)
        .single();

      if (eventError || !eventRow) {
        setError(true);
        setLoading(false);
        return;
      }

      setData({
        card_number: String(detail.card_number ?? ""),
        consumer_name: detail.consumer_name ?? "—",
        event_name: eventRow.name ?? "—",
        total: Number(detail.total ?? 0),
        paid_at: detail.paid_at,
        paid_method: detail.paid_method ?? "",
      });
      setLoading(false);
    }

    load();
  }, [orderId, user]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando comprovante...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center space-y-6">
          <Receipt className="w-16 h-16 mx-auto text-muted-foreground" />
          <h1 className="text-2xl font-bold text-foreground">Comprovante indisponível</h1>
          <p className="text-sm text-muted-foreground">
            Não encontramos uma comanda paga vinculada a este pedido.
          </p>
          <Button
            className="w-full h-14 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            onClick={() => navigate("/app")}
          >
            Voltar ao início
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center px-6 py-8">
      <div className="w-full max-w-[420px] relative">
        {/* Ticket decorative top edge */}
        <div className="absolute -top-1 left-4 right-4 h-3 flex justify-between">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="w-5 h-5 rounded-full bg-background" />
          ))}
        </div>

        <div className="relative bg-gradient-to-b from-card to-[#0f0f0f] border border-border rounded-3xl overflow-hidden shadow-2xl shadow-black/50">
          {/* Subtle texture */}
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle at 2px 2px, hsl(var(--primary)) 1px, transparent 0)",
              backgroundSize: "16px 16px",
            }}
          />

          {/* Dashed border overlay */}
          <div
            className="absolute inset-3 border border-dashed border-border/50 rounded-2xl pointer-events-none"
            aria-hidden="true"
          />

          <div className="relative p-8 flex flex-col items-center text-center space-y-6">
            {/* Paid stamp */}
            <div className="animate-in zoom-in fade-in duration-500">
              <div className="relative">
                <div className="absolute inset-0 bg-success/20 rounded-full blur-xl" />
                <div className="relative w-24 h-24 rounded-full bg-success/10 border-2 border-success flex items-center justify-center glow-sm">
                  <CheckCircle2 className="w-12 h-12 text-success" />
                </div>
              </div>
              <p className="mt-3 text-sm font-bold tracking-widest text-success uppercase">
                Pago
              </p>
            </div>

            {/* Comanda number */}
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                Comanda
              </p>
              <h1 className="text-6xl sm:text-7xl font-black text-primary text-glow leading-none">
                #{data.card_number}
              </h1>
            </div>

            {/* Consumer & event */}
            <div className="space-y-1 w-full">
              <p className="text-lg font-semibold text-foreground truncate">
                {data.consumer_name}
              </p>
              <p className="text-sm text-muted-foreground truncate">{data.event_name}</p>
            </div>

            {/* Live clock + paid date */}
            <div className="w-full rounded-2xl bg-secondary/50 border border-border/60 px-5 py-4 flex items-center justify-between">
              <div className="text-left">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Pago em
                </p>
                <p className="text-sm font-medium text-foreground">{formatDate(data.paid_at)}</p>
              </div>
              <div className="flex items-center gap-2 text-success">
                <Clock className="w-4 h-4" />
                <span className="text-xl font-black tabular-nums">{formatTime(now)}</span>
              </div>
            </div>

            {/* Total */}
            <div className="w-full pt-2 border-t border-border/60">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Total pago
              </p>
              <p className="text-3xl font-black text-foreground mt-1">
                {formatCurrency(data.total)}
              </p>
            </div>

            {/* Method */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/50 border border-primary/20 text-primary text-sm font-semibold">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Pagamento: {methodLabels[data.paid_method] ?? data.paid_method}
            </div>
          </div>

          {/* Bottom decorative strip */}
          <div className="h-2 w-full bg-gradient-to-r from-primary/0 via-primary/60 to-primary/0" />
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4 px-4">
          Este comprovante é atualizado ao vivo. A hora deve corresponder ao momento da conferência.
        </p>

        <Button
          variant="ghost"
          className="w-full mt-6 h-12 text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/app")}
        >
          Voltar ao início
        </Button>
      </div>
    </div>
  );
}
