import { ReactNode } from "react";
import { useWaiter } from "@/contexts/WaiterContext";
import { useTranslation } from "@/i18n/use-translation";
import { Loader2, PlayCircle } from "lucide-react";

export function WaiterSessionGuard({ children }: { children: ReactNode }) {
  const { sessionId, loading } = useWaiter();
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
          <PlayCircle className="h-10 w-10 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{t("waiter_start_shift")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Inicie seu turno para acessar as funcionalidades do garçom.
          </p>
        </div>
        <a
          href="/garcom/turno"
          className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-primary font-semibold text-primary-foreground active:scale-[0.98] transition-transform"
        >
          {t("waiter_start_shift")}
        </a>
      </div>
    );
  }

  return <>{children}</>;
}
