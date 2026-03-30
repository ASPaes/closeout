import { useState } from "react";
import { useWaiter } from "@/contexts/WaiterContext";
import { WaiterSessionGuard } from "@/components/WaiterSessionGuard";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut, Clock, MapPin, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

function TurnoContent() {
  const { session, eventName, waiterName, assignmentType, assignmentValue, refreshSession } = useWaiter();
  const [ending, setEnding] = useState(false);

  const handleEnd = async () => {
    if (!session) return;
    setEnding(true);
    const { data, error } = await supabase.rpc("close_waiter_session", {
      p_session_id: session.id,
      p_cash_handed_over: session.cash_collected ?? 0,
    });
    if (error) {
      toast.error("Erro ao encerrar turno.");
      setEnding(false);
      return;
    }
    const result = data as unknown as { ok: boolean; error?: string };
    if (!result.ok) {
      toast.error("Não foi possível encerrar o turno.");
      setEnding(false);
      return;
    }
    toast.success("Turno encerrado!");
    await refreshSession();
    setEnding(false);
  };

  const assignmentLabel: Record<string, string> = {
    tables: "Mesas",
    sector: "Setor",
    free: "Livre",
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-foreground">Meu Turno</h1>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {waiterName?.charAt(0)?.toUpperCase() ?? "G"}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{waiterName}</p>
            <p className="text-xs text-muted-foreground">{eventName}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-[10px] text-muted-foreground">Início</p>
              <p className="text-xs font-medium text-foreground">
                {session?.started_at ? format(new Date(session.started_at), "HH:mm") : "--:--"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-[10px] text-muted-foreground">Atribuição</p>
              <p className="text-xs font-medium text-foreground">
                {assignmentLabel[assignmentType] ?? "Livre"}
                {assignmentValue ? ` — ${assignmentValue}` : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-success/10 px-4 py-3 border border-success/20">
          <DollarSign className="h-5 w-5 text-success" />
          <div>
            <p className="text-[10px] text-muted-foreground">Dinheiro coletado</p>
            <p className="text-base font-bold text-success">
              R$ {(session?.cash_collected ?? 0).toFixed(2).replace(".", ",")}
            </p>
          </div>
        </div>
      </div>

      <Button
        variant="destructive"
        onClick={handleEnd}
        disabled={ending}
        className="w-full min-h-[48px] rounded-xl text-base font-semibold"
      >
        {ending ? (
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        ) : (
          <LogOut className="mr-2 h-5 w-5" />
        )}
        Encerrar Turno
      </Button>
    </div>
  );
}

export default function GarcomTurno() {
  return (
    <WaiterSessionGuard>
      <TurnoContent />
    </WaiterSessionGuard>
  );
}
