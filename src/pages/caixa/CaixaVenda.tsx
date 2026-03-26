import { PageHeader } from "@/components/PageHeader";
import { CaixaEventGuard } from "@/components/CaixaEventGuard";
import { useTranslation } from "@/i18n/use-translation";

export default function CaixaVenda() {
  const { t } = useTranslation();

  return (
    <CaixaEventGuard requireRegister>
      <PageHeader title={t("caixa_quick_sale")} />
      <p className="text-muted-foreground text-sm mt-4">{t("caixa_sale_placeholder")}</p>
    </CaixaEventGuard>
  );
}
