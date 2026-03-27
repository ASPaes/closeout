import { useTranslation } from "@/i18n/use-translation";

export default function ConsumerPagamento() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <h1 className="text-xl font-bold text-foreground">{t("consumer_payment_title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("consumer_coming_soon")}</p>
    </div>
  );
}
