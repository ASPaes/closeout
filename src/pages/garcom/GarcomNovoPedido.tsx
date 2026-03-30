import { WaiterSessionGuard } from "@/components/WaiterSessionGuard";
import { PlusCircle } from "lucide-react";

function NovoPedidoContent() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 pt-20">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <PlusCircle className="h-8 w-8 text-muted-foreground" />
      </div>
      <h1 className="text-lg font-bold text-foreground">Novo Pedido</h1>
      <p className="text-center text-sm text-muted-foreground px-8">
        A funcionalidade de criação de pedidos será implementada em breve.
      </p>
    </div>
  );
}

export default function GarcomNovoPedido() {
  return (
    <WaiterSessionGuard>
      <NovoPedidoContent />
    </WaiterSessionGuard>
  );
}
