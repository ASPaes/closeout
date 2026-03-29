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
import { Loader2, Wallet, AlertTriangle, CheckCircle2 } from "lucide-react";

const QUICK_VALUES = [100, 200, 300, 500];

export default function ConsumerLimites() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [maxValue, setMaxValue] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_consumption_limits")
      .select("max_order_value, is_active")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data: row }) => {
        if (row) {
          setIsActive(row.is_active ?? false);
          setMaxValue(row.max_order_value);
        }
        setLoading(false);
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("user_consumption_limits")
      .upsert(
        {
          user_id: user.id,
          max_order_value: isActive ? maxValue : null,
          max_orders_per_event: null,
          limit_behavior: "warn",
          is_active: isActive,
        },
        { onConflict: "user_id" }
      );

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Limite salvo com sucesso!");
      await logAudit({
        action: "CONSUMER_LIMITS_UPDATED",
        entityType: "user_consumption_limits",
        entityId: user.id,
        newData: { max_order_value: maxValue, is_active: isActive } as unknown as Record<string, unknown>,
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
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15">
          <Wallet className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">Limite de Gastos</h1>
          <p className="text-xs text-muted-foreground">
            Controle quanto deseja gastar nesta noite
          </p>
        </div>
      </div>

      {/* Toggle card */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isActive ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
            )}
            <div>
              <p className="text-sm font-medium text-foreground">
                {isActive ? "Limite ativado" : "Limite desativado"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isActive
                  ? "Você receberá um aviso ao atingir o valor"
                  : "Ative para definir um teto de gastos"}
              </p>
            </div>
          </div>
          <Switch
            checked={isActive}
            onCheckedChange={setIsActive}
          />
        </div>
      </div>

      {/* Value section */}
      {isActive && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-5 space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground font-medium">
              Quanto deseja gastar no máximo hoje?
            </Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-semibold text-muted-foreground">
                R$
              </span>
              <Input
                type="number"
                inputMode="decimal"
                value={maxValue ?? ""}
                onChange={(e) =>
                  setMaxValue(e.target.value ? Number(e.target.value) : null)
                }
                className="h-14 rounded-xl border-white/[0.08] bg-white/[0.04] pl-12 text-2xl font-bold text-foreground placeholder:text-muted-foreground/40"
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Quick select */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Valores rápidos</p>
            <div className="grid grid-cols-4 gap-2">
              {QUICK_VALUES.map((v) => (
                <button
                  key={v}
                  onClick={() => setMaxValue(v)}
                  className={cn(
                    "h-11 rounded-xl text-sm font-semibold transition-all active:scale-[0.96]",
                    maxValue === v
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-white/[0.05] text-muted-foreground border border-white/[0.08]"
                  )}
                >
                  R${v}
                </button>
              ))}
            </div>
          </div>

          {/* Info banner */}
          <div className="flex items-start gap-3 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
            <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-200/80 leading-relaxed">
              O limite <strong>não bloqueia</strong> suas compras. Ao atingir o
              valor definido, você receberá um aviso na tela para manter o
              controle dos seus gastos.
            </p>
          </div>
        </div>
      )}

      {/* Save button */}
      <Button
        onClick={handleSave}
        disabled={saving || (isActive && !maxValue)}
        className="h-14 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-base font-semibold text-primary-foreground shadow-lg active:scale-[0.98] transition-transform disabled:opacity-50"
        style={{ boxShadow: "0 4px 24px hsl(24 100% 50% / 0.3)" }}
      >
        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Salvar limite"}
      </Button>
    </div>
  );
}
