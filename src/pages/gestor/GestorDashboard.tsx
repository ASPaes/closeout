import { useEffect, useState } from "react";
import { useTranslation } from "@/i18n/use-translation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useGestor } from "@/contexts/GestorContext";
import { supabase } from "@/integrations/supabase/client";
import { Package, Tags, Layers, Megaphone, Warehouse, CalendarDays, Banknote, ShoppingCart } from "lucide-react";
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
  const { clientName, effectiveClientId } = useGestor();
  const { t } = useTranslation();
  const [openRegisters, setOpenRegisters] = useState(0);
  const [salesToday, setSalesToday] = useState(0);

  useEffect(() => {
    if (!effectiveClientId) return;

    // Count open registers
    supabase
      .from("cash_registers")
      .select("id", { count: "exact", head: true })
      .eq("client_id", effectiveClientId)
      .eq("status", "open")
      .then(({ count }) => setOpenRegisters(count ?? 0));

    // Sum today's sales
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    supabase
      .from("cash_orders")
      .select("total")
      .eq("client_id", effectiveClientId)
      .eq("status", "completed")
      .gte("created_at", todayStart.toISOString())
      .then(({ data }) => {
        const sum = (data ?? []).reduce((acc, o) => acc + Number(o.total), 0);
        setSalesToday(sum);
      });
  }, [effectiveClientId]);

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("gestor_panel")}</h1>
        <p className="text-muted-foreground">
          {t("welcome_back")}, {profile?.name || "Gestor"}
          {clientName && (
            <span className="ml-2 text-sm font-medium text-foreground">
              — {clientName}
            </span>
          )}
        </p>
      </div>

      {/* Live metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("gcx_open_registers")}</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openRegisters}</div>
            <p className="text-xs text-muted-foreground">{t("gcx_open_registers_desc")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("gcx_sales_today")}</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(salesToday)}</div>
            <p className="text-xs text-muted-foreground">{t("gcx_sales_today_desc")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Feature cards */}
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
