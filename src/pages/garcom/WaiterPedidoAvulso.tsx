import { useTranslation } from "@/i18n/use-translation";
import { WaiterSessionGuard } from "@/components/WaiterSessionGuard";
import { FileText } from "lucide-react";

export default function WaiterPedidoAvulso() {
  const { t } = useTranslation();
  return (
    <WaiterSessionGuard>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-foreground">{t("waiter_anonymous_order")}</h1>
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03] p-8">
          <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Pedido avulso — em construção</p>
        </div>
      </div>
    </WaiterSessionGuard>
  );
}
