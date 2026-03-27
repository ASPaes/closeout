import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { CaixaEventGuard } from "@/components/CaixaEventGuard";
import { useTranslation } from "@/i18n/use-translation";
import { useCaixa } from "@/contexts/CaixaContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTION } from "@/config/audit-actions";
import { toast } from "sonner";
import { RotateCcw, Search, Plus, Check, ShoppingBag } from "lucide-react";
import { OrderPickerDialog } from "@/components/caixa/OrderPickerDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { ModalForm } from "@/components/ModalForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import type { Json } from "@/integrations/supabase/types";

type ReturnRow = {
  id: string;
  created_at: string;
  cash_order_id: string;
  items: Json;
  refund_amount: number;
  reason: string;
  occurrence_type: string;
  authorized_by: string;
  order_number?: number;
  authorizer_name?: string;
};

type OrderItem = {
  name: string;
  price: number;
  quantity: number;
  type: string;
  id: string;
};

type SelectedItem = OrderItem & { returnQty: number; selected: boolean };

type CashOrder = {
  id: string;
  order_number: number;
  created_at: string;
  items: Json;
  total: number;
  payment_method: string;
  status: string;
};

const OCCURRENCE_TYPES = [
  { value: "product_defect", labelKey: "ret_occ_defect" },
  { value: "order_error", labelKey: "ret_occ_error" },
  { value: "customer_withdrawal", labelKey: "ret_occ_withdrawal" },
  { value: "other", labelKey: "ret_occ_other" },
] as const;

export default function CaixaDevolucoes() {
  const { t } = useTranslation();
  const { eventId, clientId, cashRegisterId } = useCaixa();
  const { user } = useAuth();

  // List state
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [pickerOpen, setPickerOpen] = useState(false);
  const [foundOrder, setFoundOrder] = useState<CashOrder | null>(null);
  const [orderItems, setOrderItems] = useState<SelectedItem[]>([]);

  // Step 2
  const [reason, setReason] = useState("");
  const [occurrenceType, setOccurrenceType] = useState("");

  // Step 3 (auth dialog)
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authorizing, setAuthorizing] = useState(false);

  // Fetch returns list
  const fetchReturns = async () => {
    if (!eventId) return;
    setLoadingList(true);
    const { data } = await supabase
      .from("returns")
      .select("id, created_at, cash_order_id, items, refund_amount, reason, occurrence_type, authorized_by")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (!data) {
      setReturns([]);
      setLoadingList(false);
      return;
    }

    // Resolve order numbers and authorizer names
    const orderIds = [...new Set(data.map((r) => r.cash_order_id))];
    const authorizerIds = [...new Set(data.map((r) => r.authorized_by))];

    const [ordersRes, profilesRes] = await Promise.all([
      orderIds.length > 0
        ? supabase.from("cash_orders").select("id, order_number").in("id", orderIds)
        : Promise.resolve({ data: [] }),
      authorizerIds.length > 0
        ? supabase.from("profiles").select("id, name").in("id", authorizerIds)
        : Promise.resolve({ data: [] }),
    ]);

    const orderMap = new Map((ordersRes.data ?? []).map((o) => [o.id, o.order_number]));
    const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p.name]));

    setReturns(
      data.map((r) => ({
        ...r,
        order_number: orderMap.get(r.cash_order_id),
        authorizer_name: profileMap.get(r.authorized_by) ?? r.authorized_by,
      }))
    );
    setLoadingList(false);
  };

  useEffect(() => {
    fetchReturns();
  }, [eventId]);

  // Handle order selection from picker
  const handleOrderSelected = (order: CashOrder) => {
    setFoundOrder(order);
    const items = (Array.isArray(order.items) ? order.items : []) as OrderItem[];
    setOrderItems(items.map((i) => ({ ...i, returnQty: i.quantity, selected: false })));
  };

  // Refund amount
  const refundAmount = useMemo(
    () =>
      orderItems
        .filter((i) => i.selected)
        .reduce((sum, i) => sum + i.price * i.returnQty, 0),
    [orderItems]
  );

  const hasSelectedItems = orderItems.some((i) => i.selected && i.returnQty > 0);

  // Reset modal
  const resetModal = () => {
    setStep(1);
    setOrderSearch("");
    setFoundOrder(null);
    setOrderItems([]);
    setOrderNotFound(false);
    setReason("");
    setOccurrenceType("");
    setAuthEmail("");
    setAuthPassword("");
    setAuthError("");
  };

  // Format items for display
  const formatReturnItems = (items: Json) => {
    if (!Array.isArray(items)) return "-";
    return (items as OrderItem[]).map((i) => `${i.quantity}x ${i.name}`).join(", ");
  };

  // Occurrence type label
  const occLabel = (value: string) => {
    const found = OCCURRENCE_TYPES.find((o) => o.value === value);
    return found ? t(found.labelKey as any) : value;
  };

  // Columns
  const columns: DataTableColumn<ReturnRow>[] = [
    {
      key: "created_at",
      header: t("mov_col_datetime"),
      render: (r) => format(new Date(r.created_at), "dd/MM/yyyy HH:mm"),
    },
    {
      key: "order_number",
      header: t("ret_col_order"),
      render: (r) => (r.order_number ? `#${r.order_number}` : "-"),
    },
    {
      key: "items",
      header: t("ret_col_items"),
      render: (r) => (
        <span className="text-xs max-w-[200px] truncate block">{formatReturnItems(r.items)}</span>
      ),
    },
    {
      key: "refund_amount",
      header: t("mov_col_amount"),
      render: (r) =>
        r.refund_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    },
    {
      key: "reason",
      header: t("ret_col_reason"),
      render: (r) => <span className="text-xs max-w-[150px] truncate block">{r.reason}</span>,
    },
    {
      key: "occurrence_type",
      header: t("ret_col_occurrence"),
      render: (r) => occLabel(r.occurrence_type),
    },
    {
      key: "authorized_by",
      header: t("ret_col_authorized_by"),
      render: (r) => r.authorizer_name ?? "-",
    },
  ];

  // Step 3: authorize and save
  const handleAuthorize = async () => {
    if (!authEmail || !authPassword) return;
    setAuthorizing(true);
    setAuthError("");

    try {
      // Create a separate client to avoid swapping session
      const { createClient } = await import("@supabase/supabase-js");
      const tempClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );

      const { data: authData, error: authErr } = await tempClient.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });

      if (authErr || !authData.user) {
        setAuthError(t("ret_auth_invalid_credentials"));
        setAuthorizing(false);
        return;
      }

      const authUserId = authData.user.id;

      // Check the authorizer is not the current operator
      if (authUserId === user?.id) {
        setAuthError(t("ret_auth_self_not_allowed"));
        setAuthorizing(false);
        return;
      }

      // Check authorizer has manager/admin role
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authUserId);

      const allowedRoles = ["super_admin", "client_admin", "client_manager"];
      const hasPermission = (roles ?? []).some((r) => allowedRoles.includes(r.role));

      if (!hasPermission) {
        setAuthError(t("ret_auth_not_authorized"));
        setAuthorizing(false);
        return;
      }

      // Save return
      await saveReturn(authUserId);
    } catch {
      setAuthError(t("ret_auth_error"));
    } finally {
      setAuthorizing(false);
    }
  };

  const saveReturn = async (authorizedBy: string) => {
    if (!foundOrder || !cashRegisterId || !eventId || !clientId || !user) return;
    setSaving(true);

    const returnItems = orderItems
      .filter((i) => i.selected && i.returnQty > 0)
      .map((i) => ({ name: i.name, price: i.price, quantity: i.returnQty, type: i.type, id: i.id }));

    const { error } = await supabase.from("returns").insert({
      cash_order_id: foundOrder.id,
      cash_register_id: cashRegisterId,
      event_id: eventId,
      client_id: clientId,
      operator_id: user.id,
      authorized_by: authorizedBy,
      items: returnItems as unknown as Json,
      refund_amount: refundAmount,
      reason,
      occurrence_type: occurrenceType,
    });

    if (error) {
      toast.error(t("ret_save_error"));
      setSaving(false);
      return;
    }

    // Revert stock for returned items (entry_type = 'add' to restore)
    for (const item of returnItems) {
      if (item.type === "product" && item.id) {
        await supabase.from("stock_entries").insert({
          client_id: clientId,
          product_id: item.id,
          entry_type: "add",
          quantity: item.quantity,
          reason: `Devolução pedido #${foundOrder.order_number}`,
          created_by: user.id,
        });
      }
    }

    await logAudit({
      action: AUDIT_ACTION.CASH_RETURN_CREATED,
      entityType: "return",
      entityId: foundOrder.id,
      oldData: { order_id: foundOrder.id, order_number: foundOrder.order_number },
      newData: { items: returnItems, refund_amount: refundAmount, authorized_by: authorizedBy },
    });

    toast.success(t("ret_save_success"));
    setSaving(false);
    setModalOpen(false);
    resetModal();
    fetchReturns();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1 && hasSelectedItems) {
      setStep(2);
    } else if (step === 2 && reason && occurrenceType) {
      setStep(3);
    }
  };

  // Step content
  const renderStep1 = () => (
    <>
      <div className="flex gap-2">
        <Input
          placeholder={t("ret_search_order")}
          value={orderSearch}
          onChange={(e) => setOrderSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSearchOrder())}
          type="number"
        />
        <Button type="button" variant="outline" onClick={handleSearchOrder} disabled={searchingOrder}>
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {orderNotFound && (
        <p className="text-sm text-destructive">{t("ret_order_not_found")}</p>
      )}

      {foundOrder && (
        <Card className="border-border/60 bg-secondary/30">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium">
              {t("ret_order_label")} #{foundOrder.order_number} —{" "}
              {format(new Date(foundOrder.created_at), "dd/MM/yyyy HH:mm")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              {t("pos_total")}:{" "}
              {foundOrder.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
            <div className="space-y-2">
              <Label className="text-xs font-medium">{t("ret_select_items")}</Label>
              {orderItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 py-1">
                  <Checkbox
                    checked={item.selected}
                    onCheckedChange={(checked) => {
                      const copy = [...orderItems];
                      copy[idx] = { ...copy[idx], selected: !!checked };
                      setOrderItems(copy);
                    }}
                  />
                  <span className="text-sm flex-1">{item.name}</span>
                  <Input
                    type="number"
                    min={1}
                    max={item.quantity}
                    value={item.returnQty}
                    onChange={(e) => {
                      const copy = [...orderItems];
                      copy[idx] = { ...copy[idx], returnQty: Math.min(Math.max(1, Number(e.target.value)), item.quantity) };
                      setOrderItems(copy);
                    }}
                    className="w-16 h-8 text-center"
                    disabled={!item.selected}
                  />
                  <span className="text-xs text-muted-foreground w-20 text-right">
                    {(item.price * (item.selected ? item.returnQty : 0)).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </span>
                </div>
              ))}
            </div>
            {hasSelectedItems && (
              <div className="flex justify-end pt-2 border-t border-border/40">
                <span className="text-sm font-semibold">
                  {t("ret_refund_total")}:{" "}
                  {refundAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );

  const renderStep2 = () => (
    <>
      <div className="space-y-2">
        <Label>{t("ret_occurrence_type")}</Label>
        <Select value={occurrenceType} onValueChange={setOccurrenceType}>
          <SelectTrigger>
            <SelectValue placeholder={t("ret_select_occurrence")} />
          </SelectTrigger>
          <SelectContent>
            {OCCURRENCE_TYPES.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {t(o.labelKey as any)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>{t("ret_reason")}</Label>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("ret_reason_placeholder")}
          rows={3}
        />
      </div>
    </>
  );

  const stepTitle =
    step === 1
      ? t("ret_step1_title")
      : step === 2
        ? t("ret_step2_title")
        : t("ret_step3_title");

  const canProceed =
    step === 1 ? hasSelectedItems : step === 2 ? !!(reason && occurrenceType) : false;

  return (
    <CaixaEventGuard requireRegister>
      <PageHeader
        title={t("caixa_returns")}
        icon={RotateCcw}
        actions={
          <Button onClick={() => { resetModal(); setModalOpen(true); }} className="glow-hover">
            <Plus className="mr-2 h-4 w-4" />
            {t("ret_new")}
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={returns}
        keyExtractor={(r) => r.id}
        loading={loadingList}
        emptyMessage={t("ret_empty")}
        emptyHint={t("ret_empty_hint")}
      />

      {/* New Return Modal (steps 1 & 2) */}
      <ModalForm
        open={modalOpen && step < 3}
        onOpenChange={(open) => {
          if (!open) { setModalOpen(false); resetModal(); }
        }}
        title={stepTitle}
        onSubmit={handleSubmit}
        saving={false}
        submitLabel={step === 1 ? t("ret_next") : t("ret_authorize")}
        disabled={!canProceed}
      >
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
      </ModalForm>

      {/* Step 3: Manager Auth Dialog */}
      <Dialog
        open={modalOpen && step === 3}
        onOpenChange={(open) => {
          if (!open) { setStep(2); }
        }}
      >
        <DialogContent className="max-w-md bg-card/95 backdrop-blur-sm border-border/60">
          <DialogHeader>
            <DialogTitle>{t("ret_step3_title")}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAuthorize();
            }}
            className="space-y-4"
          >
            <p className="text-sm text-muted-foreground">{t("ret_auth_description")}</p>
            <div className="space-y-2">
              <Label>{t("email")}</Label>
              <Input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("password")}</Label>
              <Input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                autoComplete="off"
              />
            </div>
            {authError && <p className="text-sm text-destructive">{authError}</p>}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setStep(2)}
                disabled={authorizing || saving}
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                className="flex-1 glow-hover"
                disabled={!authEmail || !authPassword || authorizing || saving}
              >
                {authorizing ? (
                  <span className="animate-pulse">{t("ret_authorizing")}</span>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    {t("ret_confirm")}
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </CaixaEventGuard>
  );
}
