import { useBar } from "@/contexts/BarContext";
import { useTranslation } from "@/i18n/use-translation";
import { CalendarDays } from "lucide-react";
import { ReactNode } from "react";

export function BarEventGuard({ children }: { children: ReactNode }) {
  const { eventId } = useBar();
  const { t } = useTranslation();

  if (!eventId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <CalendarDays className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t("bar_no_event")}</h2>
          <p className="text-sm text-muted-foreground max-w-md">{t("bar_no_event_desc")}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
