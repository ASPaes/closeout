import { PageHeader } from "@/components/PageHeader";
import { CaixaEventGuard } from "@/components/CaixaEventGuard";
import { useTranslation } from "@/i18n/use-translation";

export default function CaixaTrocas() {
  const { t } = useTranslation();

  return (
    <CaixaEventGuard requireRegister>
      <PageHeader title={t("caixa_exchanges")} />
      <p className="text-muted-foreground text-sm mt-4">{t("caixa_exchanges_placeholder")}</p>
    </CaixaEventGuard>
  );
}
