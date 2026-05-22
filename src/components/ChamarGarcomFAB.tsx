import { useState, useEffect } from "react";
import { BellRing } from "lucide-react";
import { useConsumer } from "@/contexts/ConsumerContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { sendPushNotification } from "@/lib/push-notify";

export function ChamarGarcomFAB() {
  const { activeEvent, lastTableNumber, lastIsExternalArea } = useConsumer();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState("");
  const [isExternal, setIsExternal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasPending, setHasPending] = useState(false);

  // Realtime: detect pending calls for this user/event
  useEffect(() => {
    if (!activeEvent?.id || !user?.id) return;

    const checkPending = async () => {
      const { data } = await supabase
        .from("waiter_calls")
        .select("id")
        .eq("event_id", activeEvent.id)
        .eq("consumer_id", user.id)
        .in("status", ["pending", "acknowledged"])
        .limit(1);
      setHasPending((data || []).length > 0);
    };
    checkPending();

    const channel = supabase
      .channel("consumer-waiter-calls-" + activeEvent.id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "waiter_calls", filter: `event_id=eq.${activeEvent.id}` },
        () => {
          checkPending();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeEvent?.id, user?.id]);

  if (!activeEvent?.table_service_enabled) return null;

  const handleOpen = () => {
    setTableNumber(lastTableNumber ? String(lastTableNumber) : "");
    setIsExternal(lastIsExternalArea || false);
    setOpen(true);
  };

  const handleCall = async () => {
    const tNum = isExternal ? null : parseInt(tableNumber);
    if (!isExternal && (!tNum || tNum < 1 || tNum > (activeEvent?.table_count || 999))) {
      toast.error("Número da mesa inválido");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("create_consumer_waiter_call", {
      p_event_id: activeEvent.id,
      p_table_number: isExternal ? null : tNum,
      p_is_external_area: isExternal,
    });
    setLoading(false);
    const result = data as any;
    if (error || !result?.ok) {
      const errCode = result?.error;
      if (errCode === "CALL_ALREADY_PENDING") {
        toast.info("Chamado já pendente, aguarde o garçom");
      } else {
        toast.error("Erro ao chamar garçom");
      }
      setOpen(false);
      return;
    }
    toast.success("Garçom chamado! Aguarde");
    setHasPending(true);
    setOpen(false);

    // Notify active waiters (fire-and-forget)
    (async () => {
      const { data: sessions } = await supabase
        .from("waiter_sessions")
        .select("waiter_id")
        .eq("event_id", activeEvent.id)
        .is("closed_at", null);
      if (sessions && sessions.length > 0) {
        const waiterIds = sessions.map((s: any) => s.waiter_id);
        const mesaText = isExternal ? "Área externa" : `Mesa ${tableNumber}`;
        sendPushNotification(waiterIds, "Chamado!", `${mesaText} está chamando`, "/garcom/chamados");
      }
    })();
  };

  return (
    <>
      <button
        onClick={handleOpen}
        aria-label="Chamar garçom"
        className="fixed right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_20px_hsl(24,100%,50%,0.5)] active:scale-95 transition-transform"
        style={{ bottom: "calc(60px + env(safe-area-inset-bottom, 0px))" }}
      >
        <BellRing className="h-6 w-6" />
        {hasPending && (
          <span className="absolute right-1 top-1 h-3 w-3 rounded-full bg-success">
            <span className="absolute inset-0 animate-ping rounded-full bg-success/60" />
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="dark max-w-[420px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Chamar Garçom</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsExternal(false)}
                className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${!isExternal ? "border-primary bg-primary/10" : "border-white/10 bg-white/[0.04]"}`}
              >
                <span className="text-2xl">🪑</span>
                <span className="text-sm font-medium">Mesa</span>
              </button>
              <button
                type="button"
                onClick={() => setIsExternal(true)}
                className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${isExternal ? "border-primary bg-primary/10" : "border-white/10 bg-white/[0.04]"}`}
              >
                <span className="text-2xl">🌳</span>
                <span className="text-sm font-medium">Área externa</span>
              </button>
            </div>

            {!isExternal && (
              <div className="flex flex-col gap-2">
                <Label>Número da mesa</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="Ex: 7"
                  className="h-12"
                />
              </div>
            )}

            <Button
              onClick={handleCall}
              disabled={loading}
              className="h-14 rounded-2xl bg-primary text-primary-foreground shadow-[0_0_20px_hsl(24,100%,50%,0.4)]"
            >
              {loading ? "Chamando..." : "Chamar Garçom"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
