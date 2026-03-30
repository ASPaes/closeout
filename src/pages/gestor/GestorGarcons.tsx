import { useEffect, useState, useCallback } from "react";
import { useGestor } from "@/contexts/GestorContext";
import { useTranslation } from "@/i18n/use-translation";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { UserCheck, Clock, DollarSign, ShoppingCart, AlertTriangle, ArrowUpDown } from "lucide-react";
import { AUDIT_ACTION } from "@/config/audit-actions";
import type { TranslationKey } from "@/i18n/translations/pt-BR";

type ActiveSession = {
  id: string;
  waiter_id: string;
  waiter_name: string;
  event_name: string;
  assignment_type: string;
  assignment_value: string | null;
  started_at: string;
  cash_collected: number;
  orders_count: number;
  total_sold: number;
};

type ClosedSession = {
  id: string;
  waiter_id: string;
  waiter_name: string;
  event_name: string;
  started_at: string;
  closed_at: string;
  total_sold: number;
  cash_collected: number;
  cash_handed_over: number;
  cash_discrepancy: number;
};

type CancellationRequest = {
  id: string;
  waiter_id: string;
  waiter_name: string;
  order_id: string;
  order_number: number;
  reason: string;
  created_at: string;
  status: string;
};

type PerformanceRow = {
  waiter_id: string;
  waiter_name: string;
  orders: number;
  total_sold: number;
  avg_ticket: number;
  calls_answered: number;
};

export default function GestorGarcons() {
  const { effectiveClientId } = useGestor();
  const { user } = useAuth();
  const { t } = useTranslation();

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);

  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [closedSessions, setClosedSessions] = useState<ClosedSession[]>([]);
  const [cancellations, setCancellations] = useState<CancellationRequest[]>([]);
  const [performance, setPerformance] = useState<PerformanceRow[]>([]);
  const [sortBy, setSortBy] = useState<keyof PerformanceRow>("total_sold");

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectRequestId, setRejectRequestId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch active events for selector
  useEffect(() => {
    if (!effectiveClientId) return;
    supabase
      .from("events")
      .select("id, name")
      .eq("client_id", effectiveClientId)
      .eq("status", "active")
      .order("start_at", { ascending: false })
      .then(({ data }) => {
        setEvents(data ?? []);
        if (data && data.length > 0 && !selectedEventId) {
          setSelectedEventId(data[0].id);
        }
      });
  }, [effectiveClientId]);

  // Fetch active sessions
  const fetchActive = useCallback(async () => {
    if (!selectedEventId || !effectiveClientId) return;
    const { data: sessions } = await supabase
      .from("waiter_sessions" as any)
      .select("id, waiter_id, assignment_type, assignment_value, started_at, cash_collected")
      .eq("event_id", selectedEventId)
      .eq("client_id", effectiveClientId)
      .is("closed_at", null);

    if (!sessions || (sessions as any[]).length === 0) {
      setActiveSessions([]);
      return;
    }

    const waiterIds = [...new Set((sessions as any[]).map((s: any) => s.waiter_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", waiterIds);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.name]));

    const { data: eventData } = await supabase
      .from("events")
      .select("name")
      .eq("id", selectedEventId)
      .single();

    // Orders per waiter
    const { data: orders } = await supabase
      .from("orders")
      .select("waiter_id, total, status")
      .eq("event_id", selectedEventId)
      .in("waiter_id", waiterIds);

    const ordersByWaiter = new Map<string, { count: number; total: number }>();
    for (const o of orders ?? []) {
      const wid = (o as any).waiter_id;
      const cur = ordersByWaiter.get(wid) || { count: 0, total: 0 };
      cur.count++;
      if (!["cancelled"].includes(o.status)) cur.total += Number(o.total);
      ordersByWaiter.set(wid, cur);
    }

    setActiveSessions(
      (sessions as any[]).map((s: any) => ({
        id: s.id,
        waiter_id: s.waiter_id,
        waiter_name: profileMap.get(s.waiter_id) || "—",
        event_name: eventData?.name || "",
        assignment_type: s.assignment_type || "free",
        assignment_value: s.assignment_value,
        started_at: s.started_at,
        cash_collected: Number(s.cash_collected) || 0,
        orders_count: ordersByWaiter.get(s.waiter_id)?.count || 0,
        total_sold: ordersByWaiter.get(s.waiter_id)?.total || 0,
      }))
    );
  }, [selectedEventId, effectiveClientId]);

  // Fetch closed sessions
  const fetchClosed = useCallback(async () => {
    if (!selectedEventId || !effectiveClientId) return;
    const { data: sessions } = await supabase
      .from("waiter_sessions" as any)
      .select("id, waiter_id, started_at, closed_at, cash_collected, cash_handed_over, cash_discrepancy")
      .eq("event_id", selectedEventId)
      .eq("client_id", effectiveClientId)
      .not("closed_at", "is", null)
      .order("closed_at", { ascending: false });

    if (!sessions || (sessions as any[]).length === 0) {
      setClosedSessions([]);
      return;
    }

    const waiterIds = [...new Set((sessions as any[]).map((s: any) => s.waiter_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", waiterIds);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.name]));

    const { data: eventData } = await supabase
      .from("events")
      .select("name")
      .eq("id", selectedEventId)
      .single();

    // Total sold per waiter
    const { data: orders } = await supabase
      .from("orders")
      .select("waiter_id, total, status")
      .eq("event_id", selectedEventId)
      .in("waiter_id", waiterIds)
      .neq("status", "cancelled");

    const totalByWaiter = new Map<string, number>();
    for (const o of orders ?? []) {
      const wid = (o as any).waiter_id;
      totalByWaiter.set(wid, (totalByWaiter.get(wid) || 0) + Number(o.total));
    }

    setClosedSessions(
      (sessions as any[]).map((s: any) => ({
        id: s.id,
        waiter_id: s.waiter_id,
        waiter_name: profileMap.get(s.waiter_id) || "—",
        event_name: eventData?.name || "",
        started_at: s.started_at,
        closed_at: s.closed_at,
        total_sold: totalByWaiter.get(s.waiter_id) || 0,
        cash_collected: Number(s.cash_collected) || 0,
        cash_handed_over: Number(s.cash_handed_over) || 0,
        cash_discrepancy: Number(s.cash_discrepancy) || 0,
      }))
    );
  }, [selectedEventId, effectiveClientId]);

  // Fetch cancellation requests
  const fetchCancellations = useCallback(async () => {
    if (!selectedEventId || !effectiveClientId) return;
    const { data } = await supabase
      .from("waiter_cancellation_requests" as any)
      .select("id, waiter_id, order_id, reason, created_at, status")
      .eq("event_id", selectedEventId)
      .eq("client_id", effectiveClientId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (!data || (data as any[]).length === 0) {
      setCancellations([]);
      return;
    }

    const waiterIds = [...new Set((data as any[]).map((d: any) => d.waiter_id))];
    const orderIds = [...new Set((data as any[]).map((d: any) => d.order_id))];

    const [{ data: profiles }, { data: orders }] = await Promise.all([
      supabase.from("profiles").select("id, name").in("id", waiterIds),
      supabase.from("orders").select("id, order_number").in("id", orderIds),
    ]);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.name]));
    const orderMap = new Map((orders ?? []).map((o) => [o.id, o.order_number]));

    setCancellations(
      (data as any[]).map((d: any) => ({
        id: d.id,
        waiter_id: d.waiter_id,
        waiter_name: profileMap.get(d.waiter_id) || "—",
        order_id: d.order_id,
        order_number: orderMap.get(d.order_id) || 0,
        reason: d.reason,
        created_at: d.created_at,
        status: d.status,
      }))
    );
  }, [selectedEventId, effectiveClientId]);

  // Fetch performance
  const fetchPerformance = useCallback(async () => {
    if (!selectedEventId || !effectiveClientId) return;
    const { data: orders } = await supabase
      .from("orders")
      .select("waiter_id, total, status")
      .eq("event_id", selectedEventId)
      .not("waiter_id", "is", null)
      .neq("status", "cancelled");

    if (!orders || orders.length === 0) { setPerformance([]); return; }

    const waiterIds = [...new Set(orders.map((o) => (o as any).waiter_id).filter(Boolean))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", waiterIds);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.name]));

    // Calls answered
    const { data: calls } = await supabase
      .from("waiter_calls" as any)
      .select("accepted_by")
      .eq("event_id", selectedEventId)
      .eq("status", "completed")
      .in("accepted_by", waiterIds);

    const callsByWaiter = new Map<string, number>();
    for (const c of (calls ?? []) as any[]) {
      callsByWaiter.set(c.accepted_by, (callsByWaiter.get(c.accepted_by) || 0) + 1);
    }

    const byWaiter = new Map<string, { count: number; total: number }>();
    for (const o of orders) {
      const wid = (o as any).waiter_id;
      if (!wid) continue;
      const cur = byWaiter.get(wid) || { count: 0, total: 0 };
      cur.count++;
      cur.total += Number(o.total);
      byWaiter.set(wid, cur);
    }

    const rows: PerformanceRow[] = [...byWaiter.entries()].map(([wid, data]) => ({
      waiter_id: wid,
      waiter_name: profileMap.get(wid) || "—",
      orders: data.count,
      total_sold: data.total,
      avg_ticket: data.count > 0 ? data.total / data.count : 0,
      calls_answered: callsByWaiter.get(wid) || 0,
    }));

    setPerformance(rows);
  }, [selectedEventId, effectiveClientId]);

  useEffect(() => {
    fetchActive();
    fetchClosed();
    fetchCancellations();
    fetchPerformance();
  }, [fetchActive, fetchClosed, fetchCancellations, fetchPerformance]);

  // Realtime for cancellations & sessions
  useEffect(() => {
    if (!selectedEventId) return;
    const ch = supabase
      .channel(`gestor-garcons-${selectedEventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "waiter_cancellation_requests", filter: `event_id=eq.${selectedEventId}` }, () => fetchCancellations())
      .on("postgres_changes", { event: "*", schema: "public", table: "waiter_sessions", filter: `event_id=eq.${selectedEventId}` }, () => { fetchActive(); fetchClosed(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `event_id=eq.${selectedEventId}` }, () => { fetchActive(); fetchPerformance(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedEventId, fetchCancellations, fetchActive, fetchClosed, fetchPerformance]);

  const handleApprove = async (reqId: string) => {
    setActionLoading(true);
    try {
      const { data, error } = await supabase.rpc("review_waiter_cancellation", {
        p_request_id: reqId,
        p_decision: "approved",
        p_notes: "",
      });
      if (error) throw error;
      await logAudit(supabase, {
        action: AUDIT_ACTION.WAITER_CANCELLATION_AUTHORIZED,
        userId: user!.id,
        entityType: "waiter_cancellation_request",
        entityId: reqId,
      });
      toast.success(t("gw_approved_success" as TranslationKey));
      fetchCancellations();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectNotes.trim()) {
      toast.error(t("gw_reject_reason_required" as TranslationKey));
      return;
    }
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc("review_waiter_cancellation", {
        p_request_id: rejectRequestId!,
        p_decision: "rejected",
        p_notes: rejectNotes.trim(),
      });
      if (error) throw error;
      toast.success(t("gw_rejected_success" as TranslationKey));
      setRejectDialogOpen(false);
      setRejectNotes("");
      fetchCancellations();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };
  const fmtDuration = (start: string, end: string) => {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h${String(m).padStart(2, "0")}`;
  };
  const timeSince = (iso: string) => {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 60) return `${m} min`;
    return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
  };

  const sortedPerformance = [...performance].sort((a, b) => (b[sortBy] as number) - (a[sortBy] as number));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <PageHeader
          title={t("gestor_waiters" as TranslationKey)}
          description={t("gestor_waiters_desc" as TranslationKey)}
        />
        <Select value={selectedEventId || ""} onValueChange={setSelectedEventId}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder={t("gw_select_event" as TranslationKey)} />
          </SelectTrigger>
          <SelectContent>
            {events.map((ev) => (
              <SelectItem key={ev.id} value={ev.id}>{ev.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("gw_active_waiters" as TranslationKey)}</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSessions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("gw_pending_cancellations" as TranslationKey)}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {cancellations.length}
              {cancellations.length > 0 && (
                <Badge variant="destructive" className="text-xs">{cancellations.length}</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">{t("gw_active_tab" as TranslationKey)}</TabsTrigger>
          <TabsTrigger value="closed">{t("gw_closed_tab" as TranslationKey)}</TabsTrigger>
          <TabsTrigger value="cancellations" className="relative">
            {t("gw_cancellations_tab" as TranslationKey)}
            {cancellations.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                {cancellations.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ACTIVE TAB */}
        <TabsContent value="active" className="space-y-4 mt-4">
          {activeSessions.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">{t("gw_no_active" as TranslationKey)}</CardContent></Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeSessions.map((s) => (
                <Card key={s.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold">{s.waiter_name}</CardTitle>
                      <Badge variant="outline" className="bg-success/15 text-success border-success/30 text-xs capitalize">
                        {s.assignment_type === "tables" ? `${t("waiter_tables" as TranslationKey)}: ${s.assignment_value}` : s.assignment_type === "sector" ? `${t("waiter_sector" as TranslationKey)}: ${s.assignment_value}` : t("waiter_free" as TranslationKey)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {t("gw_active_since" as TranslationKey)} {fmtTime(s.started_at)}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("gw_orders_in_progress" as TranslationKey)}</span>
                      <span className="font-medium">{s.orders_count}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("gw_total_sold" as TranslationKey)}</span>
                      <span className="font-medium">{fmt(s.total_sold)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("gw_cash_in_hand" as TranslationKey)}</span>
                      <span className="font-medium">{fmt(s.cash_collected)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* CLOSED TAB */}
        <TabsContent value="closed" className="mt-4">
          {closedSessions.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">{t("gw_no_closed" as TranslationKey)}</CardContent></Card>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("gw_waiter" as TranslationKey)}</TableHead>
                    <TableHead>{t("gw_duration" as TranslationKey)}</TableHead>
                    <TableHead className="text-right">{t("gw_total_sold" as TranslationKey)}</TableHead>
                    <TableHead className="text-right">{t("gw_cash_collected" as TranslationKey)}</TableHead>
                    <TableHead className="text-right">{t("gw_cash_handed" as TranslationKey)}</TableHead>
                    <TableHead className="text-right">{t("gw_discrepancy" as TranslationKey)}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closedSessions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.waiter_name}</TableCell>
                      <TableCell>{fmtDuration(s.started_at, s.closed_at)}</TableCell>
                      <TableCell className="text-right">{fmt(s.total_sold)}</TableCell>
                      <TableCell className="text-right">{fmt(s.cash_collected)}</TableCell>
                      <TableCell className="text-right">{fmt(s.cash_handed_over)}</TableCell>
                      <TableCell className={`text-right font-medium ${s.cash_discrepancy !== 0 ? "text-destructive" : ""}`}>
                        {fmt(s.cash_discrepancy)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* CANCELLATIONS TAB */}
        <TabsContent value="cancellations" className="space-y-4 mt-4">
          {cancellations.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">{t("gw_no_cancellations" as TranslationKey)}</CardContent></Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {cancellations.map((c) => (
                <Card key={c.id} className="border-destructive/30">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{c.waiter_name}</CardTitle>
                      <Badge variant="outline" className="text-xs">#{String(c.order_number).padStart(3, "0")}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{timeSince(c.created_at)} atrás</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm">{c.reason}</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(c.id)}
                        disabled={actionLoading}
                        className="flex-1"
                      >
                        {t("gw_approve" as TranslationKey)}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setRejectRequestId(c.id);
                          setRejectDialogOpen(true);
                        }}
                        disabled={actionLoading}
                        className="flex-1"
                      >
                        {t("gw_reject" as TranslationKey)}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Performance comparison */}
      {performance.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5 text-primary" />
            {t("gw_performance" as TranslationKey)}
          </h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("gw_waiter" as TranslationKey)}</TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => setSortBy("orders")}>
                    {t("gw_orders_in_progress" as TranslationKey)} <ArrowUpDown className="inline h-3 w-3" />
                  </TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => setSortBy("total_sold")}>
                    {t("gw_total_sold" as TranslationKey)} <ArrowUpDown className="inline h-3 w-3" />
                  </TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => setSortBy("avg_ticket")}>
                    {t("gw_avg_ticket" as TranslationKey)} <ArrowUpDown className="inline h-3 w-3" />
                  </TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => setSortBy("calls_answered")}>
                    {t("gw_calls_answered" as TranslationKey)} <ArrowUpDown className="inline h-3 w-3" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPerformance.map((row) => (
                  <TableRow key={row.waiter_id}>
                    <TableCell className="font-medium">{row.waiter_name}</TableCell>
                    <TableCell className="text-right">{row.orders}</TableCell>
                    <TableCell className="text-right">{fmt(row.total_sold)}</TableCell>
                    <TableCell className="text-right">{fmt(row.avg_ticket)}</TableCell>
                    <TableCell className="text-right">{row.calls_answered}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Reject dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("gw_reject" as TranslationKey)}</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder={t("gw_reject_reason" as TranslationKey)}
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              {t("cancel" as TranslationKey)}
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={actionLoading}>
              {t("gw_reject" as TranslationKey)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
