import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGestor } from "@/contexts/GestorContext";
import { useTranslation } from "@/i18n/use-translation";
import { ModalForm } from "@/components/ModalForm";
import { Banknote, Play, Check, RefreshCw, Calendar, ChevronRight } from "lucide-react";
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
  const [filterEvent, setFilterEvent] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
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

    if (filterEvent !== "all") query = query.eq("event_id", filterEvent);
    if (filterStatus !== "all") query = query.eq("status", filterStatus);

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
    const movInMap: Record<string, number> = {};
    const movOutMap: Record<string, number> = {};
    const refundMap: Record<string, number> = {};

    (ordersRes.data ?? []).forEach(o => { salesMap[o.cash_register_id] = (salesMap[o.cash_register_id] || 0) + Number(o.total); });
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
    })));
    setLoading(false);
  };

  useEffect(() => { fetchRegisters(); }, [effectiveClientId, filterEvent, filterStatus]);

  useEffect(() => {
    if (!effectiveClientId) return;
    setLoadingReturns(true);
    (async () => {
      const { data: rets } = await supabase
        .from("returns")
        .select("id, created_at, cash_order_id, items, refund_amount, reason, occurrence_type, authorized_by, operator_id")
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
      })));
      setLoadingReturns(false);
    })();
  }, [effectiveClientId]);

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
  const currentBalance = (r: CashRegisterRow) =>
    r.opening_balance + r.sales_total + r.movements_in - r.movements_out - r.refunds;

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
      const caixasComVendas = caixas.filter((c) => c.sales_total > 0).length;
      const ticketMedio = caixasComVendas > 0 ? totalVendas / caixasComVendas : 0;
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

  return (
    <div className="space-y-6">
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
          Atualiza automaticamente a cada 1 minuto
        </div>
      )}

      {/* Cards horizontais */}
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
        {currentGroups.map((group, i) => (
          <EventCard key={group.eventId} group={group} index={i} onClick={() => setSelectedGroup(group)} />
        ))}
      </div>

      {currentGroups.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Banknote className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            Nenhum evento {activeTab === "ativos" ? "ativo" : "encerrado"} com caixas
          </p>
        </div>
      )}

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
