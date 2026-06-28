import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, UtensilsCrossed, TreePine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConsumer } from "@/contexts/ConsumerContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function ConsumerMesa() {
  const navigate = useNavigate();
  const {
    activeEvent,
    activeComanda,
    cart,
    clearCart,
    lastTableNumber,
    lastIsExternalArea,
    setLastTableNumber,
    setLastIsExternalArea,
  } = useConsumer();

  const [mode, setMode] = useState<"table" | "external">(
    lastIsExternalArea ? "external" : "table",
  );
  const [tableInput, setTableInput] = useState<string>(
    lastTableNumber != null ? String(lastTableNumber) : "",
  );
  const [submitting, setSubmitting] = useState(false);

  const maxTables = activeEvent?.table_count ?? null;
  const parsed = tableInput ? parseInt(tableInput, 10) : NaN;
  const tableError =
    mode === "table" && tableInput && maxTables && parsed > maxTables
      ? `Mesa não existe (máximo: ${maxTables})`
      : "";

  const handleContinue = async () => {
    if (mode === "table") {
      if (!tableInput || isNaN(parsed) || parsed < 1) {
        toast.error("Informe o número da mesa");
        return;
      }
      if (maxTables && parsed > maxTables) {
        toast.error(`Mesa não existe (máximo: ${maxTables})`);
        return;
      }
      setLastTableNumber(parsed);
      setLastIsExternalArea(false);
    } else {
      setLastTableNumber(null);
      setLastIsExternalArea(true);
    }

    if (activeComanda) {
      setSubmitting(true);
      const items = cart.items.map((i) =>
        i.type === "product"
          ? { product_id: i.id, quantity: i.quantity }
          : { combo_id: i.id, quantity: i.quantity },
      );
      const { data, error } = await supabase.rpc("create_comanda_order", {
        params: {
          comanda_id: activeComanda.id,
          items,
          table_number: mode === "table" ? parsed : null,
          is_external_area: mode === "external",
        } as any,
      });
      setSubmitting(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(`Pedido #${(data as any)?.order_number} enviado para o bar`);
      clearCart();
      navigate("/app/cardapio");
      return;
    }

    navigate("/app/pagamento");
  };

  return (
    <div className="flex flex-col gap-5 pb-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08] active:scale-95 transition-transform"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold text-foreground">Onde você está?</h1>
          <p className="text-xs text-muted-foreground">Escolha onde receber seu pedido</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setMode("table")}
          className={cn(
            "flex flex-col items-center justify-center gap-2 h-[100px] rounded-xl border transition-all active:scale-95",
            mode === "table"
              ? "border-primary bg-primary/10"
              : "border-white/10 bg-white/[0.04]",
          )}
        >
          <UtensilsCrossed
            className={cn("h-6 w-6", mode === "table" ? "text-primary" : "text-muted-foreground")}
          />
          <span className="text-sm font-semibold text-foreground">Mesa</span>
        </button>

        <button
          onClick={() => setMode("external")}
          className={cn(
            "flex flex-col items-center justify-center gap-2 h-[100px] rounded-xl border transition-all active:scale-95",
            mode === "external"
              ? "border-primary bg-primary/10"
              : "border-white/10 bg-white/[0.04]",
          )}
        >
          <TreePine
            className={cn("h-6 w-6", mode === "external" ? "text-primary" : "text-muted-foreground")}
          />
          <span className="text-sm font-semibold text-foreground">Área externa</span>
        </button>
      </div>

      {mode === "table" && (
        <div className="flex flex-col gap-2">
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={maxTables ?? undefined}
            placeholder="Número da mesa"
            value={tableInput}
            onChange={(e) => setTableInput(e.target.value)}
            className="h-12 rounded-xl"
          />
          {tableError && <p className="text-xs text-destructive">{tableError}</p>}
          {maxTables && !tableError && (
            <p className="text-xs text-muted-foreground">Mesas disponíveis: 1 a {maxTables}</p>
          )}
        </div>
      )}

      {mode === "external" && (
        <p className="text-xs text-muted-foreground">O garçom irá até a área externa</p>
      )}

      <Button
        onClick={handleContinue}
        disabled={submitting}
        className="h-14 rounded-2xl text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl active:scale-[0.98] transition-transform w-full mt-2"
        style={{ boxShadow: "0 8px 32px hsl(24 100% 50% / 0.35)" }}
      >
        {activeComanda ? "Adicionar à comanda" : "Continuar para pagamento"}
      </Button>
    </div>
  );
}