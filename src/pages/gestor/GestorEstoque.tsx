import { useState, useEffect, useCallback } from "react";
import { GestorClientGuard } from "@/components/GestorClientGuard";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Package, Plus, Settings2, History, Pencil, Trash2, AlertTriangle } from "lucide-react";

type ProductInfo = {
  id: string;
  name: string;
  is_stock_tracked: boolean;
  stock_unit: string | null;
  base_unit: string | null;
  base_per_stock_unit: number | null;
};

type StockRow = {
  id: string;
  product_id: string;
  product_name: string;
  quantity_available: number;
  low_stock_threshold: number;
  is_enabled: boolean;
  allow_negative: boolean;
  stock_unit: string | null;
  base_unit: string | null;
  base_per_stock_unit: number | null;
};

type HistoryEntry = {
  id: string;
  created_at: string;
  product_id: string;
  product_name: string;
  entry_type: string;
  quantity: number;
  reason: string | null;
  created_by_name: string;
};

const STOCK_UNIT_LABELS: Record<string, string> = {
  bottle: "prod_unit_bottle",
  kg: "prod_unit_kg",
  unit: "prod_unit_unit",
  pack: "prod_unit_pack",
};

export default function GestorEstoque() {
  const { t } = useTranslation();
  const { effectiveClientId: clientId } = useGestor();
  const { user } = useAuth();

  const [rows, setRows] = useState<StockRow[]>([]);
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Adjust modal
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [adjustProductId, setAdjustProductId] = useState("");
  const [adjustType, setAdjustType] = useState<"add" | "remove" | "adjust">("add");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustError, setAdjustError] = useState("");

  // Threshold modal
  const [thresholdOpen, setThresholdOpen] = useState(false);
  const [thresholdSaving, setThresholdSaving] = useState(false);
  const [thresholdRow, setThresholdRow] = useState<StockRow | null>(null);
  const [thresholdValue, setThresholdValue] = useState("");

  // Edit entry modal
  const [editEntryOpen, setEditEntryOpen] = useState(false);
  const [editEntrySaving, setEditEntrySaving] = useState(false);
  const [editEntry, setEditEntry] = useState<HistoryEntry | null>(null);
  const [editEntryQty, setEditEntryQty] = useState("");
  const [editEntryReason, setEditEntryReason] = useState("");

  // Delete entry confirmation
  const [deleteEntryOpen, setDeleteEntryOpen] = useState(false);
  const [deleteEntryTarget, setDeleteEntryTarget] = useState<HistoryEntry | null>(null);
  const [deleteEntryLoading, setDeleteEntryLoading] = useState(false);

  // ---- Helpers ----
  const fmtQty = (v: number) => {
    if (Number.isInteger(v)) return String(v);
    return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  };

  const stockUnitLabel = (unit: string | null) => {
    if (!unit) return "";
    const key = STOCK_UNIT_LABELS[unit];
    return key ? t(key as any) : unit;
  };

  // ---- Fetch ----
  const fetchData = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);

    const [balancesRes, productsRes, historyRes] = await Promise.all([
      supabase
        .from("stock_balances")
        .select("id, product_id, quantity_available, low_stock_threshold, is_enabled, allow_negative")
        .eq("client_id", clientId),
      supabase
        .from("products")
        .select("id, name, is_stock_tracked, stock_unit, base_unit, base_per_stock_unit")
        .eq("client_id", clientId)
        .eq("is_active", true)
        .eq("is_stock_tracked", true)
        .order("name"),
      supabase
        .from("stock_entries")
        .select("id, created_at, product_id, entry_type, quantity, reason, created_by")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const prods = (productsRes.data ?? []) as ProductInfo[];
    setProducts(prods);
    const prodMap = new Map(prods.map((p) => [p.id, p]));

    const balances = balancesRes.data ?? [];
    const balanceMap = new Map(balances.map((b) => [b.product_id, b]));

    const merged: StockRow[] = prods.map((p) => {
      const b = balanceMap.get(p.id);
      return {
        id: b?.id ?? "",
        product_id: p.id,
        product_name: p.name,
        quantity_available: b?.quantity_available ?? 0,
        low_stock_threshold: b?.low_stock_threshold ?? 0,
        is_enabled: b?.is_enabled ?? true,
        allow_negative: b?.allow_negative ?? false,
        stock_unit: p.stock_unit,
        base_unit: p.base_unit,
        base_per_stock_unit: p.base_per_stock_unit,
      };
    });
    setRows(merged);

    // Resolve profile names for history
    const entries = historyRes.data ?? [];
    const userIds = [...new Set(entries.map((e) => e.created_by))];
    let nameMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", userIds);
      nameMap = new Map((profiles ?? []).map((p) => [p.id, p.name]));
    }

    setHistory(
      entries.map((e) => ({
        id: e.id,
        created_at: e.created_at,
        product_id: e.product_id,
        product_name: prodMap.get(e.product_id)?.name ?? "—",
        entry_type: e.entry_type,
        quantity: e.quantity,
        reason: e.reason,
        created_by_name: nameMap.get(e.created_by) ?? "—",
      }))
    );

    setLoading(false);
  }, [clientId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = rows.filter((r) =>
    r.product_name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedProductRow = adjustProductId ? rows.find((r) => r.product_id === adjustProductId) : null;

  // ---- Adjust stock ----
  const openAdjust = (productId?: string) => {
    setAdjustProductId(productId ?? "");
    setAdjustType("add");
    setAdjustQty("");
    setAdjustReason("");
    setAdjustError("");
    setAdjustOpen(true);
  };

  const handleAdjustSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustError("");
    if (!adjustProductId) { toast.error(t("stock_select_product")); return; }
    const qty = parseFloat(adjustQty);

    if (adjustType === "adjust") {
      if (isNaN(qty) || qty < 0) { toast.error(t("stock_invalid_qty")); return; }
    } else {
      if (isNaN(qty) || qty <= 0) { toast.error(t("stock_invalid_qty")); return; }
    }

    if (adjustType === "remove") {
      const currentRow = rows.find((r) => r.product_id === adjustProductId);
      if (currentRow && !currentRow.allow_negative && qty > currentRow.quantity_available) {
        const errorMsg = `${t("stock_insufficient")}. ${t("stock_available")}: ${fmtQty(currentRow.quantity_available)} — ${t("stock_requested")}: ${fmtQty(qty)}`;
        setAdjustError(errorMsg);
        return;
      }
    }

    setAdjustSaving(true);

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
      if (error.message.includes("negativ") || error.message.includes("Disponível")) {
        toast.error(t("stock_negative_not_allowed"), { duration: 6000 });
      } else {
        toast.error(t("stock_adjust_error"));
      }
      return;
    }

    toast.success(t("stock_adjusted_ok"));
    setAdjustOpen(false);
    await fetchData();

    const { data: freshBalance } = await supabase
      .from("stock_balances")
      .select("quantity_available, low_stock_threshold, is_enabled")
      .eq("client_id", clientId!)
      .eq("product_id", adjustProductId)
      .single();
    if (freshBalance && freshBalance.is_enabled && freshBalance.low_stock_threshold > 0 && freshBalance.quantity_available <= freshBalance.low_stock_threshold) {
      const prodName = products.find((p) => p.id === adjustProductId)?.name ?? "";
      toast.warning(t("stock_low_warning"), {
        description: `${prodName}: ${fmtQty(freshBalance.quantity_available)} ${t("stock_units_remaining")}`,
        duration: 8000,
      });
    }
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
    const val = parseFloat(thresholdValue);
    if (isNaN(val) || val < 0) { toast.error(t("stock_invalid_threshold")); return; }

    setThresholdSaving(true);
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
    const { error } = await supabase.from("stock_balances").upsert(
      {
        client_id: clientId!,
        product_id: row.product_id,
        is_enabled: !row.is_enabled,
        quantity_available: row.quantity_available,
        low_stock_threshold: row.low_stock_threshold,
        allow_negative: row.allow_negative,
      },
      { onConflict: "client_id,product_id" }
    );
    if (error) { toast.error(t("stock_toggle_error")); return; }
    toast.success(row.is_enabled ? t("stock_disabled") : t("stock_enabled"));
    fetchData();
  };

  // ---- Toggle allow_negative ----
  const toggleAllowNegative = async (row: StockRow) => {
    const { error } = await supabase.from("stock_balances").upsert(
      {
        client_id: clientId!,
        product_id: row.product_id,
        allow_negative: !row.allow_negative,
        quantity_available: row.quantity_available,
        low_stock_threshold: row.low_stock_threshold,
        is_enabled: row.is_enabled,
      },
      { onConflict: "client_id,product_id" }
    );
    if (error) { toast.error(t("stock_toggle_error")); return; }
    toast.success(row.allow_negative ? t("stock_allow_negative_off") : t("stock_allow_negative_on"));
    fetchData();
  };

  // ---- Edit entry ----
  const openEditEntry = (entry: HistoryEntry) => {
    setEditEntry(entry);
    setEditEntryQty(String(entry.quantity));
    setEditEntryReason(entry.reason ?? "");
    setEditEntryOpen(true);
  };

  const handleEditEntrySave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEntry) return;
    const qty = parseFloat(editEntryQty);
    if (isNaN(qty) || qty < 0) { toast.error(t("stock_invalid_qty")); return; }

    setEditEntrySaving(true);
    const { error } = await supabase.rpc("update_stock_entry", {
      p_entry_id: editEntry.id,
      p_new_quantity: qty,
      p_new_reason: editEntryReason || null,
    });
    setEditEntrySaving(false);

    if (error) {
      if (error.message.includes("negativ") || error.message.includes("Disponível") || error.message.includes("ajustes")) {
        toast.error(error.message, { duration: 6000 });
      } else {
        toast.error(t("stock_entry_edit_error"));
      }
      return;
    }

    toast.success(t("stock_entry_edited_ok"));
    setEditEntryOpen(false);
    fetchData();
  };

  // ---- Delete entry ----
  const openDeleteEntry = (entry: HistoryEntry) => {
    setDeleteEntryTarget(entry);
    setDeleteEntryOpen(true);
  };

  const handleDeleteEntry = async () => {
    if (!deleteEntryTarget) return;
    setDeleteEntryLoading(true);

    const { error } = await supabase.rpc("delete_stock_entry", {
      p_entry_id: deleteEntryTarget.id,
    });
    setDeleteEntryLoading(false);

    if (error) {
      if (error.message.includes("negativ") || error.message.includes("Disponível") || error.message.includes("ajustes")) {
        toast.error(error.message, { duration: 6000 });
      } else {
        toast.error(t("stock_entry_delete_error"));
      }
      return;
    }

    toast.success(t("stock_entry_deleted_ok"));
    setDeleteEntryOpen(false);
    setDeleteEntryTarget(null);
    fetchData();
  };

  // ---- Render helpers ----
  const renderStatus = (r: StockRow) => {
    if (!r.is_enabled) return <StatusBadge status="inactive" label={t("stock_control_off")} />;
    if (r.quantity_available < 0) return <StatusBadge status="cancelled" label={t("stock_negative")} />;
    if (r.low_stock_threshold > 0 && r.quantity_available <= r.low_stock_threshold)
      return <StatusBadge status="draft" label={t("stock_low")} />;
    return <StatusBadge status="active" label="OK" />;
  };

  const renderQty = (r: StockRow) => {
    const negClass = r.quantity_available < 0 ? "text-destructive font-bold" : "";
    const stockLabel = r.stock_unit ? stockUnitLabel(r.stock_unit) : "";
    const baseEquiv = r.base_per_stock_unit && r.base_unit
      ? fmtQty(r.quantity_available * r.base_per_stock_unit) + " " + r.base_unit
      : null;

    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className={`font-mono text-sm ${negClass}`}>
          {fmtQty(r.quantity_available)} {stockLabel}
        </span>
        {baseEquiv && (
          <span className="text-xs text-muted-foreground font-mono">
            ≈ {baseEquiv}
          </span>
        )}
      </div>
    );
  };

  const entryTypeLabel = (type: string) => {
    if (type === "add") return t("stock_type_add");
    if (type === "remove") return t("stock_type_remove");
    return t("stock_type_adjust");
  };

  const entryTypeBadgeVariant = (type: string): "default" | "secondary" | "destructive" | "outline" => {
    if (type === "add") return "default";
    if (type === "remove") return "destructive";
    return "secondary";
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
      className: "text-center w-40",
      render: renderQty,
    },
    {
      key: "threshold",
      header: t("stock_threshold"),
      className: "text-center w-28",
      render: (r) => <span className="font-mono">{fmtQty(r.low_stock_threshold)}</span>,
    },
    {
      key: "status",
      header: "Status",
      className: "w-28",
      render: renderStatus,
    },
    {
      key: "enabled",
      header: t("stock_control_label"),
      className: "w-24 text-center",
      render: (r) => (
        <Switch
          checked={r.is_enabled}
          onCheckedChange={() => toggleEnabled(r)}
          aria-label={t("stock_toggle_label")}
        />
      ),
    },
    {
      key: "allow_neg",
      header: t("stock_allow_negative_label"),
      className: "w-24 text-center",
      render: (r) => (
        <Switch
          checked={r.allow_negative}
          onCheckedChange={() => toggleAllowNegative(r)}
          aria-label={t("stock_allow_negative")}
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
    <GestorClientGuard>
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

      {/* History section */}
      <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5 text-primary" />
            {t("stock_history")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t("stock_history_empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead>{t("stock_history_date")}</TableHead>
                  <TableHead>{t("stock_history_product")}</TableHead>
                  <TableHead>{t("stock_history_type")}</TableHead>
                  <TableHead className="text-center">{t("stock_history_qty")}</TableHead>
                  <TableHead>{t("stock_history_reason")}</TableHead>
                  <TableHead>{t("stock_history_by")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id} className="border-border/30">
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(h.created_at).toLocaleString("pt-BR", {
                        day: "2-digit", month: "2-digit", year: "2-digit",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="font-medium">{h.product_name}</TableCell>
                    <TableCell>
                      <Badge variant={entryTypeBadgeVariant(h.entry_type)}>
                        {entryTypeLabel(h.entry_type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-mono">{fmtQty(h.quantity)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {h.reason || "—"}
                    </TableCell>
                    <TableCell className="text-sm">{h.created_by_name}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditEntry(h)}
                          title={t("edit")}
                          disabled={h.entry_type === "adjust"}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => openDeleteEntry(h)}
                          title={t("delete")}
                          disabled={h.entry_type === "adjust"}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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

          {selectedProductRow && adjustType === "remove" && (
            <Alert variant={
              selectedProductRow.quantity_available <= 0 ? "destructive" : "default"
            } className={
              selectedProductRow.quantity_available > 0 && selectedProductRow.low_stock_threshold > 0 && selectedProductRow.quantity_available <= selectedProductRow.low_stock_threshold
                ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                : ""
            }>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex flex-col gap-0.5">
                <span>
                  {t("stock_available")}: <strong className="font-mono">
                    {fmtQty(selectedProductRow.quantity_available)} {stockUnitLabel(selectedProductRow.stock_unit)}
                  </strong>
                  {selectedProductRow.base_per_stock_unit && selectedProductRow.base_unit && (
                    <span className="text-xs text-muted-foreground ml-1">
                      (≈ {fmtQty(selectedProductRow.quantity_available * selectedProductRow.base_per_stock_unit)} {selectedProductRow.base_unit})
                    </span>
                  )}
                </span>
                {!selectedProductRow.allow_negative && (
                  <span className="text-xs opacity-80">{t("stock_negative_not_allowed_hint")}</span>
                )}
              </AlertDescription>
            </Alert>
          )}

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
              step="any"
              value={adjustQty}
              onChange={(e) => { setAdjustQty(e.target.value); setAdjustError(""); }}
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

          {adjustError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{adjustError}</AlertDescription>
            </Alert>
          )}
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
              step="any"
              value={thresholdValue}
              onChange={(e) => setThresholdValue(e.target.value)}
            />
          </div>
        </div>
      </ModalForm>

      {/* Edit Entry Modal */}
      <ModalForm
        open={editEntryOpen}
        onOpenChange={setEditEntryOpen}
        title={t("stock_entry_edit")}
        onSubmit={handleEditEntrySave}
        saving={editEntrySaving}
        submitLabel={t("save")}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{editEntry?.product_name}</span>
            <span>•</span>
            <Badge variant={entryTypeBadgeVariant(editEntry?.entry_type ?? "")}>
              {entryTypeLabel(editEntry?.entry_type ?? "")}
            </Badge>
          </div>
          <div className="space-y-2">
            <Label>{t("stock_qty")}</Label>
            <Input
              type="number"
              min={0}
              step="any"
              value={editEntryQty}
              onChange={(e) => setEditEntryQty(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("stock_reason")}</Label>
            <Textarea
              value={editEntryReason}
              onChange={(e) => setEditEntryReason(e.target.value)}
              placeholder={t("stock_reason_placeholder")}
              rows={2}
            />
          </div>
        </div>
      </ModalForm>

      {/* Delete Entry Confirmation */}
      <AlertDialog open={deleteEntryOpen} onOpenChange={setDeleteEntryOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("stock_entry_delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("stock_entry_delete_desc")}
              <br />
              <span className="font-medium">
                {deleteEntryTarget?.product_name} — {entryTypeLabel(deleteEntryTarget?.entry_type ?? "")}: {fmtQty(deleteEntryTarget?.quantity ?? 0)}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteEntryLoading}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEntry}
              disabled={deleteEntryLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteEntryLoading ? t("deleting") : t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </GestorClientGuard>
  );
}
