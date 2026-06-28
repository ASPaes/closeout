import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCaixa } from "@/contexts/CaixaContext";
import { ThermalReceipt, printThermalReceipt } from "@/components/caixa/ThermalReceipt";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

type ComandaDetail = {
  card_number: number | string;
  consumer_name: string;
  status: string;
  paid_at: string | null;
  paid_method: string | null;
  total: number;
};

const PAID_METHOD_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  credit_card: "Crédito",
  debit_card: "Débito",
};

function brl(v: number) {
  return Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CaixaComandaComprovante() {
  const { comandaId } = useParams<{ comandaId: string }>();
  const navigate = useNavigate();
  const { eventId, eventName, operatorName } = useCaixa();
  const receiptRef = useRef<HTMLDivElement>(null);
  const printedRef = useRef(false);

  const [detail, setDetail] = useState<ComandaDetail | null>(null);
  const [venueName, setVenueName] = useState<string | undefined>(undefined);
  const [resolvedEventName, setResolvedEventName] = useState<string | undefined>(
    eventName ?? undefined,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!comandaId) return;
      const { data, error } = await supabase.rpc("get_comanda_detail", {
        p_comanda_id: comandaId,
      });
      if (cancelled) return;
      if (error || !data) {
        toast.error("Comanda não encontrada");
        navigate("/caixa/comandas");
        return;
      }
      setDetail(data as unknown as ComandaDetail);

      if (eventId) {
        const { data: ev } = await supabase
          .from("events")
          .select("name, venue:venues(name)")
          .eq("id", eventId)
          .single();
        if (!cancelled && ev) {
          setResolvedEventName((ev as any).name ?? eventName ?? undefined);
          setVenueName((ev as any).venue?.name ?? undefined);
        }
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [comandaId, eventId, eventName, navigate]);

  useEffect(() => {
    if (detail && detail.status === "paid" && !printedRef.current) {
      printedRef.current = true;
      setTimeout(() => printThermalReceipt(), 300);
    }
  }, [detail]);

  if (loading || !detail) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (detail.status !== "paid") {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <h2 className="text-lg font-semibold">Comanda ainda não paga</h2>
        <p className="text-sm text-muted-foreground">
          Finalize o pagamento antes de imprimir o comprovante.
        </p>
        <Button variant="outline" onClick={() => navigate(`/caixa/comandas/${comandaId}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar à comanda
        </Button>
      </div>
    );
  }

  const comandaData = {
    cardNumber: Number(detail.card_number),
    consumerName: detail.consumer_name,
    eventName: resolvedEventName ?? "",
    total: Number(detail.total),
    paidMethod: detail.paid_method ?? "",
    paidAt: detail.paid_at ?? new Date().toISOString(),
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/caixa/comandas")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Comprovante</h1>
          <p className="text-sm text-muted-foreground">Comanda #{detail.card_number}</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
            <span className="text-lg font-semibold">Pagamento registrado</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Cliente</p>
              <p className="font-medium">{detail.consumer_name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Forma</p>
              <p className="font-medium">
                {PAID_METHOD_LABELS[detail.paid_method ?? ""] ?? detail.paid_method ?? "—"}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-muted-foreground">Total</p>
              <p className="text-3xl font-bold text-primary">{brl(Number(detail.total))}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button className="flex-1 h-12" onClick={() => printThermalReceipt()}>
              <Printer className="h-5 w-5 mr-1" /> Imprimir comprovante
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-12"
              onClick={() => navigate("/caixa/comandas")}
            >
              Voltar às comandas
            </Button>
          </div>
        </CardContent>
      </Card>

      <ThermalReceipt
        ref={receiptRef}
        type="comanda"
        data={comandaData}
        operatorName={operatorName ?? undefined}
        venueName={venueName}
      />
    </div>
  );
}