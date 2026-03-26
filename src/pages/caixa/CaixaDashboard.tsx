import { PageHeader } from "@/components/PageHeader";
import { CaixaEventGuard } from "@/components/CaixaEventGuard";
import { useTranslation } from "@/i18n/use-translation";

export default function CaixaDashboard() {
  const { t } = useTranslation();

  return (
    <CaixaEventGuard>
      <PageHeader title={t("caixa_dashboard")} />
      <p className="text-muted-foreground text-sm mt-4">{t("caixa_dashboard_placeholder")}</p>
    </CaixaEventGuard>
  );
}
