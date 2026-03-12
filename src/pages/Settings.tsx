import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPtBrErrorMessage } from "@/lib/error-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Settings as SettingsIcon } from "lucide-react";
import { useTranslation } from "@/i18n/use-translation";

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

type PlatformSettings = {
  id: string;
  default_geo_radius_meters: number;
  default_max_order_value: number;
  default_unretrieved_order_alert_minutes: number;
};

export default function Settings() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [form, setForm] = useState({
    default_geo_radius_meters: "",
    default_max_order_value: "",
    default_unretrieved_order_alert_minutes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("platform_settings").select("*").limit(1).single();
      if (data) {
        const s = data as PlatformSettings;
        setSettings(s);
        setForm({
          default_geo_radius_meters: s.default_geo_radius_meters.toString(),
          default_max_order_value: s.default_max_order_value.toString(),
          default_unretrieved_order_alert_minutes: s.default_unretrieved_order_alert_minutes.toString(),
        });
      }
    };
    fetch();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      id: SETTINGS_ID,
      default_geo_radius_meters: parseInt(form.default_geo_radius_meters) || 500,
      default_max_order_value: parseFloat(form.default_max_order_value) || 500,
      default_unretrieved_order_alert_minutes: parseInt(form.default_unretrieved_order_alert_minutes) || 15,
    };
    const { error } = await supabase.from("platform_settings").upsert(payload, { onConflict: "id" });
    if (error) { setSaving(false); toast.error(getPtBrErrorMessage(error)); return; }
    // Re-fetch after upsert
    const { data } = await supabase.from("platform_settings").select("*").eq("id", SETTINGS_ID).single();
    if (data) {
      const s = data as PlatformSettings;
      setSettings(s);
      setForm({
        default_geo_radius_meters: s.default_geo_radius_meters.toString(),
        default_max_order_value: s.default_max_order_value.toString(),
        default_unretrieved_order_alert_minutes: s.default_unretrieved_order_alert_minutes.toString(),
      });
    }
    setSaving(false);
    toast.success(t("settings_saved"));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("settings")}</h1>
        <p className="text-sm text-muted-foreground">{t("settings_desc")}</p>
      </div>

      <Card className="border-border bg-card max-w-lg">
        <CardHeader className="flex flex-row items-center gap-2 pb-4">
          <SettingsIcon className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base font-semibold">{t("platform_defaults")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("default_geo_radius")}</Label>
              <Input
                type="number"
                value={form.default_geo_radius_meters}
                onChange={(e) => setForm({ ...form, default_geo_radius_meters: e.target.value })}
                placeholder="500"
              />
              <p className="text-xs text-muted-foreground">{t("default_geo_radius_help")}</p>
            </div>
            <div className="space-y-2">
              <Label>{t("default_max_order")}</Label>
              <Input
                type="number"
                step="0.01"
                value={form.default_max_order_value}
                onChange={(e) => setForm({ ...form, default_max_order_value: e.target.value })}
                placeholder="500.00"
              />
              <p className="text-xs text-muted-foreground">{t("default_max_order_help")}</p>
            </div>
            <div className="space-y-2">
              <Label>{t("default_alert_minutes")}</Label>
              <Input
                type="number"
                value={form.default_unretrieved_order_alert_minutes}
                onChange={(e) => setForm({ ...form, default_unretrieved_order_alert_minutes: e.target.value })}
                placeholder="15"
              />
              <p className="text-xs text-muted-foreground">{t("default_alert_minutes_help")}</p>
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? t("saving") : t("save_settings")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
