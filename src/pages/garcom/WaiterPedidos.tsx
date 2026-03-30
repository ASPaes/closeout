import { useTranslation } from "@/i18n/use-translation";
import { WaiterSessionGuard } from "@/components/WaiterSessionGuard";
import { ClipboardList } from "lucide-react";

export default function WaiterPedidos() {
  const { t } = useTranslation();
  return (
    <WaiterSessionGuard>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-foreground">{t("waiter_orders")}</h1>
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03] p-8">
          <ClipboardList className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Meus pedidos — em construção</p>
        </div>
      </div>
    </WaiterSessionGuard>
  );
}
