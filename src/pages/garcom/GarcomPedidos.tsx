import { WaiterSessionGuard } from "@/components/WaiterSessionGuard";
import { ClipboardList } from "lucide-react";

function PedidosContent() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 pt-20">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <ClipboardList className="h-8 w-8 text-muted-foreground" />
      </div>
      <h1 className="text-lg font-bold text-foreground">Meus Pedidos</h1>
      <p className="text-center text-sm text-muted-foreground px-8">
        O histórico de pedidos do turno aparecerá aqui.
      </p>
    </div>
  );
}

export default function GarcomPedidos() {
  return (
    <WaiterSessionGuard>
      <PedidosContent />
    </WaiterSessionGuard>
  );
}
