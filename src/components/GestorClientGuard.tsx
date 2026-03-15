import { useGestor } from "@/contexts/GestorContext";
import { useTranslation } from "@/i18n/use-translation";
import { Building2 } from "lucide-react";
import { ReactNode } from "react";

/**
 * Wraps gestor page content — shows empty state if super_admin hasn't selected a client.
 */
export function GestorClientGuard({ children }: { children: ReactNode }) {
  const { effectiveClientId, isSuperAdmin } = useGestor();
  const { t } = useTranslation();

  if (isSuperAdmin && !effectiveClientId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Building2 className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t("gestor_no_client_selected")}</h2>
          <p className="text-sm text-muted-foreground max-w-md">{t("gestor_no_client_desc")}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
