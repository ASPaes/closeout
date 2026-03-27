import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGestor } from "@/contexts/GestorContext";
import { useTranslation } from "@/i18n/use-translation";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { ModalForm } from "@/components/ModalForm";
import { Banknote, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTION } from "@/config/audit-actions";
import type { TranslationKey } from "@/i18n/translations/pt-BR";
import type { DataTableColumn } from "@/components/DataTable";

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

export default function GestorCaixas() {
  const { t } = useTranslation();
  const { effectiveClientId } = useGestor();
  const [registers, setRegisters] = useState<CashRegisterRow[]>([]);
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingReturns, setLoadingReturns] = useState(true);
  const [filterEvent, setFilterEvent] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);
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

  useEffect(() => {
    if (!effectiveClientId) return;
    supabase
      .from("events")
      .select("id, name")
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

  const occLabels: Record<string, TranslationKey> = {
    defect: "ret_occ_defect",
    error: "ret_occ_error",
    withdrawal: "ret_occ_withdrawal",
    other: "ret_occ_other",
  };

  const registerColumns: DataTableColumn<CashRegisterRow>[] = [
    { key: "register_number", header: t("gcx_col_register_number"), render: (r) => <span className="font-mono font-semibold">#{r.register_number}</span> },
    { key: "operator_name", header: t("gcx_col_operator"), render: (r) => r.operator_name },
    { key: "event_name", header: t("gcx_col_event"), render: (r) => r.event_name },
    { key: "opened_at", header: t("gcx_col_opened_at"), render: (r) => format(new Date(r.opened_at), "dd/MM HH:mm") },
    {
      key: "status", header: t("status"), render: (r) => (
        <StatusBadge status={r.status === "open" ? "active" : "completed"} label={r.status === "open" ? t("caixa_status_open") : t("caixa_status_closed")} />
      ),
    },
    { key: "opening_balance", header: t("gcx_col_opening"), render: (r) => fmt(r.opening_balance) },
    { key: "sales_total", header: t("gcx_col_sales"), render: (r) => fmt(r.sales_total) },
    { key: "movements_out", header: t("gcx_col_withdrawals"), render: (r) => fmt(r.movements_out) },
    { key: "current", header: t("gcx_col_current"), render: (r) => <span className="font-semibold">{fmt(currentBalance(r))}</span> },
    {
      key: "actions", header: t("actions"), render: (r) => (
        <div className="flex gap-2">
          {r.status === "closed" && (
            <Button size="sm" variant="outline" onClick={() => setDetailModal(r)}>{t("details")}</Button>
          )}
          {r.status === "open" && (
            <Button size="sm" variant="destructive" onClick={() => setCloseConfirm(r)}>{t("gcx_close_register")}</Button>
          )}
        </div>
      ),
    },
  ];

  const returnColumns: DataTableColumn<ReturnRow>[] = [
    { key: "created_at", header: t("timestamp"), render: (r) => format(new Date(r.created_at), "dd/MM HH:mm") },
    { key: "order_number", header: t("ret_col_order"), render: (r) => r.order_number ? `#${r.order_number}` : "—" },
    {
      key: "items", header: t("ret_col_items"), render: (r) => {
        const items = Array.isArray(r.items) ? r.items : [];
        return items.map((i: any) => `${i.name} x${i.quantity}`).join(", ") || "—";
      },
    },
    { key: "refund_amount", header: t("ret_col_value"), render: (r) => fmt(r.refund_amount) },
    { key: "reason", header: t("ret_col_reason"), render: (r) => r.reason },
    {
      key: "occurrence_type", header: t("ret_col_occurrence"), render: (r) => {
        const key = occLabels[r.occurrence_type];
        return key ? t(key) : r.occurrence_type;
      },
    },
    { key: "authorized_by", header: t("ret_col_authorized_by"), render: (r) => r.authorized_by_name },
    { key: "operator", header: t("gcx_col_operator"), render: (r) => r.operator_name },
  ];

  const filterControls = (
    <div className="flex flex-wrap gap-3">
      <Select value={filterEvent} onValueChange={setFilterEvent}>
        <SelectTrigger className="w-48"><SelectValue placeholder={t("gcx_all_events")} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("gcx_all_events")}</SelectItem>
          {events.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filterStatus} onValueChange={setFilterStatus}>
        <SelectTrigger className="w-40"><SelectValue placeholder={t("gcx_all_status")} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("gcx_all_status")}</SelectItem>
          <SelectItem value="open">{t("caixa_status_open")}</SelectItem>
          <SelectItem value="closed">{t("caixa_status_closed")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("gcx_title")} subtitle={t("gcx_description")} icon={Banknote} actions={
        <Button onClick={() => setOpenModal(true)}>
          <LockOpen className="h-4 w-4 mr-2" />
          {t("gcx_open_new")}
        </Button>
      } />

      <Tabs defaultValue="registers">
        <TabsList>
          <TabsTrigger value="registers">{t("gcx_tab_registers")}</TabsTrigger>
          <TabsTrigger value="returns">{t("gcx_tab_returns")}</TabsTrigger>
        </TabsList>

        <TabsContent value="registers" className="space-y-4">
          {filterControls}
          <DataTable
            columns={registerColumns}
            data={registers}
            keyExtractor={(r) => r.id}
            loading={loading}
            emptyMessage={t("gcx_empty")}
          />
        </TabsContent>

        <TabsContent value="returns" className="space-y-4">
          <DataTable
            columns={returnColumns}
            data={returns}
            keyExtractor={(r) => r.id}
            loading={loadingReturns}
            emptyMessage={t("gcx_returns_empty")}
          />
        </TabsContent>
      </Tabs>

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
    </div>
  );
}
