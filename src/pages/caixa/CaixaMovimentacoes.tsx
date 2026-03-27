import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import { CaixaEventGuard } from "@/components/CaixaEventGuard";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { ModalForm } from "@/components/ModalForm";
import { StatusBadge } from "@/components/StatusBadge";
import { ManagerApprovalDialog } from "@/components/caixa/ManagerApprovalDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, Plus, ArrowUp, ArrowDown, DollarSign, TrendingUp, TrendingDown, ShoppingCart } from "lucide-react";
import { useTranslation } from "@/i18n/use-translation";
import { useCaixa } from "@/contexts/CaixaContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTION } from "@/config/audit-actions";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type CashMovement = Tables<"cash_movements">;
type CashOrder = Tables<"cash_orders">;

type MovementType = "sangria" | "suprimento" | "pagamento" | "outro";

const TYPE_DIRECTION: Record<MovementType, string | null> = {
  sangria: "out",
  suprimento: "in",
  pagamento: "out",
  outro: null,
};

/** Unified row for the table — either a manual movement or a sale */
type UnifiedRow = {
  id: string;
  created_at: string;
  rowType: "movement" | "sale";
  movementType: string;
  direction: string;
  amount: number;
  destination: string;
  notes: string | null;
  orderNumber?: number;
  paymentMethod?: string;
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "caixa_cash",
  credit_card: "caixa_credit",
  debit_card: "caixa_debit",
  pix: "caixa_pix",
};

export default function CaixaMovimentacoes() {
  const { t } = useTranslation();
  const { cashRegisterId, eventId, clientId } = useCaixa();
  const { session } = useAuth();

  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [orders, setOrders] = useState<CashOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);

  // Form state
  const [movType, setMovType] = useState<MovementType>("sangria");
  const [direction, setDirection] = useState<string>("out");
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("");
  const [notes, setNotes] = useState("");

  const fetchData = useCallback(async () => {
    if (!cashRegisterId) return;
    setLoading(true);
    const [movRes, ordRes] = await Promise.all([
      supabase
        .from("cash_movements")
        .select("*")
        .eq("cash_register_id", cashRegisterId)
        .order("created_at", { ascending: false }),
      supabase
        .from("cash_orders")
        .select("*")
        .eq("cash_register_id", cashRegisterId)
        .eq("status", "completed")
        .order("created_at", { ascending: false }),
    ]);
    setMovements(movRes.data ?? []);
    setOrders(ordRes.data ?? []);
    setLoading(false);
  }, [cashRegisterId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-fill direction when type changes
  useEffect(() => {
    const autoDir = TYPE_DIRECTION[movType];
    if (autoDir) setDirection(autoDir);
  }, [movType]);

  const resetForm = () => {
    setMovType("sangria");
    setDirection("out");
    setAmount("");
    setDestination("");
    setNotes("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashRegisterId || !eventId || !clientId || !session?.user?.id) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    setSaving(true);
    try {
      const { data, error } = await supabase.from("cash_movements").insert({
        cash_register_id: cashRegisterId,
        event_id: eventId,
        client_id: clientId,
        operator_id: session.user.id,
        movement_type: movType,
        direction,
        amount: numAmount,
        destination,
        notes: notes || null,
      }).select("id").single();

      if (error) throw error;

      await logAudit({
        action: AUDIT_ACTION.CASH_MOVEMENT_CREATED,
        entityType: "cash_movement",
        entityId: data.id,
        metadata: { movement_type: movType, direction, amount: numAmount },
      });

      toast.success(t("mov_success"));
      setModalOpen(false);
      resetForm();
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(t("mov_error"));
    } finally {
      setSaving(false);
    }
  };

  // Build unified rows
  const unifiedRows: UnifiedRow[] = [
    ...movements.map((m): UnifiedRow => ({
      id: m.id,
      created_at: m.created_at,
      rowType: "movement",
      movementType: m.movement_type,
      direction: m.direction,
      amount: Number(m.amount),
      destination: m.destination,
      notes: m.notes,
    })),
    ...orders.map((o): UnifiedRow => ({
      id: o.id,
      created_at: o.created_at,
      rowType: "sale",
      movementType: "venda",
      direction: "in",
      amount: Number(o.total),
      destination: t((PAYMENT_LABELS[o.payment_method] || "caixa_other") as any),
      notes: null,
      orderNumber: o.order_number,
      paymentMethod: o.payment_method,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Totals
  const totalIn = movements
    .filter((m) => m.direction === "in")
    .reduce((s, m) => s + Number(m.amount), 0);
  const totalOut = movements
    .filter((m) => m.direction === "out")
    .reduce((s, m) => s + Number(m.amount), 0);
  const totalSales = orders.reduce((s, o) => s + Number(o.total), 0);
  const balance = totalIn - totalOut;

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const typeLabel = (type: string) => {
    const map: Record<string, string> = {
      sangria: t("mov_type_sangria"),
      suprimento: t("mov_type_suprimento"),
      pagamento: t("mov_type_pagamento"),
      venda: t("mov_type_venda" as any),
      outro: t("caixa_other"),
    };
    return map[type] ?? type;
  };

  const typeVariant = (type: string): "active" | "inactive" | "draft" | "completed" | "cancelled" => {
    const map: Record<string, "active" | "inactive" | "draft" | "completed" | "cancelled"> = {
      sangria: "cancelled",
      suprimento: "active",
      pagamento: "draft",
      venda: "completed",
      outro: "inactive",
    };
    return map[type] ?? "inactive";
  };

  const columns: DataTableColumn<UnifiedRow>[] = [
    {
      key: "created_at",
      header: t("mov_col_datetime"),
      render: (row) =>
        new Date(row.created_at).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }),
    },
    {
      key: "orderNumber" as any,
      header: t("mov_col_order" as any),
      render: (row) =>
        row.orderNumber != null ? (
          <span className="font-mono text-sm font-medium">#{row.orderNumber}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "movementType" as any,
      header: t("mov_col_type"),
      render: (row) => (
        <StatusBadge status={typeVariant(row.movementType)} label={typeLabel(row.movementType)} />
      ),
    },
    {
      key: "direction",
      header: t("mov_col_direction"),
      render: (row) =>
        row.direction === "in" ? (
          <span className="inline-flex items-center gap-1 text-success font-medium text-sm">
            <ArrowUp className="h-3.5 w-3.5" /> {t("mov_direction_in")}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-destructive font-medium text-sm">
            <ArrowDown className="h-3.5 w-3.5" /> {t("mov_direction_out")}
          </span>
        ),
    },
    {
      key: "amount",
      header: t("mov_col_amount"),
      render: (row) => (
        <span className={row.direction === "in" ? "text-success" : "text-destructive"}>
          {fmt(row.amount)}
        </span>
      ),
    },
    {
      key: "destination",
      header: t("mov_col_destination"),
      render: (row) => row.destination,
    },
    {
      key: "notes",
      header: t("mov_col_notes"),
      render: (row) => (
        <span className="text-muted-foreground text-xs truncate max-w-[200px] inline-block">
          {row.notes || "—"}
        </span>
      ),
    },
  ];

  return (
    <CaixaEventGuard requireRegister>
      <PageHeader
        title={t("caixa_movements")}
        icon={ArrowUpDown}
        actions={
          <Button onClick={() => setModalOpen(true)} className="glow-hover">
            <Plus className="h-4 w-4 mr-2" />
            {t("mov_new")}
          </Button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 mb-6">
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/15 p-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("mov_total_sales" as any)}</p>
              <p className="text-lg font-bold text-primary">{fmt(totalSales)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-success/15 p-2">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("mov_total_in")}</p>
              <p className="text-lg font-bold text-success">{fmt(totalIn)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-destructive/15 p-2">
              <TrendingDown className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("mov_total_out")}</p>
              <p className="text-lg font-bold text-destructive">{fmt(totalOut)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/15 p-2">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("mov_balance")}</p>
              <p className={`text-lg font-bold ${balance >= 0 ? "text-success" : "text-destructive"}`}>
                {fmt(balance)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <DataTable
        columns={columns}
        data={unifiedRows}
        keyExtractor={(row) => row.id}
        loading={loading}
        emptyMessage={t("mov_empty")}
        emptyHint={t("mov_empty_hint")}
      />

      {/* New movement modal */}
      <ModalForm
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) resetForm();
        }}
        title={t("mov_new")}
        onSubmit={handleSubmit}
        saving={saving}
        size="compact"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("mov_field_type")}</Label>
            <Select value={movType} onValueChange={(v) => setMovType(v as MovementType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sangria">{t("mov_type_sangria")}</SelectItem>
                <SelectItem value="suprimento">{t("mov_type_suprimento")}</SelectItem>
                <SelectItem value="pagamento">{t("mov_type_pagamento")}</SelectItem>
                <SelectItem value="outro">{t("caixa_other")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("mov_field_direction")}</Label>
            <Select
              value={direction}
              onValueChange={setDirection}
              disabled={movType !== "outro"}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in">{t("mov_direction_in")}</SelectItem>
                <SelectItem value="out">{t("mov_direction_out")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("mov_field_amount")}</Label>
            <Input
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              placeholder="0,00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>{t("mov_field_destination")}</Label>
            <Input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder={t("mov_field_destination_placeholder")}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>{t("caixa_observations")}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("mov_field_notes_placeholder")}
              rows={3}
            />
          </div>
        </div>
      </ModalForm>
    </CaixaEventGuard>
  );
}
