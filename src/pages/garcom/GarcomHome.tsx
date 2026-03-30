import { useWaiter } from "@/contexts/WaiterContext";
import { WaiterSessionGuard } from "@/components/WaiterSessionGuard";
import { Bell, ClipboardList, DollarSign } from "lucide-react";

function HomeContent() {
  const { waiterName, eventName, pendingCallsCount, cashCollected } = useWaiter();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">
          Olá, {waiterName?.split(" ")[0] ?? "Garçom"} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {eventName ?? "Sem evento ativo"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <Bell className="h-5 w-5 text-primary mb-2" />
          <p className="text-2xl font-bold text-foreground">{pendingCallsCount}</p>
          <p className="text-xs text-muted-foreground">Chamados pendentes</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <DollarSign className="h-5 w-5 text-success mb-2" />
          <p className="text-2xl font-bold text-foreground">
            R$ {cashCollected.toFixed(2).replace(".", ",")}
          </p>
          <p className="text-xs text-muted-foreground">Dinheiro coletado</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Resumo do turno</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Funcionalidades detalhadas serão implementadas em breve.
        </p>
      </div>
    </div>
  );
}

export default function GarcomHome() {
  return (
    <WaiterSessionGuard>
      <HomeContent />
    </WaiterSessionGuard>
  );
}
