import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGestor } from "@/contexts/GestorContext";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { ModalForm } from "@/components/ModalForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Package, Plus, Settings2 } from "lucide-react";

type StockRow = {
  id: string;
  product_id: string;
  product_name: string;
  quantity_available: number;
  low_stock_threshold: number;
  is_enabled: boolean;
};

export default function GestorEstoque() {
  const { t } = useTranslation();
  const { clientId } = useGestor();
  const { user } = useAuth();

  const [rows, setRows] = useState<StockRow[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Adjust modal
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [adjustProductId, setAdjustProductId] = useState("");
  const [adjustType, setAdjustType] = useState<"add" | "remove" | "adjust">("add");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  // Threshold modal
  const [thresholdOpen, setThresholdOpen] = useState(false);
  const [thresholdSaving, setThresholdSaving] = useState(false);
  const [thresholdRow, setThresholdRow] = useState<StockRow | null>(null);
  const [thresholdValue, setThresholdValue] = useState("");

  const fetchData = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);

    const [balancesRes, productsRes] = await Promise.all([
      supabase
        .from("stock_balances")
        .select("id, product_id, quantity_available, low_stock_threshold, is_enabled")
        .eq("client_id", clientId),
      supabase
        .from("products")
        .select("id, name")
        .eq("client_id", clientId)
        .eq("is_active", true)
        .order("name"),
    ]);

    const prods = productsRes.data ?? [];
    setProducts(prods);

    const balances = balancesRes.data ?? [];
    const balanceMap = new Map(balances.map((b) => [b.product_id, b]));

    // Merge: show all products, fill missing balances with defaults
    const merged: StockRow[] = prods.map((p) => {
      const b = balanceMap.get(p.id);
      return {
        id: b?.id ?? "",
        product_id: p.id,
        product_name: p.name,
        quantity_available: b?.quantity_available ?? 0,
        low_stock_threshold: b?.low_stock_threshold ?? 0,
        is_enabled: b?.is_enabled ?? true,
      };
    });

    setRows(merged);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filter by search
  const filtered = rows.filter((r) =>
    r.product_name.toLowerCase().includes(search.toLowerCase())
  );

  // ---- Adjust stock ----
  const openAdjust = (productId?: string) => {
    setAdjustProductId(productId ?? "");
    setAdjustType("add");
    setAdjustQty("");
    setAdjustReason("");
    setAdjustOpen(true);
  };

  const handleAdjustSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustProductId) { toast.error(t("stock_select_product")); return; }
    const qty = parseInt(adjustQty, 10);
    if (isNaN(qty) || qty < 0) { toast.error(t("stock_invalid_qty")); return; }
    if (adjustType !== "adjust" && qty === 0) { toast.error(t("stock_invalid_qty")); return; }

    setAdjustSaving(true);

    // Ensure stock_balances row exists
    await supabase.from("stock_balances").upsert(
      { client_id: clientId!, product_id: adjustProductId, quantity_available: 0 },
      { onConflict: "client_id,product_id", ignoreDuplicates: true }
    );

    const { error } = await supabase.from("stock_entries").insert({
      client_id: clientId!,
      product_id: adjustProductId,
      entry_type: adjustType,
      quantity: qty,
      reason: adjustReason || null,
      created_by: user!.id,
    });

    setAdjustSaving(false);

    if (error) {
      toast.error(error.message.includes("Cannot remove")
        ? t("stock_insufficient")
        : t("stock_adjust_error"));
      return;
    }

    toast.success(t("stock_adjusted_ok"));
    setAdjustOpen(false);
    fetchData();
  };

  // ---- Threshold ----
  const openThreshold = (row: StockRow) => {
    setThresholdRow(row);
    setThresholdValue(String(row.low_stock_threshold));
    setThresholdOpen(true);
  };

  const handleThresholdSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thresholdRow) return;
    const val = parseInt(thresholdValue, 10);
    if (isNaN(val) || val < 0) { toast.error(t("stock_invalid_threshold")); return; }

    setThresholdSaving(true);

    // Upsert balance row
    const { error } = await supabase.from("stock_balances").upsert(
      {
        client_id: clientId!,
        product_id: thresholdRow.product_id,
        low_stock_threshold: val,
        quantity_available: thresholdRow.quantity_available,
      },
      { onConflict: "client_id,product_id" }
    );

    setThresholdSaving(false);
    if (error) { toast.error(t("stock_threshold_error")); return; }

    toast.success(t("stock_threshold_ok"));
    setThresholdOpen(false);
    fetchData();
  };

  // ---- Toggle enabled ----
  const toggleEnabled = async (row: StockRow) => {
    // Upsert to ensure row exists
    const { error } = await supabase.from("stock_balances").upsert(
      {
        client_id: clientId!,
        product_id: row.product_id,
        is_enabled: !row.is_enabled,
        quantity_available: row.quantity_available,
        low_stock_threshold: row.low_stock_threshold,
      },
      { onConflict: "client_id,product_id" }
    );

    if (error) { toast.error(t("stock_toggle_error")); return; }
    toast.success(row.is_enabled ? t("stock_disabled") : t("stock_enabled"));
    fetchData();
  };

  // ---- Columns ----
  const columns: DataTableColumn<StockRow>[] = [
    {
      key: "product",
      header: t("product"),
      render: (r) => <span className="font-medium">{r.product_name}</span>,
    },
    {
      key: "qty",
      header: t("stock_qty"),
      className: "text-center w-28",
      render: (r) => <span className="font-mono">{r.quantity_available}</span>,
    },
    {
      key: "threshold",
      header: t("stock_threshold"),
      className: "text-center w-28",
      render: (r) => <span className="font-mono">{r.low_stock_threshold}</span>,
    },
    {
      key: "status",
      header: "Status",
      className: "w-28",
      render: (r) => {
        if (!r.is_enabled) return <StatusBadge status="inactive" label={t("stock_control_off")} />;
        const isLow = r.low_stock_threshold > 0 && r.quantity_available <= r.low_stock_threshold;
        return isLow
          ? <StatusBadge status="cancelled" label={t("stock_low")} />
          : <StatusBadge status="active" label="OK" />;
      },
    },
    {
      key: "enabled",
      header: t("stock_control_label"),
      className: "w-28 text-center",
      render: (r) => (
        <Switch
          checked={r.is_enabled}
          onCheckedChange={() => toggleEnabled(r)}
          aria-label={t("stock_toggle_label")}
        />
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-32 text-right",
      render: (r) => (
        <div className="flex gap-1 justify-end">
          <Button size="sm" variant="ghost" onClick={() => openAdjust(r.product_id)} title={t("stock_adjust")}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openThreshold(r)} title={t("stock_config_threshold")}>
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("gestor_stock")}
        subtitle={t("gestor_stock_desc")}
        icon={Package}
        actions={
          <Button onClick={() => openAdjust()} className="glow-hover">
            <Plus className="mr-2 h-4 w-4" />
            {t("stock_adjust")}
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={filtered}
        keyExtractor={(r) => r.product_id}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t("stock_search")}
        emptyMessage={t("stock_empty")}
        emptyHint={t("stock_empty_hint")}
      />

      {/* Adjust Modal */}
      <ModalForm
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        title={t("stock_adjust")}
        onSubmit={handleAdjustSave}
        saving={adjustSaving}
        submitLabel={t("confirm")}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("product")}</Label>
            <Select value={adjustProductId} onValueChange={setAdjustProductId}>
              <SelectTrigger><SelectValue placeholder={t("stock_select_product")} /></SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("stock_entry_type")}</Label>
            <Select value={adjustType} onValueChange={(v) => setAdjustType(v as "add" | "remove" | "adjust")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="add">{t("stock_type_add")}</SelectItem>
                <SelectItem value="remove">{t("stock_type_remove")}</SelectItem>
                <SelectItem value="adjust">{t("stock_type_adjust")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("stock_qty")}</Label>
            <Input
              type="number"
              min={0}
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label>{t("stock_reason")}</Label>
            <Textarea
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder={t("stock_reason_placeholder")}
              rows={2}
            />
          </div>
        </div>
      </ModalForm>

      {/* Threshold Modal */}
      <ModalForm
        open={thresholdOpen}
        onOpenChange={setThresholdOpen}
        title={t("stock_config_threshold")}
        onSubmit={handleThresholdSave}
        saving={thresholdSaving}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("stock_threshold_desc")}: <strong>{thresholdRow?.product_name}</strong>
          </p>
          <div className="space-y-2">
            <Label>{t("stock_threshold")}</Label>
            <Input
              type="number"
              min={0}
              value={thresholdValue}
              onChange={(e) => setThresholdValue(e.target.value)}
            />
          </div>
        </div>
      </ModalForm>
    </div>
  );
}
