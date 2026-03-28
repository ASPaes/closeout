import { useTranslation } from "@/i18n/use-translation";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

type LimitData = {
  max_order_value: number | null;
  max_orders_per_event: number | null;
  limit_behavior: string;
  is_active: boolean;
};

export default function ConsumerLimites() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<LimitData>({
    max_order_value: null,
    max_orders_per_event: null,
    limit_behavior: "warn",
    is_active: false,
  });

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_consumption_limits")
      .select("max_order_value, max_orders_per_event, limit_behavior, is_active")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data: row }) => {
        if (row) setData(row as LimitData);
        setLoading(false);
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("user_consumption_limits")
      .upsert({
        user_id: user.id,
        max_order_value: data.max_order_value,
        max_orders_per_event: data.max_orders_per_event,
        limit_behavior: data.limit_behavior,
        is_active: data.is_active,
      }, { onConflict: "user_id" });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("consumer_limits_saved"));
      await logAudit({
        action: "CONSUMER_LIMITS_UPDATED",
        entityType: "user_consumption_limits",
        entityId: user.id,
        newData: data as unknown as Record<string, unknown>,
      });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">{t("consumer_limits_title")}</h1>
          <p className="text-xs text-muted-foreground">{t("consumer_limits_desc")}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-5">
        {/* Toggle active */}
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-foreground">{t("consumer_limits_active")}</Label>
          <Switch
            checked={data.is_active}
            onCheckedChange={(v) => setData({ ...data, is_active: v })}
          />
        </div>

        {/* Max order value */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("consumer_max_order_value")}</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
            <Input
              type="number"
              inputMode="decimal"
              value={data.max_order_value ?? ""}
              onChange={(e) => setData({ ...data, max_order_value: e.target.value ? Number(e.target.value) : null })}
              className="h-12 rounded-xl border-border/60 bg-secondary pl-10 text-base"
              placeholder="0,00"
            />
          </div>
        </div>

        {/* Max orders per event */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("consumer_max_orders_event")}</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={data.max_orders_per_event ?? ""}
            onChange={(e) => setData({ ...data, max_orders_per_event: e.target.value ? Number(e.target.value) : null })}
            className="h-12 rounded-xl border-border/60 bg-secondary text-base"
            placeholder="0"
          />
        </div>

        {/* Behavior */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">{t("consumer_limit_behavior")}</Label>
          <div className="flex gap-2">
            {["warn", "block"].map((b) => (
              <button
                key={b}
                onClick={() => setData({ ...data, limit_behavior: b })}
                className={cn(
                  "flex-1 rounded-xl py-3 text-sm font-medium transition-colors",
                  data.limit_behavior === b
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                )}
              >
                {b === "warn" ? t("consumer_behavior_warn") : t("consumer_behavior_block")}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Button
        onClick={handleSave}
        disabled={saving}
        className="h-14 rounded-xl bg-gradient-to-r from-primary to-primary-glow text-base font-semibold text-primary-foreground shadow-lg active:scale-[0.98] transition-transform"
        style={{ boxShadow: "0 4px 24px hsl(24 100% 50% / 0.35)" }}
      >
        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : t("consumer_save")}
      </Button>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
