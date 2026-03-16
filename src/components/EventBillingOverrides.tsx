import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPtBrErrorMessage } from "@/lib/error-messages";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n/use-translation";
import { logAudit } from "@/lib/audit";

type BillingRule = {
  id: string;
  client_id: string;
  rule_type: string;
  is_active: boolean;
  fee_percent: number | null;
  monthly_amount: number | null;
  billing_day: number | null;
  activation_amount: number | null;
  currency: string;
  notes: string | null;
};

type Override = {
  id: string;
  event_id: string;
  client_id: string;
  billing_rule_id: string;
  is_active: boolean;
  fee_percent: number | null;
  monthly_amount: number | null;
  activation_amount: number | null;
  currency: string | null;
  notes: string | null;
};

interface EventBillingOverridesProps {
  eventId: string;
  clientId: string;
}

export function EventBillingOverrides({ eventId, clientId }: EventBillingOverridesProps) {
  const { t } = useTranslation();
  const [rules, setRules] = useState<BillingRule[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [loading, setLoading] = useState(true);
  const [savingRule, setSavingRule] = useState<string | null>(null);

  // Local form state per rule
  const [localValues, setLocalValues] = useState<Record<string, Record<string, string>>>({});

  const fetchData = async () => {
    setLoading(true);
    const [rulesRes, overridesRes] = await Promise.all([
      supabase
        .from("billing_rules")
        .select("*")
        .eq("client_id", clientId)
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("event_billing_overrides")
        .select("*")
        .eq("event_id", eventId),
    ]);

    if (rulesRes.error) toast.error(getPtBrErrorMessage(rulesRes.error));
    if (overridesRes.error) toast.error(getPtBrErrorMessage(overridesRes.error));

    const fetchedRules = (rulesRes.data as BillingRule[]) ?? [];
    const fetchedOverrides = (overridesRes.data as Override[]) ?? [];

    setRules(fetchedRules);

    const overrideMap: Record<string, Override> = {};
    const localVals: Record<string, Record<string, string>> = {};

    for (const o of fetchedOverrides) {
      overrideMap[o.billing_rule_id] = o;
      localVals[o.billing_rule_id] = buildLocalFromOverride(o);
    }

    setOverrides(overrideMap);
    setLocalValues(localVals);
    setLoading(false);
  };

  const buildLocalFromOverride = (o: Override): Record<string, string> => ({
    fee_percent: o.fee_percent?.toString() ?? "",
    monthly_amount: o.monthly_amount?.toString() ?? "",
    activation_amount: o.activation_amount?.toString() ?? "",
  });

  const buildLocalFromRule = (r: BillingRule): Record<string, string> => ({
    fee_percent: r.fee_percent?.toString() ?? "",
    monthly_amount: r.monthly_amount?.toString() ?? "",
    activation_amount: r.activation_amount?.toString() ?? "",
  });

  useEffect(() => {
    if (eventId && clientId) fetchData();
  }, [eventId, clientId]);

  const ruleTypeLabel = (type: string) => {
    switch (type) {
      case "transaction_fee": return t("br_type_transaction_fee");
      case "monthly_saas": return t("br_type_monthly_saas");
      case "activation_fee": return t("br_type_activation_fee");
      default: return type;
    }
  };

  const ruleDefaultSummary = (r: BillingRule) => {
    switch (r.rule_type) {
      case "transaction_fee":
        return r.fee_percent != null
          ? r.fee_percent.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%"
          : "—";
      case "monthly_saas":
        return r.monthly_amount != null
          ? "R$ " + r.monthly_amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
          + (r.billing_day ? ` (dia ${r.billing_day})` : "")
          : "—";
      case "activation_fee":
        return r.activation_amount != null
          ? "R$ " + r.activation_amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
          : "—";
      default: return "—";
    }
  };

  const toggleOverride = async (rule: BillingRule, enable: boolean) => {
    setSavingRule(rule.id);
    const existing = overrides[rule.id];

    if (enable) {
      if (existing) {
        // Re-activate
        const { error } = await supabase
          .from("event_billing_overrides")
          .update({ is_active: true })
          .eq("id", existing.id);
        if (error) { toast.error(getPtBrErrorMessage(error)); setSavingRule(null); return; }
        await logAudit({
          action: "event_billing_override.updated",
          entityType: "event_billing_override",
          entityId: existing.id,
          oldData: { is_active: false },
          newData: { is_active: true },
          metadata: { event_id: eventId, billing_rule_id: rule.id },
        });
      } else {
        // Create
        const payload: Record<string, any> = {
          event_id: eventId,
          client_id: clientId,
          billing_rule_id: rule.id,
          is_active: true,
          fee_percent: rule.rule_type === "transaction_fee" ? rule.fee_percent : null,
          monthly_amount: rule.rule_type === "monthly_saas" ? rule.monthly_amount : null,
          activation_amount: rule.rule_type === "activation_fee" ? rule.activation_amount : null,
        };
        const { data, error } = await supabase
          .from("event_billing_overrides")
          .insert(payload as any)
          .select()
          .single();
        if (error) { toast.error(getPtBrErrorMessage(error)); setSavingRule(null); return; }
        if (data) {
          await logAudit({
            action: "event_billing_override.created",
            entityType: "event_billing_override",
            entityId: (data as any).id,
            newData: payload,
            metadata: { event_id: eventId, billing_rule_id: rule.id },
          });
        }
      }
      toast.success(t("ebo_override_enabled"));
    } else {
      if (existing) {
        const { error } = await supabase
          .from("event_billing_overrides")
          .update({ is_active: false })
          .eq("id", existing.id);
        if (error) { toast.error(getPtBrErrorMessage(error)); setSavingRule(null); return; }
        await logAudit({
          action: "event_billing_override.updated",
          entityType: "event_billing_override",
          entityId: existing.id,
          oldData: { is_active: true },
          newData: { is_active: false },
          metadata: { event_id: eventId, billing_rule_id: rule.id },
        });
      }
      toast.success(t("ebo_override_disabled"));
    }

    setSavingRule(null);
    fetchData();
  };

  const saveOverrideValue = async (rule: BillingRule) => {
    const existing = overrides[rule.id];
    if (!existing) return;

    const vals = localValues[rule.id] ?? {};
    const payload: Record<string, any> = {};

    if (rule.rule_type === "transaction_fee") {
      const v = parseFloat(vals.fee_percent);
      if (isNaN(v) || v < 0 || v > 100) {
        toast.error(t("br_val_fee_range"));
        return;
      }
      payload.fee_percent = v;
    }
    if (rule.rule_type === "monthly_saas") {
      const v = parseFloat(vals.monthly_amount);
      if (isNaN(v) || v <= 0) {
        toast.error(t("br_val_monthly_positive"));
        return;
      }
      payload.monthly_amount = v;
    }
    if (rule.rule_type === "activation_fee") {
      const v = parseFloat(vals.activation_amount);
      if (isNaN(v) || v <= 0) {
        toast.error(t("br_val_activation_positive"));
        return;
      }
      payload.activation_amount = v;
    }

    setSavingRule(rule.id);
    const { error } = await supabase
      .from("event_billing_overrides")
      .update(payload)
      .eq("id", existing.id);

    if (error) { toast.error(getPtBrErrorMessage(error)); setSavingRule(null); return; }

    await logAudit({
      action: "event_billing_override.updated",
      entityType: "event_billing_override",
      entityId: existing.id,
      oldData: existing as any,
      newData: payload,
      metadata: { event_id: eventId, billing_rule_id: rule.id },
    });

    toast.success(t("ebo_saved"));
    setSavingRule(null);
    fetchData();
  };

  const updateLocal = (ruleId: string, field: string, value: string) => {
    setLocalValues((prev) => ({
      ...prev,
      [ruleId]: { ...(prev[ruleId] ?? {}), [field]: value },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">{t("loading")}</span>
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        {t("ebo_no_rules")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{t("ebo_section_title")}</h3>
        <p className="text-xs text-muted-foreground mt-1">{t("ebo_helper")}</p>
      </div>

      {rules.map((rule) => {
        const override = overrides[rule.id];
        const isOverridden = override?.is_active === true;
        const vals = localValues[rule.id] ?? {};
        const isSaving = savingRule === rule.id;

        return (
          <Card key={rule.id} className="border-border/60 bg-card/80">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-sm">{ruleTypeLabel(rule.rule_type)}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {t("ebo_default")}: {ruleDefaultSummary(rule)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{t("ebo_override_toggle")}</span>
                  <Switch
                    checked={isOverridden}
                    onCheckedChange={(v) => toggleOverride(rule, v)}
                    disabled={isSaving}
                  />
                </div>
              </div>

              {isOverridden && (
                <div className="pl-2 border-l-2 border-primary/30 space-y-2">
                  {rule.rule_type === "transaction_fee" && (
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">{t("br_fee_percent")}</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={vals.fee_percent ?? ""}
                          onChange={(e) => updateLocal(rule.id, "fee_percent", e.target.value)}
                          onBlur={() => saveOverrideValue(rule)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {rule.rule_type === "monthly_saas" && (
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">{t("br_monthly_amount")}</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={vals.monthly_amount ?? ""}
                          onChange={(e) => updateLocal(rule.id, "monthly_amount", e.target.value)}
                          onBlur={() => saveOverrideValue(rule)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {rule.rule_type === "activation_fee" && (
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">{t("br_activation_amount")}</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={vals.activation_amount ?? ""}
                          onChange={(e) => updateLocal(rule.id, "activation_amount", e.target.value)}
                          onBlur={() => saveOverrideValue(rule)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {isSaving && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {t("saving")}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
