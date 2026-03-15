import { useTranslation } from "@/i18n/use-translation";
import type { TranslationKey } from "@/i18n/translations/pt-BR";

function GestorPlaceholder({ titleKey, descKey }: { titleKey: TranslationKey; descKey: TranslationKey }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t(titleKey)}</h1>
        <p className="text-muted-foreground">{t(descKey)}</p>
      </div>
      <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
        Em breve
      </div>
    </div>
  );
}

export function GestorEstoque() {
  return <GestorPlaceholder titleKey="gestor_stock" descKey="gestor_stock_desc" />;
}
export function GestorEventos() {
  return <GestorPlaceholder titleKey="events" descKey="manage_events" />;
}
