import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPtBrErrorMessage } from "@/lib/error-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Settings as SettingsIcon, ScrollText, CreditCard } from "lucide-react";
import { useTranslation } from "@/i18n/use-translation";
import { useAuth } from "@/hooks/useAuth";
import AuditLogs from "@/pages/AuditLogs";

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

type PlatformSettings = {
  id: string;
  default_geo_radius_meters: number;
  default_max_order_value: number;
  default_unretrieved_order_alert_minutes: number;
  asaas_sandbox_mode: boolean;
  closeout_fee_percent: number;
  min_order_amount: number;
  pix_expiration_minutes: number;
  fee_payer: string;
};

export default function Settings() {
  const { t } = useTranslation();
  const { roles } = useAuth();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [form, setForm] = useState({
    default_geo_radius_meters: "",
    default_max_order_value: "",
    default_unretrieved_order_alert_minutes: "",
  });
  const [asaasForm, setAsaasForm] = useState({
    asaas_sandbox_mode: true,
    closeout_fee_percent: "10",
    min_order_amount: "2.00",
    pix_expiration_minutes: "15",
    fee_payer: "client",
  });
  const [saving, setSaving] = useState(false);
  const [savingAsaas, setSavingAsaas] = useState(false);

  const isOwnerOrSuper = roles?.some(
    (r: any) => r.role === "owner" || r.role === "super_admin"
  );

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("platform_settings").select("*").limit(1).single();
      if (data) {
        const s = data as any as PlatformSettings;
        setSettings(s);
        setForm({
          default_geo_radius_meters: s.default_geo_radius_meters.toString(),
          default_max_order_value: s.default_max_order_value.toString(),
          default_unretrieved_order_alert_minutes: s.default_unretrieved_order_alert_minutes.toString(),
        });
        setAsaasForm({
          asaas_sandbox_mode: s.asaas_sandbox_mode ?? true,
          closeout_fee_percent: (s.closeout_fee_percent ?? 10).toString(),
          min_order_amount: (s.min_order_amount ?? 2).toString(),
          pix_expiration_minutes: (s.pix_expiration_minutes ?? 15).toString(),
          fee_payer: s.fee_payer ?? "client",
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
    const { error } = await supabase.from("platform_settings").upsert(payload as any, { onConflict: "id" });
    if (error) { setSaving(false); toast.error(getPtBrErrorMessage(error)); return; }
    const { data } = await supabase.from("platform_settings").select("*").eq("id", SETTINGS_ID).single();
    if (data) {
      const s = data as any as PlatformSettings;
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

  const handleAsaasSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAsaas(true);

    const feePercent = parseFloat(asaasForm.closeout_fee_percent);
    if (isNaN(feePercent) || feePercent < 0 || feePercent > 100) {
      toast.error("Taxa deve ser entre 0 e 100%");
      setSavingAsaas(false);
      return;
    }

    const payload = {
      id: SETTINGS_ID,
      asaas_sandbox_mode: asaasForm.asaas_sandbox_mode,
      closeout_fee_percent: feePercent,
      min_order_amount: parseFloat(asaasForm.min_order_amount) || 2,
      pix_expiration_minutes: parseInt(asaasForm.pix_expiration_minutes) || 15,
      fee_payer: asaasForm.fee_payer,
    };

    const { error } = await supabase.from("platform_settings").upsert(payload as any, { onConflict: "id" });
    if (error) { setSavingAsaas(false); toast.error(getPtBrErrorMessage(error)); return; }

    const { data } = await supabase.from("platform_settings").select("*").eq("id", SETTINGS_ID).single();
    if (data) {
      const s = data as any as PlatformSettings;
      setSettings(s);
      setAsaasForm({
        asaas_sandbox_mode: s.asaas_sandbox_mode ?? true,
        closeout_fee_percent: (s.closeout_fee_percent ?? 10).toString(),
        min_order_amount: (s.min_order_amount ?? 2).toString(),
        pix_expiration_minutes: (s.pix_expiration_minutes ?? 15).toString(),
        fee_payer: s.fee_payer ?? "client",
      });
    }
    setSavingAsaas(false);
    toast.success(t("settings_saved"));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("settings")}</h1>
        <p className="text-sm text-muted-foreground">{t("settings_desc")}</p>
      </div>

      <Tabs defaultValue="platform" className="space-y-6">
        <TabsList>
          <TabsTrigger value="platform" className="gap-2">
            <SettingsIcon className="h-4 w-4" />
            {t("platform_defaults")}
          </TabsTrigger>
          {isOwnerOrSuper && (
            <TabsTrigger value="payments" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Pagamentos (Asaas)
            </TabsTrigger>
          )}
          <TabsTrigger value="audit" className="gap-2">
            <ScrollText className="h-4 w-4" />
            {t("audit_logs")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="platform">
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
        </TabsContent>

        {isOwnerOrSuper && (
          <TabsContent value="payments">
            <Card className="border-border bg-card max-w-lg">
              <CardHeader className="flex flex-row items-center gap-2 pb-4">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base font-semibold">Pagamentos (Asaas)</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAsaasSubmit} className="space-y-5">
                  {/* Sandbox mode */}
                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-medium">Modo Teste (Sandbox)</Label>
                        {asaasForm.asaas_sandbox_mode ? (
                          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]">
                            TESTE
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive text-[10px]">
                            PRODUÇÃO
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Quando ativo, pagamentos usam o ambiente de teste do Asaas
                      </p>
                    </div>
                    <Switch
                      checked={asaasForm.asaas_sandbox_mode}
                      onCheckedChange={(checked) =>
                        setAsaasForm({ ...asaasForm, asaas_sandbox_mode: checked })
                      }
                    />
                  </div>

                  {/* Fee percent */}
                  <div className="space-y-2">
                    <Label>Taxa da plataforma (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={asaasForm.closeout_fee_percent}
                      onChange={(e) =>
                        setAsaasForm({ ...asaasForm, closeout_fee_percent: e.target.value })
                      }
                      placeholder="10"
                    />
                    <p className="text-xs text-muted-foreground">
                      Percentual retido pelo Close Out em cada transação
                    </p>
                  </div>

                  {/* Min order amount */}
                  <div className="space-y-2">
                    <Label>Valor mínimo do pedido (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={asaasForm.min_order_amount}
                      onChange={(e) =>
                        setAsaasForm({ ...asaasForm, min_order_amount: e.target.value })
                      }
                      placeholder="2.00"
                    />
                  </div>

                  {/* PIX expiration */}
                  <div className="space-y-2">
                    <Label>Tempo de expiração do PIX (minutos)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={asaasForm.pix_expiration_minutes}
                      onChange={(e) =>
                        setAsaasForm({ ...asaasForm, pix_expiration_minutes: e.target.value })
                      }
                      placeholder="15"
                    />
                  </div>

                  {/* Fee payer */}
                  <div className="space-y-2">
                    <Label>Responsável pela taxa do gateway</Label>
                    <Select
                      value={asaasForm.fee_payer}
                      onValueChange={(val) =>
                        setAsaasForm({ ...asaasForm, fee_payer: val })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="client">Estabelecimento (client_admin)</SelectItem>
                        <SelectItem value="consumer">Consumidor</SelectItem>
                        <SelectItem value="platform">Plataforma (Close Out)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button type="submit" className="w-full" disabled={savingAsaas}>
                    {savingAsaas ? t("saving") : t("save_settings")}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="audit">
          <AuditLogs />
        </TabsContent>
      </Tabs>
    </div>
  );
}
