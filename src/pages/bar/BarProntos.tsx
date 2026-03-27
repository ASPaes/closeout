import { PageHeader } from "@/components/PageHeader";
import { BarEventGuard } from "@/components/BarEventGuard";
import { useTranslation } from "@/i18n/use-translation";
import { PackageCheck, Construction } from "lucide-react";

export default function BarProntos() {
  const { t } = useTranslation();

  return (
    <BarEventGuard>
      <div className="space-y-6">
        <PageHeader title={t("bar_ready")} subtitle={t("bar_ready_desc")} icon={PackageCheck} />
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <Construction className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">{t("under_construction")}</p>
        </div>
      </div>
    </BarEventGuard>
  );
}
