import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect } from "react";

export type ClosingSummary = {
  event_id: string;
  event_name: string;
  total_orders: number;
  total_revenue: number;
  total_cancellations: number;
  total_cancelled_amount: number;
  total_checkins: number;
  avg_ticket: number;
  [key: string]: unknown;
};

export type CashRegisterMovement = {
  register_id: string;
  register_number: number;
  operator_id: string;
  opening_balance: number;
  closing_balance: number | null;
  status: string;
  total_cash_in: number;
  total_cash_out: number;
  [key: string]: unknown;
};

export type EventCancellation = {
  id: string;
  order_number: number;
  cancel_reason: string | null;
  cancelled_at: string;
  total: number;
  [key: string]: unknown;
};

export function useEventClosingReport(eventId: string) {
  const summaryQuery = useQuery({
    queryKey: ["event-closing-summary", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_event_closing_report" as any)
        .select("*")
        .eq("event_id", eventId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as ClosingSummary) ?? null;
    },
  });

  const cashQuery = useQuery({
    queryKey: ["event-cash-movements", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_event_cash_movements" as any)
        .select("*")
        .eq("event_id", eventId);
      if (error) throw error;
      return (data as unknown as CashRegisterMovement[]) ?? [];
    },
  });

  const cancellationsQuery = useQuery({
    queryKey: ["event-cancellations", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_event_cancellations" as any)
        .select("*")
        .eq("event_id", eventId);
      if (error) throw error;
      return (data as unknown as EventCancellation[]) ?? [];
    },
  });

  const error = summaryQuery.error || cashQuery.error || cancellationsQuery.error;

  useEffect(() => {
    if (error) {
      console.error("[useEventClosingReport]", error);
      toast.error("Erro ao carregar relatório de fechamento.");
    }
  }, [error]);

  return {
    summary: summaryQuery.data ?? null,
    cashRegisters: cashQuery.data ?? [],
    cancellations: cancellationsQuery.data ?? [],
    isLoading: summaryQuery.isLoading || cashQuery.isLoading || cancellationsQuery.isLoading,
    error,
  };
}
