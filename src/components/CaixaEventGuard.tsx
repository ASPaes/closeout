import { useCaixa } from "@/contexts/CaixaContext";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import { CalendarDays, LockOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReactNode, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTION } from "@/config/audit-actions";
import { toast } from "sonner";

function OpenRegisterForm() {
  const { eventId, clientId, refreshCashRegister } = useCaixa();
  const { session } = useAuth();
  const { t } = useTranslation();
  const [openingBalance, setOpeningBalance] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleOpen = async () => {
    if (!eventId || !clientId || !session?.user?.id) return;
    const balance = parseFloat(openingBalance);
    if (isNaN(balance) || balance < 0) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("cash_registers")
        .insert({
          event_id: eventId,
          client_id: clientId,
          operator_id: session.user.id,
          opening_balance: balance,
          status: "open",
        })
        .select("id")
        .single();

      if (error) throw error;

      await logAudit({
        action: AUDIT_ACTION.CASH_REGISTER_OPENED,
        entityType: "cash_register",
        entityId: data.id,
        newData: { event_id: eventId, opening_balance: balance },
      });

      refreshCashRegister();
      toast.success(t("caixa_open_success"));
    } catch {
      toast.error(t("caixa_open_error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <LockOpen className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-lg">{t("caixa_open_register")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("caixa_no_register_desc")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="opening-balance">{t("caixa_opening_balance")}</Label>
            <Input
              id="opening-balance"
              type="number"
              min="0"
              step="0.01"
              placeholder={t("caixa_opening_balance_placeholder")}
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            onClick={handleOpen}
            disabled={submitting || !openingBalance || parseFloat(openingBalance) < 0}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <LockOpen className="h-4 w-4 mr-2" />
            {t("caixa_open_register")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function CaixaEventGuard({ children, requireRegister = false }: { children: ReactNode; requireRegister?: boolean }) {
  const { eventId, cashRegisterId } = useCaixa();
  const { t } = useTranslation();

  if (!eventId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <CalendarDays className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t("caixa_no_event_selected")}</h2>
          <p className="text-sm text-muted-foreground max-w-md">{t("caixa_no_event_desc")}</p>
        </div>
      </div>
    );
  }

  if (requireRegister && !cashRegisterId) {
    return <OpenRegisterForm />;
  }

  return <>{children}</>;
}
