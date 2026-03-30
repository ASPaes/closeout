import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@/i18n/use-translation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  History, ChevronDown, Clock, DollarSign, ShoppingCart, Loader2,
} from "lucide-react";

type SessionRow = {
  id: string;
  event_id: string;
  event_name: string;
  started_at: string;
  closed_at: string;
  cash_collected: number;
  cash_handed_over: number | null;
  cash_discrepancy: number | null;
  notes: string | null;
  orderCount: number;
  totalSold: number;
  cashTotal: number;
  posTotal: number;
  pixTotal: number;
};

export default function WaiterHistorico() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }

    const { data: rawSessions } = await supabase
      .from("waiter_sessions" as any)
      .select("id, event_id, started_at, closed_at, cash_collected, cash_handed_over, cash_discrepancy, notes")
      .eq("waiter_id", user.id)
      .not("closed_at", "is", null)
      .order("closed_at", { ascending: false })
      .limit(50);

    if (!rawSessions || (rawSessions as any[]).length === 0) {
      setLoading(false);
      return;
    }

    const enriched: SessionRow[] = await Promise.all(
      (rawSessions as any[]).map(async (s) => {
        // Event name
        const { data: evt } = await supabase
          .from("events")
          .select("name")
          .eq("id", s.event_id)
          .single();

        // Orders in this shift
        const { data: orders } = await supabase
          .from("orders")
          .select("total, payment_method, status")
          .eq("event_id", s.event_id)
          .eq("waiter_id", user.id)
          .gte("created_at", s.started_at)
          .lte("created_at", s.closed_at)
          .neq("status", "cancelled");

        const list = (orders as any[]) || [];

        return {
          ...s,
          event_name: evt?.name || "Evento",
          orderCount: list.length,
          totalSold: list.reduce((acc, o) => acc + Number(o.total), 0),
          cashTotal: list.filter(o => o.payment_method === "cash").reduce((acc, o) => acc + Number(o.total), 0),
          posTotal: list.filter(o => ["pos", "debit_card", "credit_card"].includes(o.payment_method)).reduce((acc, o) => acc + Number(o.total), 0),
          pixTotal: list.filter(o => o.payment_method === "pix").reduce((acc, o) => acc + Number(o.total), 0),
        };
      })
    );

    setSessions(enriched);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  function formatDuration(start: string, end: string) {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h${String(m).padStart(2, "0")}min` : `${m}min`;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">{t("waiter_history")}</h1>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <History className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-sm">Nenhum turno encerrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => (
            <Collapsible key={s.id}>
              <Card className="border-border/40 bg-card/60">
                <CollapsibleTrigger asChild>
                  <CardContent className="p-4 cursor-pointer active:bg-muted/10 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">{s.event_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(s.started_at).toLocaleDateString("pt-BR")} · {formatDuration(s.started_at, s.closed_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-primary">
                          R$ {s.totalSold.toFixed(2)}
                        </span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                      </div>
                    </div>
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ShoppingCart className="h-3 w-3" /> {s.orderCount} pedidos
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {new Date(s.started_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} - {new Date(s.closed_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </CardContent>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t border-border/30 px-4 py-3 space-y-2 text-sm">
                    <DetailRow label="Dinheiro" value={`R$ ${s.cashTotal.toFixed(2)}`} />
                    <DetailRow label="POS/Cartão" value={`R$ ${s.posTotal.toFixed(2)}`} />
                    <DetailRow label="PIX" value={`R$ ${s.pixTotal.toFixed(2)}`} />
                    {s.cash_handed_over != null && (
                      <>
                        <div className="border-t border-border/30 pt-2">
                          <DetailRow label="Repasse em dinheiro" value={`R$ ${Number(s.cash_handed_over).toFixed(2)}`} />
                        </div>
                        {s.cash_discrepancy != null && Math.abs(Number(s.cash_discrepancy)) > 0.01 && (
                          <div className={`text-xs px-2 py-1 rounded ${
                            Number(s.cash_discrepancy) > 0
                              ? "text-yellow-400 bg-yellow-500/10"
                              : "text-destructive bg-destructive/10"
                          }`}>
                            Diferença: R$ {Math.abs(Number(s.cash_discrepancy)).toFixed(2)}
                            {Number(s.cash_discrepancy) > 0 ? " (a mais)" : " (a menos)"}
                          </div>
                        )}
                      </>
                    )}
                    {s.notes && (
                      <p className="text-xs text-muted-foreground italic mt-1">
                        Obs: {s.notes}
                      </p>
                    )}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
