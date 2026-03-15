import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, CalendarDays } from "lucide-react";

export default function GestorDashboard() {
  const { profile } = useAuth();
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("gestor_panel")}</h1>
        <p className="text-muted-foreground">
          {t("welcome_back")}, {profile?.name || "Gestor"}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("venues")}</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{t("manage_venues")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("events")}</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{t("manage_events")}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
