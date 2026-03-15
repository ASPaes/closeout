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

export function GestorProdutos() {
  return <GestorPlaceholder titleKey="gestor_products" descKey="gestor_products_desc" />;
}
export function GestorCategorias() {
  return <GestorPlaceholder titleKey="gestor_categories" descKey="gestor_categories_desc" />;
}
export function GestorCombos() {
  return <GestorPlaceholder titleKey="gestor_combos" descKey="gestor_combos_desc" />;
}
export function GestorCampanhas() {
  return <GestorPlaceholder titleKey="gestor_campaigns" descKey="gestor_campaigns_desc" />;
}
export function GestorEstoque() {
  return <GestorPlaceholder titleKey="gestor_stock" descKey="gestor_stock_desc" />;
}
export function GestorEventos() {
  return <GestorPlaceholder titleKey="events" descKey="manage_events" />;
}
