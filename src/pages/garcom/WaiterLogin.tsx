import { useTranslation } from "@/i18n/use-translation";

export default function WaiterLogin() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6">
      <h1 className="text-2xl font-bold text-foreground">{t("waiter_panel")}</h1>
      <p className="text-sm text-muted-foreground">Login do garçom — em breve</p>
    </div>
  );
}
