import { useTranslation } from "@/i18n/use-translation";
import logoMark from "@/assets/brand/logo-mark.png";

export default function WaiterLogin() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6">
      <img src={logoMark} alt="Close Out" className="h-16 w-16 rounded-2xl object-contain" />
      <h1 className="text-2xl font-bold text-foreground">{t("waiter_panel")}</h1>
      <p className="text-sm text-muted-foreground">Login do garçom — em breve</p>
    </div>
  );
}
