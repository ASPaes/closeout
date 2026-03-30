import { WaiterSessionGuard } from "@/components/WaiterSessionGuard";
import { Bell } from "lucide-react";

function ChamadosContent() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 pt-20">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <Bell className="h-8 w-8 text-muted-foreground" />
      </div>
      <h1 className="text-lg font-bold text-foreground">Chamados</h1>
      <p className="text-center text-sm text-muted-foreground px-8">
        Os chamados dos clientes aparecerão aqui em tempo real.
      </p>
    </div>
  );
}

export default function GarcomChamados() {
  return (
    <WaiterSessionGuard>
      <ChamadosContent />
    </WaiterSessionGuard>
  );
}
