import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPtBrErrorMessage } from "@/lib/error-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n/use-translation";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
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
  created_at: string;
  updated_at: string;
};

type RuleForm = {
  rule_type: string;
  fee_percent: string;
  monthly_amount: string;
  billing_day: string;
  activation_amount: string;
  currency: string;
  notes: string;
};

const emptyRuleForm = (): RuleForm => ({
  rule_type: "transaction_fee",
  fee_percent: "",
  monthly_amount: "",
  billing_day: "",
  activation_amount: "",
  currency: "BRL",
  notes: "",
});

interface ClientBillingRulesProps {
  clientId: string;
}

export function ClientBillingRules({ clientId }: ClientBillingRulesProps) {
  const { t } = useTranslation();
  const [rules, setRules] = useState<BillingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BillingRule | null>(null);
  const [form, setForm] = useState<RuleForm>(emptyRuleForm());
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const fetchRules = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("billing_rules")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error(getPtBrErrorMessage(error));
    }
    const fetched = (data as BillingRule[]) ?? [];
    setRules(fetched);
    setLoading(false);
    return fetched;
  };

  const autoCreateDefaultFee = async (existingRules: BillingRule[]) => {
    const hasTransactionFee = existingRules.some((r) => r.rule_type === "transaction_fee");
    if (hasTransactionFee) return;

    // Fetch platform default
    const { data: ps } = await supabase
      .from("platform_settings")
      .select("default_fee_percent")
      .limit(1)
      .single();
    const defaultFee = (ps as any)?.default_fee_percent ?? 10;

    const { data, error } = await supabase
      .from("billing_rules")
      .insert({
        client_id: clientId,
        rule_type: "transaction_fee",
        fee_percent: defaultFee,
        is_active: true,
      } as any)
      .select()
      .single();

    if (error) {
      toast.error(getPtBrErrorMessage(error));
      return;
    }
    if (data) {
      await logAudit({
        action: "billing_rule.created",
        entityType: "billing_rule",
        entityId: (data as any).id,
        metadata: { client_id: clientId, rule_type: "transaction_fee", auto_created: true },
        newData: data as any,
      });
    }
    await fetchRules();
  };

  useEffect(() => {
    if (!clientId || initialized) return;
    setInitialized(true);
    fetchRules().then((fetched) => {
      autoCreateDefaultFee(fetched);
    });
  }, [clientId]);

  const ruleTypeLabel = (type: string) => {
    switch (type) {
      case "transaction_fee": return t("br_type_transaction_fee");
      case "monthly_saas": return t("br_type_monthly_saas");
      case "activation_fee": return t("br_type_activation_fee");
      default: return type;
    }
  };

  const ruleMainValue = (r: BillingRule) => {
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

  const openCreate = () => {
    setEditing(null);
    setForm(emptyRuleForm());
    setModalOpen(true);
  };

  const openEdit = (rule: BillingRule) => {
    setEditing(rule);
    setForm({
      rule_type: rule.rule_type,
      fee_percent: rule.fee_percent?.toString() ?? "",
      monthly_amount: rule.monthly_amount?.toString() ?? "",
      billing_day: rule.billing_day?.toString() ?? "",
      activation_amount: rule.activation_amount?.toString() ?? "",
      currency: rule.currency,
      notes: rule.notes ?? "",
    });
    setModalOpen(true);
  };

  const toggleActive = async (rule: BillingRule) => {
    const newActive = !rule.is_active;
    const { error } = await supabase
      .from("billing_rules")
      .update({ is_active: newActive })
      .eq("id", rule.id);
    if (error) {
      toast.error(getPtBrErrorMessage(error));
      return;
    }
    await logAudit({
      action: "billing_rule.updated",
      entityType: "billing_rule",
      entityId: rule.id,
      oldData: { is_active: rule.is_active },
      newData: { is_active: newActive },
      metadata: { client_id: clientId, toggled: true },
    });
    toast.success(newActive ? t("br_activated") : t("br_deactivated"));
    fetchRules();
  };

  const validate = (): boolean => {
    if (form.rule_type === "transaction_fee") {
      const v = parseFloat(form.fee_percent);
      if (isNaN(v) || v < 0 || v > 100) {
        toast.error(t("br_val_fee_range"));
        return false;
      }
    }
    if (form.rule_type === "monthly_saas") {
      const v = parseFloat(form.monthly_amount);
      if (isNaN(v) || v <= 0) {
        toast.error(t("br_val_monthly_positive"));
        return false;
      }
      if (form.billing_day) {
        const d = parseInt(form.billing_day);
        if (isNaN(d) || d < 1 || d > 28) {
          toast.error(t("br_val_billing_day"));
          return false;
        }
      }
    }
    if (form.rule_type === "activation_fee") {
      const v = parseFloat(form.activation_amount);
      if (isNaN(v) || v <= 0) {
        toast.error(t("br_val_activation_positive"));
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    const payload: Record<string, any> = {
      client_id: clientId,
      rule_type: form.rule_type,
      fee_percent: form.rule_type === "transaction_fee" ? parseFloat(form.fee_percent) : null,
      monthly_amount: form.rule_type === "monthly_saas" ? parseFloat(form.monthly_amount) : null,
      billing_day: form.rule_type === "monthly_saas" && form.billing_day ? parseInt(form.billing_day) : null,
      activation_amount: form.rule_type === "activation_fee" ? parseFloat(form.activation_amount) : null,
      currency: form.currency,
      notes: form.notes || null,
    };

    if (editing) {
      const { error } = await supabase.from("billing_rules").update(payload as any).eq("id", editing.id);
      if (error) {
        toast.error(getPtBrErrorMessage(error));
        setSaving(false);
        return;
      }
      await logAudit({
        action: "billing_rule.updated",
        entityType: "billing_rule",
        entityId: editing.id,
        oldData: editing as any,
        newData: payload,
        metadata: { client_id: clientId },
      });
      toast.success(t("br_updated"));
    } else {
      const { data, error } = await supabase.from("billing_rules").insert(payload as any).select("id").single();
      if (error) {
        toast.error(getPtBrErrorMessage(error));
        setSaving(false);
        return;
      }
      if (data) {
        await logAudit({
          action: "billing_rule.created",
          entityType: "billing_rule",
          entityId: (data as any).id,
          newData: payload,
          metadata: { client_id: clientId },
        });
      }
      toast.success(t("br_created"));
    }

    setSaving(false);
    setModalOpen(false);
    fetchRules();
  };

  const columns: DataTableColumn<BillingRule>[] = [
    {
      key: "type",
      header: t("br_col_type"),
      render: (r) => <span className="font-medium text-sm">{ruleTypeLabel(r.rule_type)}</span>,
    },
    {
      key: "value",
      header: t("br_col_value"),
      render: (r) => <span className="font-mono text-sm text-muted-foreground">{ruleMainValue(r)}</span>,
    },
    {
      key: "notes",
      header: t("br_col_notes"),
      render: (r) => <span className="text-sm text-muted-foreground truncate max-w-[200px] block">{r.notes || "—"}</span>,
    },
    {
      key: "status",
      header: t("status"),
      className: "w-28",
      render: (r) => (
        <StatusBadge
          status={r.is_active ? "active" : "inactive"}
          label={r.is_active ? t("active") : t("inactive")}
          onClick={() => toggleActive(r)}
        />
      ),
    },
    {
      key: "actions",
      header: t("actions"),
      className: "w-16",
      render: (r) => (
        <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(r)}>
          <Pencil className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{t("br_section_title")}</h3>
        <Button type="button" variant="outline" size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t("br_add")}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={rules}
        keyExtractor={(r) => r.id}
        loading={loading}
        emptyMessage={t("br_empty")}
      />

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-sm border-border/60"
          onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{editing ? t("br_edit") : t("br_new")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("br_col_type")} *</Label>
              <Select
                value={form.rule_type}
                onValueChange={(v) => setForm({ ...form, rule_type: v })}
                disabled={!!editing}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="transaction_fee">{t("br_type_transaction_fee")}</SelectItem>
                  <SelectItem value="monthly_saas">{t("br_type_monthly_saas")}</SelectItem>
                  <SelectItem value="activation_fee">{t("br_type_activation_fee")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.rule_type === "transaction_fee" && (
              <div className="space-y-1.5">
                <Label>{t("br_fee_percent")} *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.fee_percent}
                  onChange={(e) => setForm({ ...form, fee_percent: e.target.value })}
                  placeholder="10.00"
                />
                <p className="text-xs text-muted-foreground">{t("br_fee_percent_help")}</p>
              </div>
            )}

            {form.rule_type === "monthly_saas" && (
              <>
                <div className="space-y-1.5">
                  <Label>{t("br_monthly_amount")} *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={form.monthly_amount}
                    onChange={(e) => setForm({ ...form, monthly_amount: e.target.value })}
                    placeholder="500.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("br_billing_day")}</Label>
                  <Input
                    type="number"
                    min="1"
                    max="28"
                    value={form.billing_day}
                    onChange={(e) => setForm({ ...form, billing_day: e.target.value })}
                    placeholder="1-28"
                  />
                  <p className="text-xs text-muted-foreground">{t("br_billing_day_help")}</p>
                </div>
              </>
            )}

            {form.rule_type === "activation_fee" && (
              <div className="space-y-1.5">
                <Label>{t("br_activation_amount")} *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.activation_amount}
                  onChange={(e) => setForm({ ...form, activation_amount: e.target.value })}
                  placeholder="1000.00"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>{t("br_currency")}</Label>
              <Input
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                placeholder="BRL"
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("br_notes")}</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder={t("br_notes_placeholder")}
                rows={2}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setModalOpen(false)} disabled={saving}>
                {t("cancel")}
              </Button>
              <Button type="submit" className="flex-1 glow-hover" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? t("update") : t("create")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
