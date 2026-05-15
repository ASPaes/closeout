import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGestor } from "@/contexts/GestorContext";
import { useTranslation } from "@/i18n/use-translation";
import { ModalForm } from "@/components/ModalForm";
import { Banknote, Play, Check, RefreshCw, Calendar, ChevronRight, Plus, ReceiptText, Eye, Lock, FileText, User } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTION } from "@/config/audit-actions";
import { cn } from "@/lib/utils";

type CashRegisterRow = {
  id: string;
  operator_id: string;
  operator_name: string;
  register_number: number;
  opened_at: string;
  closed_at: string | null;
  status: string;
  opening_balance: number;
  closing_balance: number | null;
  event_id: string;
  event_name: string;
  client_id: string;
  notes: string | null;
  sales_total: number;
  movements_out: number;
  movements_in: number;
  refunds: number;
  sales_count: number;
};

type ReturnRow = {
  id: string;
  created_at: string;
  order_number: number | null;
  items: any;
  refund_amount: number;
  reason: string;
  occurrence_type: string;
  authorized_by_name: string;
  operator_name: string;
  cash_register_id: string;
};

type EventGroup = {
  eventId: string;
  eventName: string;
  eventDate: string;
  caixas: CashRegisterRow[];
  isActive: boolean;
  totalSaldo: number;
  totalVendas: number;
  totalSangrias: number;
  ticketMedio: number;
  caixasAbertos: number;
};

export default function GestorCaixas() {
  const { t } = useTranslation();
  const { effectiveClientId } = useGestor();
  const [registers, setRegisters] = useState<CashRegisterRow[]>([]);
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingReturns, setLoadingReturns] = useState(true);
  const [events, setEvents] = useState<{ id: string; name: string; start_at: string | null }[]>([]);
  const [detailModal, setDetailModal] = useState<CashRegisterRow | null>(null);
  const [closeConfirm, setCloseConfirm] = useState<CashRegisterRow | null>(null);
  const [closingBalance, setClosingBalance] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const [closing, setClosing] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [openEventId, setOpenEventId] = useState("");
  const [openOperatorId, setOpenOperatorId] = useState("");
  const [openBalance, setOpenBalance] = useState("");
  const [opening, setOpening] = useState(false);
  const [operators, setOperators] = useState<{ id: string; name: string }[]>([]);
  const [activeTab, setActiveTab] = useState<"ativos" | "encerrados">("ativos");
  const [selectedGroup, setSelectedGroup] = useState<EventGroup | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    if (!effectiveClientId) return;
    supabase
      .from("events")
      .select("id, name, start_at")
      .eq("client_id", effectiveClientId)
      .order("name")
      .then(({ data }) => setEvents(data ?? []));
  }, [effectiveClientId]);

  // Fetch operators (users with roles in this client)
  useEffect(() => {
    if (!effectiveClientId) return;
    supabase
      .from("user_roles")
      .select("user_id")
      .eq("client_id", effectiveClientId)
      .then(async ({ data: roles }) => {
        if (!roles?.length) { setOperators([]); return; }
        const ids = [...new Set(roles.map(r => r.user_id))];
        const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", ids);
        setOperators((profiles ?? []).map(p => ({ id: p.id, name: p.name })));
      });
  }, [effectiveClientId]);

  const handleOpenRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openEventId || !openOperatorId || !openBalance || !effectiveClientId) return;
    setOpening(true);
    try {
      const { data, error } = await supabase
        .from("cash_registers")
        .insert({
          event_id: openEventId,
          client_id: effectiveClientId,
          operator_id: openOperatorId,
          opening_balance: parseFloat(openBalance),
          status: "open",
          register_number: 0,
        } as any)
        .select("id")
        .single();
      if (error) throw error;

      await logAudit({
        action: AUDIT_ACTION.CASH_REGISTER_OPENED,
        entityType: "cash_register",
        entityId: data.id,
        newData: { event_id: openEventId, operator_id: openOperatorId, opening_balance: parseFloat(openBalance), opened_by: "gestor" },
      });

      toast.success(t("gcx_open_success"));
      setOpenModal(false);
      setOpenEventId("");
      setOpenOperatorId("");
      setOpenBalance("");
      fetchRegisters();
    } catch (err: any) {
      toast.error(err.message || t("gcx_open_error"));
    } finally {
      setOpening(false);
    }
  };

  const fetchRegisters = async () => {
    if (!effectiveClientId) return;
    setLoading(true);

    let query = supabase
      .from("cash_registers")
      .select("id, operator_id, opened_at, closed_at, status, opening_balance, closing_balance, event_id, client_id, notes, register_number")
      .eq("client_id", effectiveClientId)
      .order("opened_at", { ascending: false })
      .limit(200);

    const { data: regs } = await query;
    if (!regs) { setLoading(false); return; }

    const operatorIds = [...new Set(regs.map(r => r.operator_id))];
    const eventIds = [...new Set(regs.map(r => r.event_id))];
    const regIds = regs.map(r => r.id);

    const [profilesRes, evtsRes, ordersRes, movRes, refundsRes] = await Promise.all([
      operatorIds.length ? supabase.from("profiles").select("id, name").in("id", operatorIds) : { data: [] },
      eventIds.length ? supabase.from("events").select("id, name").in("id", eventIds) : { data: [] },
      regIds.length ? supabase.from("cash_orders").select("cash_register_id, total, status").in("cash_register_id", regIds).eq("status", "completed") : { data: [] },
      regIds.length ? supabase.from("cash_movements").select("cash_register_id, amount, direction").in("cash_register_id", regIds) : { data: [] },
      regIds.length ? supabase.from("returns").select("cash_register_id, refund_amount").in("cash_register_id", regIds) : { data: [] },
    ]);

    const profileMap = Object.fromEntries((profilesRes.data ?? []).map(p => [p.id, p.name]));
    const eventMap = Object.fromEntries((evtsRes.data ?? []).map(e => [e.id, e.name]));

    const salesMap: Record<string, number> = {};
    const salesCountMap: Record<string, number> = {};
    const movInMap: Record<string, number> = {};
    const movOutMap: Record<string, number> = {};
    const refundMap: Record<string, number> = {};

    (ordersRes.data ?? []).forEach(o => {
      salesMap[o.cash_register_id] = (salesMap[o.cash_register_id] || 0) + Number(o.total);
      salesCountMap[o.cash_register_id] = (salesCountMap[o.cash_register_id] || 0) + 1;
    });
    (movRes.data ?? []).forEach(m => {
      if (m.direction === "in") movInMap[m.cash_register_id] = (movInMap[m.cash_register_id] || 0) + Number(m.amount);
      else movOutMap[m.cash_register_id] = (movOutMap[m.cash_register_id] || 0) + Number(m.amount);
    });
    (refundsRes.data ?? []).forEach(r => { refundMap[r.cash_register_id] = (refundMap[r.cash_register_id] || 0) + Number(r.refund_amount); });

    setRegisters(regs.map(r => ({
      ...r,
      register_number: r.register_number,
      operator_name: profileMap[r.operator_id] || r.operator_id.slice(0, 8),
      event_name: eventMap[r.event_id] || r.event_id.slice(0, 8),
      sales_total: salesMap[r.id] || 0,
      movements_out: movOutMap[r.id] || 0,
      movements_in: movInMap[r.id] || 0,
      refunds: refundMap[r.id] || 0,
      sales_count: salesCountMap[r.id] || 0,
    })));
    setLoading(false);
    setLastRefresh(new Date());
  };

  useEffect(() => { fetchRegisters(); }, [effectiveClientId]);

  useEffect(() => {
    if (activeTab !== "ativos") return;
    const interval = setInterval(() => { fetchRegisters(); }, 60000);
    return () => clearInterval(interval);
  }, [activeTab, effectiveClientId]);

  useEffect(() => {
    if (!effectiveClientId) return;
    setLoadingReturns(true);
    (async () => {
      const { data: rets } = await supabase
        .from("returns")
        .select("id, created_at, cash_order_id, cash_register_id, items, refund_amount, reason, occurrence_type, authorized_by, operator_id")
        .eq("client_id", effectiveClientId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (!rets) { setLoadingReturns(false); return; }

      const orderIds = [...new Set(rets.map(r => r.cash_order_id))];
      const userIds = [...new Set([...rets.map(r => r.authorized_by), ...rets.map(r => r.operator_id)])];

      const [orderRes, profileRes] = await Promise.all([
        orderIds.length ? supabase.from("cash_orders").select("id, order_number").in("id", orderIds) : { data: [] },
        userIds.length ? supabase.from("profiles").select("id, name").in("id", userIds) : { data: [] },
      ]);

      const orderMap = Object.fromEntries((orderRes.data ?? []).map(o => [o.id, o.order_number]));
      const pMap = Object.fromEntries((profileRes.data ?? []).map(p => [p.id, p.name]));

      setReturns(rets.map(r => ({
        id: r.id,
        created_at: r.created_at,
        order_number: orderMap[r.cash_order_id] ?? null,
        items: r.items,
        refund_amount: r.refund_amount,
        reason: r.reason,
        occurrence_type: r.occurrence_type,
        authorized_by_name: pMap[r.authorized_by] || r.authorized_by.slice(0, 8),
        operator_name: pMap[r.operator_id] || r.operator_id.slice(0, 8),
        cash_register_id: r.cash_register_id,
      })));
      setLoadingReturns(false);
    })();
  }, [effectiveClientId]);

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
  const currentBalance = (r: CashRegisterRow) =>
    Math.round((r.opening_balance + r.sales_total + r.movements_in - r.movements_out - r.refunds) * 100) / 100;

  const handleCloseRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closeConfirm || !closingBalance) return;
    setClosing(true);
    try {
      const { data, error } = await supabase.rpc("close_cash_register", {
        p_register_id: closeConfirm.id,
        p_closing_balance: parseFloat(closingBalance),
      });
      if (error) throw error;

      await logAudit({
        action: AUDIT_ACTION.CASH_REGISTER_CLOSED,
        entityType: "cash_register",
        entityId: closeConfirm.id,
        metadata: { closed_by: "gestor", notes: closingNotes },
        newData: typeof data === "object" && data !== null ? (data as Record<string, unknown>) : { result: data },
      });

      toast.success(t("gcx_close_success"));
      setCloseConfirm(null);
      setClosingBalance("");
      setClosingNotes("");
      fetchRegisters();
    } catch (err: any) {
      toast.error(err.message || t("gcx_close_error"));
    } finally {
      setClosing(false);
    }
  };

  const eventDateMap = useMemo(
    () => Object.fromEntries(events.map((e) => [e.id, e.start_at])),
    [events]
  );

  const groups: EventGroup[] = useMemo(() => {
    const map = new Map<string, CashRegisterRow[]>();
    registers.forEach((r) => {
      if (!map.has(r.event_id)) map.set(r.event_id, []);
      map.get(r.event_id)!.push(r);
    });
    const out: EventGroup[] = [];
    map.forEach((caixas, eventId) => {
      const totalSaldo = caixas.reduce((s, c) => s + currentBalance(c), 0);
      const totalVendas = caixas.reduce((s, c) => s + c.sales_total, 0);
      const totalSangrias = caixas.reduce((s, c) => s + c.movements_out, 0);
      const totalTransacoes = caixas.reduce((s, c) => s + c.sales_count, 0);
      const ticketMedio = totalTransacoes > 0 ? Math.round((totalVendas / totalTransacoes) * 100) / 100 : 0;
      const caixasAbertos = caixas.filter((c) => c.status === "open").length;
      out.push({
        eventId,
        eventName: caixas[0].event_name,
        eventDate: eventDateMap[eventId] || caixas[0].opened_at,
        caixas,
        isActive: caixasAbertos > 0,
        totalSaldo,
        totalVendas,
        totalSangrias,
        ticketMedio,
        caixasAbertos,
      });
    });
    return out;
  }, [registers, eventDateMap]);

  const activeGroups = useMemo(
    () => groups.filter((g) => g.isActive).sort((a, b) => +new Date(b.eventDate) - +new Date(a.eventDate)),
    [groups]
  );
  const closedGroups = useMemo(
    () => groups.filter((g) => !g.isActive).sort((a, b) => +new Date(b.eventDate) - +new Date(a.eventDate)),
    [groups]
  );
  const currentGroups = activeTab === "ativos" ? activeGroups : closedGroups;

  useEffect(() => {
    if (!selectedGroup) return;
    const updated = groups.find((g) => g.eventId === selectedGroup.eventId);
    if (updated) setSelectedGroup(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  const eventReturns = useMemo(() => {
    if (!selectedGroup) return [];
    const ids = new Set(selectedGroup.caixas.map((c) => c.id));
    return returns.filter((r) => ids.has(r.cash_register_id));
  }, [returns, selectedGroup]);

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Banknote className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("gcx_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("gcx_description")}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab("ativos")}
          className={cn(
            "flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors",
            activeTab === "ativos"
              ? "text-primary border-primary"
              : "text-muted-foreground border-transparent hover:text-foreground"
          )}
        >
          <Play className="h-4 w-4" />
          Ativos
          <span className="ml-1 rounded-full bg-secondary px-2 py-0.5 text-xs">{activeGroups.length}</span>
        </button>
        <button
          onClick={() => setActiveTab("encerrados")}
          className={cn(
            "flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors",
            activeTab === "encerrados"
              ? "text-primary border-primary"
              : "text-muted-foreground border-transparent hover:text-foreground"
          )}
        >
          <Check className="h-4 w-4" />
          Encerrados
          <span className="ml-1 rounded-full bg-secondary px-2 py-0.5 text-xs">{closedGroups.length}</span>
        </button>
      </div>

      {activeTab === "ativos" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5" />
          Atualiza a cada 1 min · Última: {lastRefresh.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      )}

      {loading && registers.length === 0 && (
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="shrink-0 min-w-[400px] rounded-2xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="h-5 w-2/3 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
                </div>
                <div className="h-6 w-16 rounded-full bg-muted animate-pulse" />
              </div>
              <div className="h-20 rounded-xl bg-muted animate-pulse" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-12 rounded-lg bg-muted animate-pulse" />
                <div className="h-12 rounded-lg bg-muted animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}

      {(!loading || registers.length > 0) && (
        <>
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
            {currentGroups.map((group, i) => (
              <EventCard key={group.eventId} group={group} index={i} onClick={() => setSelectedGroup(group)} />
            ))}
          </div>

          {currentGroups.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Banknote className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhum evento {activeTab === "ativos" ? "ativo" : "encerrado"} com caixas
              </p>
            </div>
          )}
        </>
      )}

      {/* Event drill-down sheet */}
      <Sheet open={!!selectedGroup} onOpenChange={(open) => { if (!open) setSelectedGroup(null); }}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-t border-border bg-background p-0 max-h-[92dvh] overflow-y-auto"
        >
          {selectedGroup && (
            <EventSheet
              group={selectedGroup}
              returns={eventReturns}
              loadingReturns={loadingReturns}
              onOpenRegister={(eventId) => { setOpenEventId(eventId); setOpenModal(true); setSelectedGroup(null); }}
              onCloseRegister={(reg) => { setCloseConfirm(reg); setSelectedGroup(null); }}
              onViewDetail={(reg) => { setDetailModal(reg); setSelectedGroup(null); }}
              currentBalance={currentBalance}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Detail Modal for closed register */}
      {detailModal && (
        <ModalForm
          open={!!detailModal}
          onOpenChange={() => setDetailModal(null)}
          title={t("gcx_detail_title")}
          onSubmit={(e) => { e.preventDefault(); setDetailModal(null); }}
          submitLabel={t("close")}
        >
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="text-muted-foreground">{t("gcx_col_operator")}</div>
              <div>{detailModal.operator_name}</div>
              <div className="text-muted-foreground">{t("gcx_col_event")}</div>
              <div>{detailModal.event_name}</div>
              <div className="text-muted-foreground">{t("gcx_col_opened_at")}</div>
              <div>{format(new Date(detailModal.opened_at), "dd/MM/yyyy HH:mm")}</div>
              <div className="text-muted-foreground">{t("gcx_closed_at")}</div>
              <div>{detailModal.closed_at ? format(new Date(detailModal.closed_at), "dd/MM/yyyy HH:mm") : "—"}</div>
            </div>
            <hr className="border-border" />
            <div className="grid grid-cols-2 gap-2">
              <div className="text-muted-foreground">{t("gcx_col_opening")}</div>
              <div>{fmt(detailModal.opening_balance)}</div>
              <div className="text-muted-foreground">{t("gcx_col_sales")}</div>
              <div>{fmt(detailModal.sales_total)}</div>
              <div className="text-muted-foreground">{t("caixa_total_deposits")}</div>
              <div className="text-success">{fmt(detailModal.movements_in)}</div>
              <div className="text-muted-foreground">{t("gcx_col_withdrawals")}</div>
              <div className="text-destructive">{fmt(detailModal.movements_out)}</div>
              <div className="text-muted-foreground">{t("caixa_total_returns")}</div>
              <div className="text-destructive">{fmt(detailModal.refunds)}</div>
            </div>
            <hr className="border-border" />
            <div className="grid grid-cols-2 gap-2">
              <div className="text-muted-foreground font-semibold">{t("caixa_expected_balance")}</div>
              <div className="font-semibold">{fmt(currentBalance(detailModal))}</div>
              <div className="text-muted-foreground font-semibold">{t("caixa_physical_balance")}</div>
              <div className="font-semibold">{fmt(detailModal.closing_balance ?? 0)}</div>
              <div className="text-muted-foreground font-semibold">{t("caixa_difference")}</div>
              <div className={`font-semibold ${(detailModal.closing_balance ?? 0) - currentBalance(detailModal) !== 0 ? "text-destructive" : "text-success"}`}>
                {fmt((detailModal.closing_balance ?? 0) - currentBalance(detailModal))}
              </div>
            </div>
            {detailModal.notes && (
              <>
                <hr className="border-border" />
                <div>
                  <div className="text-muted-foreground text-xs mb-1">{t("caixa_observations")}</div>
                  <div>{detailModal.notes}</div>
                </div>
              </>
            )}
          </div>
        </ModalForm>
      )}

      {/* Close Register Confirmation */}
      {closeConfirm && (
        <ModalForm
          open={!!closeConfirm}
          onOpenChange={() => { setCloseConfirm(null); setClosingBalance(""); setClosingNotes(""); }}
          title={t("gcx_close_title")}
          onSubmit={handleCloseRegister}
          submitLabel={t("gcx_close_register")}
          saving={closing}
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("gcx_close_confirm_msg")}
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">{t("gcx_col_operator")}</div>
              <div>{closeConfirm.operator_name}</div>
              <div className="text-muted-foreground">{t("gcx_col_current")}</div>
              <div className="font-semibold">{fmt(currentBalance(closeConfirm))}</div>
            </div>
            <div className="space-y-2">
              <Label>{t("caixa_physical_balance")}</Label>
              <Input
                type="number"
                step="0.01"
                value={closingBalance}
                onChange={(e) => setClosingBalance(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t("caixa_observations")}</Label>
              <Textarea
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder={t("caixa_observations_placeholder")}
              />
            </div>
          </div>
        </ModalForm>
      )}

      {/* Open Register Modal */}
      {openModal && (
        <ModalForm
          open={openModal}
          onOpenChange={() => { setOpenModal(false); setOpenEventId(""); setOpenOperatorId(""); setOpenBalance(""); }}
          title={t("gcx_open_new_title")}
          onSubmit={handleOpenRegister}
          submitLabel={t("caixa_open_register")}
          saving={opening}
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("gcx_open_select_event")}</Label>
              <Select value={openEventId} onValueChange={setOpenEventId}>
                <SelectTrigger><SelectValue placeholder={t("gcx_open_select_event")} /></SelectTrigger>
                <SelectContent>
                  {events.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("gcx_open_select_operator")}</Label>
              <Select value={openOperatorId} onValueChange={setOpenOperatorId}>
                <SelectTrigger><SelectValue placeholder={t("gcx_open_select_operator")} /></SelectTrigger>
                <SelectContent>
                  {operators.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("gcx_open_balance")}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={openBalance}
                onChange={(e) => setOpenBalance(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>
          </div>
        </ModalForm>
      )}
    </div>
  );
}

function EventCard({ group, index, onClick }: { group: EventGroup; index: number; onClick: () => void }) {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const dateLabel = (() => {
    try {
      return format(new Date(group.eventDate), "dd/MM/yyyy · HH:mm");
    } catch {
      return "";
    }
  })();
  return (
    <button
      onClick={onClick}
      style={{ animation: `fadeSlideIn 0.4s ease-out ${index * 80}ms both` }}
      className="relative shrink-0 min-w-[400px] text-left rounded-2xl border border-border bg-card p-6 overflow-hidden transition-all hover:border-primary/50 hover:shadow-lg hover:-translate-y-0.5 group opacity-0"
    >
      <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative flex items-start justify-between gap-4 mb-5">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-foreground truncate">{group.eventName}</h3>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {dateLabel}
          </div>
        </div>
        {group.isActive ? (
          <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            Ativo
          </span>
        ) : (
          <span className="shrink-0 inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            Encerrado
          </span>
        )}
      </div>

      <div className="relative mb-5">
        <div className="text-xs text-muted-foreground mb-1">Saldo total em caixa</div>
        <div className="text-3xl font-bold text-foreground">{fmt(group.totalSaldo)}</div>
      </div>

      <div className="relative grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-lg bg-secondary/50 p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Faturamento</div>
          <div className="mt-1 text-base font-semibold text-foreground">{fmt(group.totalVendas)}</div>
        </div>
        <div className="rounded-lg bg-secondary/50 p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Ticket médio</div>
          <div className="mt-1 text-base font-semibold text-foreground">{fmt(group.ticketMedio)}</div>
        </div>
      </div>

      <div className="relative flex items-center justify-between pt-4 border-t border-border">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Banknote className="h-3.5 w-3.5" />
          {group.caixasAbertos > 0
            ? `${group.caixasAbertos} caixa${group.caixasAbertos > 1 ? "s" : ""} aberto${group.caixasAbertos > 1 ? "s" : ""}`
            : `${group.caixas.length} caixa${group.caixas.length > 1 ? "s" : ""}`}
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:gap-2 transition-all">
          Ver caixas
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </button>
  );
}

interface EventSheetProps {
  group: EventGroup;
  returns: ReturnRow[];
  loadingReturns: boolean;
  onOpenRegister: (eventId: string) => void;
  onCloseRegister: (register: CashRegisterRow) => void;
  onViewDetail: (register: CashRegisterRow) => void;
  currentBalance: (r: CashRegisterRow) => number;
}

function EventSheet({ group, returns, loadingReturns, onOpenRegister, onCloseRegister, onViewDetail, currentBalance }: EventSheetProps) {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const dateLabel = (() => {
    try { return format(new Date(group.eventDate), "dd/MM/yyyy · HH:mm"); } catch { return ""; }
  })();

  const summaryChips = [
    { label: "Saldo total", value: fmt(group.totalSaldo), highlight: true },
    { label: "Faturamento", value: fmt(group.totalVendas), highlight: false },
    { label: "Ticket médio", value: fmt(group.ticketMedio), highlight: false },
    { label: "Sangrias", value: fmt(group.totalSangrias), highlight: false },
  ];

  return (
    <div className="px-6 pt-4 pb-10">
      <div className="flex justify-center mb-4">
        <div className="h-1.5 w-12 rounded-full bg-border" />
      </div>

      <SheetHeader className="mb-5 text-left">
        <SheetTitle className="text-2xl font-bold text-foreground">{group.eventName}</SheetTitle>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {dateLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Banknote className="h-3.5 w-3.5" />
            {group.caixas.length} caixa{group.caixas.length > 1 ? "s" : ""}
          </span>
          {group.isActive && (
            <span className="inline-flex items-center gap-1.5 text-primary">
              <RefreshCw className="h-3.5 w-3.5" />
              Atualiza a cada 1 min
            </span>
          )}
        </div>
      </SheetHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {summaryChips.map((chip) => (
          <div
            key={chip.label}
            className={cn(
              "rounded-xl p-3 border",
              chip.highlight
                ? "bg-primary/[0.07] border-primary/20"
                : "bg-secondary/40 border-border"
            )}
          >
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{chip.label}</div>
            <div className={cn("mt-1 text-base font-bold", chip.highlight ? "text-primary" : "text-foreground")}>
              {chip.value}
            </div>
          </div>
        ))}
      </div>

      <hr className="border-border mb-5" />

      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Caixas do evento</h3>
          {group.isActive && (
            <Button
              size="sm"
              onClick={() => onOpenRegister(group.eventId)}
              className="gap-1.5 h-8"
            >
              <Plus className="h-3.5 w-3.5" />
              Abrir novo caixa
            </Button>
          )}
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          {group.caixas.map((caixa) => (
            <CaixaCard
              key={caixa.id}
              caixa={caixa}
              currentBalance={currentBalance(caixa)}
              onClose={() => onCloseRegister(caixa)}
              onView={() => onViewDetail(caixa)}
            />
          ))}
        </div>
      </div>

      <hr className="border-border mb-5" />

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Devoluções do evento</h3>
        {loadingReturns ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
                </div>
                <div className="h-6 w-16 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        ) : returns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center rounded-xl border border-dashed border-border">
            <ReceiptText className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">Nenhuma devolução registrada</p>
          </div>
        ) : (
          <div className="space-y-2">
            {returns.map((ret) => (
              <div key={ret.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
                <div className="min-w-0 flex items-center gap-2 text-sm">
                  <span className="font-semibold text-foreground">
                    {ret.order_number ? `Pedido #${ret.order_number}` : "—"}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground truncate">{ret.reason}</span>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-semibold text-destructive">-{fmt(ret.refund_amount)}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {format(new Date(ret.created_at), "dd/MM · HH:mm")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CaixaCard({ caixa, currentBalance, onClose, onView }: {
  caixa: CashRegisterRow;
  currentBalance: number;
  onClose: () => void;
  onView: () => void;
}) {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const isOpen = caixa.status === "open";

  return (
    <div className="shrink-0 w-[280px] rounded-2xl border border-border bg-card p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Banknote className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-sm font-bold text-foreground">Caixa #{caixa.register_number}</span>
        </div>
        {isOpen ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Aberto
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            Fechado
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
        <User className="h-3 w-3" />
        <span className="truncate">{caixa.operator_name}</span>
      </div>

      <div className="rounded-lg bg-primary/[0.07] border border-primary/20 p-3 mb-3">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Saldo atual</div>
        <div className="mt-0.5 text-xl font-bold text-primary">{fmt(currentBalance)}</div>
      </div>

      <div className="space-y-1.5 mb-4">
        {[
          { label: "Saldo inicial", value: caixa.opening_balance },
          { label: "Vendas", value: caixa.sales_total },
          { label: "Sangrias", value: caixa.movements_out },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="text-foreground font-medium">{fmt(row.value)}</span>
          </div>
        ))}
      </div>

      <div className="mt-auto flex items-center gap-2">
        {isOpen ? (
          <>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 gap-1.5"
              onClick={() => window.open(`/caixa?event=${caixa.event_id}`, "_blank")}
            >
              <Eye className="h-3.5 w-3.5" />
              Ver
            </Button>
            <Button
              size="sm"
              className="flex-1 h-8 gap-1.5"
              onClick={onClose}
            >
              <Lock className="h-3.5 w-3.5" />
              Fechar
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="w-full h-8 gap-1.5"
            onClick={onView}
          >
            <FileText className="h-3.5 w-3.5" />
            Detalhes
          </Button>
        )}
      </div>
    </div>
  );
}
