import { useTranslation } from "@/i18n/use-translation";
import { useWaiter } from "@/contexts/WaiterContext";
import { User, PlayCircle, StopCircle } from "lucide-react";

export default function WaiterTurno() {
  const { t } = useTranslation();
  const { sessionId, eventName, assignmentType, assignmentValue, cashCollected } = useWaiter();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-foreground">{t("waiter_shift")}</h1>

      {sessionId ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-success animate-pulse" />
              <span className="text-sm font-semibold text-success">Turno ativo</span>
            </div>
            {eventName && (
              <p className="text-sm text-muted-foreground">Evento: {eventName}</p>
            )}
            {assignmentType && (
              <p className="text-sm text-muted-foreground">
                Atribuição: {t(assignmentType === "tables" ? "waiter_tables" : assignmentType === "sector" ? "waiter_sector" : "waiter_free")}
                {assignmentValue ? ` — ${assignmentValue}` : ""}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {t("waiter_cash_collected")}: R$ {cashCollected.toFixed(2)}
            </p>
          </div>

          <button className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 font-semibold text-destructive active:scale-[0.98] transition-transform">
            <StopCircle className="h-5 w-5" />
            {t("waiter_end_shift")}
          </button>
        </div>
      ) : (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
            <PlayCircle className="h-10 w-10 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">{t("waiter_start_shift")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Selecione o evento e inicie seu turno para começar.
            </p>
          </div>
          <button className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground active:scale-[0.98] transition-transform">
            <PlayCircle className="h-5 w-5" />
            {t("waiter_start_shift")}
          </button>
        </div>
      )}
    </div>
  );
}
