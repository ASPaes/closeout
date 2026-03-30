import { useTranslation } from "@/i18n/use-translation";
import { WaiterSessionGuard } from "@/components/WaiterSessionGuard";
import { useWaiter } from "@/contexts/WaiterContext";
import { Home } from "lucide-react";

export default function WaiterDashboard() {
  const { t } = useTranslation();
  const { waiterName, eventName, pendingCallsCount } = useWaiter();

  return (
    <WaiterSessionGuard>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Olá, {waiterName || "Garçom"} 👋
          </h1>
          {eventName && (
            <p className="text-sm text-muted-foreground mt-1">{eventName}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
            <p className="text-xs text-muted-foreground">{t("waiter_pending_calls")}</p>
            <p className="text-2xl font-bold text-primary mt-1">{pendingCallsCount}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
            <p className="text-xs text-muted-foreground">{t("waiter_orders")}</p>
            <p className="text-2xl font-bold text-foreground mt-1">—</p>
          </div>
        </div>

        <div className="flex items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03] p-8">
          <div className="text-center text-muted-foreground">
            <Home className="mx-auto h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">{t("waiter_dashboard")} — em construção</p>
          </div>
        </div>
      </div>
    </WaiterSessionGuard>
  );
}
