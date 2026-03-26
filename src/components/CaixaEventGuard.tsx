import { useCaixa } from "@/contexts/CaixaContext";
import { useTranslation } from "@/i18n/use-translation";
import { CalendarDays, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReactNode } from "react";

/**
 * Wraps caixa page content:
 * - If no event selected → shows empty state to select event
 * - If no cash register open → shows button to open one
 */
export function CaixaEventGuard({ children, requireRegister = false }: { children: ReactNode; requireRegister?: boolean }) {
  const { eventId, cashRegisterId } = useCaixa();
  const { t } = useTranslation();

  if (!eventId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <CalendarDays className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t("caixa_no_event_selected")}</h2>
          <p className="text-sm text-muted-foreground max-w-md">{t("caixa_no_event_desc")}</p>
        </div>
      </div>
    );
  }

  if (requireRegister && !cashRegisterId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-yellow-500/10 flex items-center justify-center">
          <LockOpen className="h-8 w-8 text-yellow-400" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t("caixa_no_register")}</h2>
          <p className="text-sm text-muted-foreground max-w-md">{t("caixa_no_register_desc")}</p>
        </div>
        <Button variant="default" className="mt-2">
          <LockOpen className="h-4 w-4 mr-2" />
          {t("caixa_open_register")}
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
