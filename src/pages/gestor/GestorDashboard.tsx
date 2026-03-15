import { useTranslation } from "@/i18n/use-translation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useGestor } from "@/contexts/GestorContext";
import { Package, Tags, Layers, Megaphone, Warehouse, CalendarDays } from "lucide-react";
import type { TranslationKey } from "@/i18n/translations/pt-BR";

const cards: { titleKey: TranslationKey; descKey: TranslationKey; icon: any }[] = [
  { titleKey: "gestor_products", descKey: "gestor_products_desc", icon: Package },
  { titleKey: "gestor_categories", descKey: "gestor_categories_desc", icon: Tags },
  { titleKey: "gestor_combos", descKey: "gestor_combos_desc", icon: Layers },
  { titleKey: "gestor_campaigns", descKey: "gestor_campaigns_desc", icon: Megaphone },
  { titleKey: "gestor_stock", descKey: "gestor_stock_desc", icon: Warehouse },
  { titleKey: "events", descKey: "manage_events", icon: CalendarDays },
];

export default function GestorDashboard() {
  const { profile } = useAuth();
  const { clientName } = useGestor();
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("gestor_panel")}</h1>
        <p className="text-muted-foreground">
          {t("welcome_back")}, {profile?.name || "Gestor"}
          {!isSuperAdmin && clientName && (
            <span className="ml-2 text-sm font-medium text-foreground">
              — {clientName}
            </span>
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.titleKey}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t(c.titleKey)}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{t(c.descKey)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
