import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/i18n/use-translation";
import { WaiterSessionGuard } from "@/components/WaiterSessionGuard";
import { useWaiter } from "@/contexts/WaiterContext";
import { supabase } from "@/integrations/supabase/client";
import { vibrate } from "@/lib/native-bridge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Bell,
  BellOff,
  UtensilsCrossed,
  Receipt,
  HelpCircle,
  CheckCircle2,
  Loader2,
  PlusCircle,
} from "lucide-react";

type WaiterCall = {
  id: string;
  event_id: string;
  client_id: string;
  consumer_id: string | null;
  consumer_name: string | null;
  table_number: string | null;
  location_description: string | null;
  call_type: string;
  status: string;
  accepted_by: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type Tab = "pending" | "mine" | "all";

const callTypeIcons: Record<string, typeof Bell> = {
  general: Bell,
  order: UtensilsCrossed,
  bill: Receipt,
  help: HelpCircle,
};

const callTypeLabels: Record<string, string> = {
  general: "Chamado geral",
  order: "Fazer pedido",
  bill: "Pedir conta",
  help: "Ajuda",
};

function timeAgo(dateStr: string): { text: string; color: string } {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);

  let text: string;
  if (mins < 1) text = "agora";
  else if (mins < 60) text = `há ${mins} min`;
  else text = `há ${Math.floor(mins / 60)}h`;

  let color: string;
  if (mins < 2) color = "text-green-400";
  else if (mins < 5) color = "text-yellow-400";
  else color = "text-red-400";

  return { text, color };
}

export default function WaiterChamados() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { eventId, waiterId } = useWaiter();
  const [tab, setTab] = useState<Tab>("pending");
  const [calls, setCalls] = useState<WaiterCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const prevCountRef = useRef(0);
  const [, setTick] = useState(0);

  // Tick every 30s to update time display
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchCalls = useCallback(async () => {
    if (!eventId) return;
    const { data } = await supabase
      .from("waiter_calls" as any)
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    const result = (data as WaiterCall[]) || [];
    setCalls(result);

    // Vibrate on new pending calls
    const pendingCount = result.filter((c) => c.status === "pending").length;
    if (pendingCount > prevCountRef.current && prevCountRef.current >= 0) {
      vibrate(150);
    }
    prevCountRef.current = pendingCount;

    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  // Realtime
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel("waiter-chamados-" + eventId)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "waiter_calls",
        filter: `event_id=eq.${eventId}`,
      }, () => {
        fetchCalls();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId, fetchCalls]);

  const handleAccept = async (callId: string) => {
    setAccepting(callId);
    try {
      const { data, error } = await supabase.rpc("accept_waiter_call", { p_call_id: callId } as any);
      const result = data as any;
      if (error || !result?.ok) {
        toast.error(result?.error === "CALL_NOT_PENDING" ? "Chamado já foi aceito" : "Erro ao aceitar chamado");
        return;
      }
      toast.success(t("waiter_accept_call"));
      fetchCalls();
    } catch {
      toast.error("Erro ao aceitar chamado");
    } finally {
      setAccepting(null);
    }
  };

  const handleComplete = async (callId: string) => {
    setCompleting(callId);
    try {
      const { data, error } = await supabase.rpc("complete_waiter_call", { p_call_id: callId } as any);
      const result = data as any;
      if (error || !result?.ok) {
        toast.error(result?.error === "NOT_YOUR_CALL" ? "Este chamado não é seu" : "Erro ao concluir");
        return;
      }
      toast.success("Chamado concluído");
      fetchCalls();
    } catch {
      toast.error("Erro ao concluir chamado");
    } finally {
      setCompleting(null);
    }
  };

  const filtered = calls.filter((c) => {
    if (tab === "pending") return c.status === "pending";
    if (tab === "mine") return c.accepted_by === waiterId && c.status === "accepted";
    return true;
  });

  const pendingCount = calls.filter((c) => c.status === "pending").length;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "pending", label: "Pendentes", count: pendingCount },
    { key: "mine", label: "Meus" },
    { key: "all", label: "Todos" },
  ];

  return (
    <WaiterSessionGuard>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">{t("waiter_calls")}</h1>
          {pendingCount > 0 && (
            <span className="rounded-full bg-yellow-500/20 px-2.5 py-0.5 text-xs font-semibold text-yellow-400">
              {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-white/[0.04] p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "relative flex-1 rounded-lg py-2 text-sm font-medium transition-all",
                tab === t.key
                  ? "bg-white/[0.1] text-foreground"
                  : "text-muted-foreground active:bg-white/[0.06]"
              )}
            >
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-8">
            <BellOff className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {tab === "pending"
                ? "Nenhum chamado pendente"
                : tab === "mine"
                ? "Nenhum chamado aceito por você"
                : "Nenhum chamado"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((call) => {
              const Icon = callTypeIcons[call.call_type] || Bell;
              const time = timeAgo(call.created_at);
              const isPending = call.status === "pending";
              const isMine = call.status === "accepted" && call.accepted_by === waiterId;

              return (
                <div
                  key={call.id}
                  className={cn(
                    "rounded-xl border bg-white/[0.03] p-4 transition-all animate-in fade-in slide-in-from-top-2 duration-300",
                    isPending
                      ? "border-yellow-500/20"
                      : isMine
                      ? "border-primary/20"
                      : "border-white/[0.06]"
                  )}
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl",
                          isPending ? "bg-yellow-500/10" : isMine ? "bg-primary/10" : "bg-white/[0.06]"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-5 w-5",
                            isPending ? "text-yellow-400" : isMine ? "text-primary" : "text-muted-foreground"
                          )}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {call.consumer_name || "Cliente anônimo"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {callTypeLabels[call.call_type] || call.call_type}
                        </p>
                      </div>
                    </div>
                    <span className={cn("text-xs font-medium", time.color)}>
                      {time.text}
                    </span>
                  </div>

                  {/* Location */}
                  {(call.table_number || call.location_description) && (
                    <div className="mb-3 rounded-lg bg-white/[0.04] px-3 py-2">
                      <p className="text-xs text-muted-foreground">
                        {call.table_number ? `Mesa ${call.table_number}` : ""}
                        {call.table_number && call.location_description ? " · " : ""}
                        {call.location_description || ""}
                      </p>
                    </div>
                  )}

                  {/* Status for non-pending */}
                  {call.status === "accepted" && !isMine && (
                    <div className="mb-3">
                      <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                        Em atendimento
                      </span>
                    </div>
                  )}
                  {call.status === "completed" && (
                    <div className="mb-3">
                      <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-semibold text-green-400">
                        Concluído
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  {isPending && (
                    <button
                      onClick={() => handleAccept(call.id)}
                      disabled={accepting === call.id}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground active:scale-[0.98] transition-transform disabled:opacity-60"
                    >
                      {accepting === call.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          {t("waiter_accept_call")}
                        </>
                      )}
                    </button>
                  )}

                  {isMine && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleComplete(call.id)}
                        disabled={completing === call.id}
                        className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-success/20 font-semibold text-success active:scale-[0.98] transition-transform disabled:opacity-60"
                      >
                        {completing === call.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Concluir
                          </>
                        )}
                      </button>
                      {(call.call_type === "order" || call.call_type === "general") && (
                        <button
                          onClick={() =>
                            navigate("/garcom/pedido", {
                              state: { consumerId: call.consumer_id, consumerName: call.consumer_name },
                            })
                          }
                          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 font-semibold text-primary active:scale-[0.98] transition-transform"
                        >
                          <PlusCircle className="h-4 w-4" />
                          Pedido
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </WaiterSessionGuard>
  );
}
