import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPtBrErrorMessage } from "@/lib/error-messages";
import { useGestor } from "@/contexts/GestorContext";
import { useTranslation } from "@/i18n/use-translation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Layers, Trash2, Package } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { ModalForm } from "@/components/ModalForm";
import { Separator } from "@/components/ui/separator";

type Combo = {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  price: number;
  is_active: boolean;
  item_count?: number;
};

type ComboItem = {
  id?: string;
  product_id: string;
  quantity: number;
};

type Product = {
  id: string;
  name: string;
  price: number;
};

const emptyForm = { name: "", description: "", price: "" };

export default function GestorCombos() {
  const { clientId, isSuperAdmin } = useGestor();
  const { t } = useTranslation();
  const [combos, setCombos] = useState<Combo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Combo | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState<ComboItem[]>([]);
  const [originalItems, setOriginalItems] = useState<ComboItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [removeConfirm, setRemoveConfirm] = useState<number | null>(null);

  const fetchCombos = async () => {
    setLoading(true);
    let q = supabase.from("combos").select("id, client_id, name, description, price, is_active").order("name");
    if (!isSuperAdmin && clientId) q = q.eq("client_id", clientId);
    const { data, error } = await q;
    if (error) toast.error(getPtBrErrorMessage(error));

    const comboList = (data as Combo[]) ?? [];

    // Fetch item counts
    if (comboList.length > 0) {
      const { data: itemData } = await supabase
        .from("combo_items")
        .select("combo_id")
        .in("combo_id", comboList.map((c) => c.id));

      const countMap = new Map<string, number>();
      (itemData ?? []).forEach((row: { combo_id: string }) => {
        countMap.set(row.combo_id, (countMap.get(row.combo_id) ?? 0) + 1);
      });
      comboList.forEach((c) => { c.item_count = countMap.get(c.id) ?? 0; });
    }

    setCombos(comboList);
    setLoading(false);
  };

  const fetchProducts = async () => {
    let q = supabase.from("products").select("id, name, price").eq("is_active", true).order("name");
    if (!isSuperAdmin && clientId) q = q.eq("client_id", clientId);
    const { data } = await q;
    setProducts(data ?? []);
  };

  useEffect(() => {
    fetchCombos();
    fetchProducts();
  }, [clientId]);

  const filtered = useMemo(
    () => combos.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase())),
    [combos, search]
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setItems([]);
    setOriginalItems([]);
    setSheetOpen(true);
  };

  const openEdit = async (combo: Combo) => {
    setEditing(combo);
    setForm({ name: combo.name, description: combo.description ?? "", price: String(combo.price) });

    const { data } = await supabase
      .from("combo_items")
      .select("id, product_id, quantity")
      .eq("combo_id", combo.id);

    const loaded = (data as ComboItem[]) ?? [];
    setItems(loaded.map((i) => ({ ...i })));
    setOriginalItems(loaded.map((i) => ({ ...i })));
    setSheetOpen(true);
  };

  // Validation
  const priceNum = parseFloat(form.price);
  const isFormValid = form.name.trim().length > 0 && !isNaN(priceNum) && priceNum > 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    const price = parseFloat(form.price);

    if (!name) { toast.error(t("combo_validation_name_required")); return; }
    if (isNaN(price) || price <= 0) { toast.error(t("combo_validation_price_positive")); return; }
    if (!clientId && !isSuperAdmin) return;

    setSaving(true);

    try {
      let comboId: string;

      if (editing) {
        const { error } = await supabase
          .from("combos")
          .update({ name, description: form.description.trim() || null, price })
          .eq("id", editing.id);
        if (error) throw error;
        comboId = editing.id;
      } else {
        const { data, error } = await supabase
          .from("combos")
          .insert({ name, description: form.description.trim() || null, price, client_id: clientId! })
          .select("id")
          .single();
        if (error) throw error;
        comboId = data.id;
      }

      // Sync combo_items
      await syncComboItems(comboId, items, originalItems);

      toast.success(editing ? t("combo_updated") : t("combo_created"));
      setSheetOpen(false);
      fetchCombos();
    } catch (err: any) {
      toast.error(getPtBrErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const syncComboItems = async (comboId: string, current: ComboItem[], original: ComboItem[]) => {
    const currentIds = new Set(current.filter((i) => i.id).map((i) => i.id!));

    // Delete removed items
    const toDelete = original.filter((i) => i.id && !currentIds.has(i.id!));
    if (toDelete.length > 0) {
      const { error } = await supabase
        .from("combo_items")
        .delete()
        .in("id", toDelete.map((i) => i.id!));
      if (error) throw error;
    }

    // Insert new items
    const toInsert = current.filter((i) => !i.id);
    if (toInsert.length > 0) {
      const { error } = await supabase
        .from("combo_items")
        .insert(toInsert.map((i) => ({ combo_id: comboId, product_id: i.product_id, quantity: i.quantity })));
      if (error) throw error;
    }

    // Update existing items
    const toUpdate = current.filter((i) => {
      if (!i.id) return false;
      const orig = original.find((o) => o.id === i.id);
      return orig && (orig.quantity !== i.quantity || orig.product_id !== i.product_id);
    });
    for (const item of toUpdate) {
      const { error } = await supabase
        .from("combo_items")
        .update({ product_id: item.product_id, quantity: item.quantity })
        .eq("id", item.id!);
      if (error) throw error;
    }
  };

  const toggleActive = async (combo: Combo) => {
    // Block activation without items
    if (!combo.is_active) {
      const itemCount = combo.item_count ?? 0;
      if (itemCount === 0) {
        toast.error(t("combo_activate_needs_items"));
        return;
      }
    }

    const { error } = await supabase.from("combos").update({ is_active: !combo.is_active }).eq("id", combo.id);
    if (error) {
      toast.error(getPtBrErrorMessage(error));
      return;
    }
    toast.success(combo.is_active ? t("combo_deactivated") : t("combo_activated"));
    fetchCombos();
  };

  const addItem = () => {
    if (products.length === 0) return;
    const usedIds = new Set(items.map((i) => i.product_id));
    const available = products.find((p) => !usedIds.has(p.id));
    if (!available) {
      toast.error(t("combo_all_products_added"));
      return;
    }
    setItems([...items, { product_id: available.id, quantity: 1 }]);
  };

  const confirmRemoveItem = (index: number) => {
    setRemoveConfirm(index);
  };

  const executeRemoveItem = () => {
    if (removeConfirm !== null) {
      setItems(items.filter((_, i) => i !== removeConfirm));
      setRemoveConfirm(null);
    }
  };

  const updateItem = (index: number, field: "product_id" | "quantity", value: string | number) => {
    const newValue = field === "quantity" ? Math.max(1, typeof value === "number" ? value : parseInt(value) || 1) : value;
    setItems(items.map((item, i) => (i === index ? { ...item, [field]: newValue } : item)));
  };

  const formatPrice = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const getAvailableProducts = (currentIndex: number) => {
    const usedIds = new Set(items.filter((_, i) => i !== currentIndex).map((i) => i.product_id));
    return products.filter((p) => !usedIds.has(p.id));
  };

  const columns: DataTableColumn<Combo>[] = [
    { key: "name", header: t("name"), render: (c) => <span className="font-medium">{c.name}</span> },
    {
      key: "items",
      header: t("combo_items_label"),
      render: (c) => (
        <Badge variant="secondary" className="font-mono text-xs">
          <Package className="mr-1 h-3 w-3" />
          {c.item_count ?? 0} {c.item_count === 1 ? "item" : "itens"}
        </Badge>
      ),
    },
    { key: "price", header: t("price"), render: (c) => <span className="font-mono text-sm">{formatPrice(c.price)}</span> },
    {
      key: "status",
      header: t("status"),
      render: (c) => (
        <StatusBadge status={c.is_active ? "active" : "inactive"} label={c.is_active ? t("active") : t("inactive")} />
      ),
    },
    {
      key: "actions",
      header: t("actions"),
      className: "w-28 text-right",
      render: (c) => (
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="icon" onClick={() => openEdit(c)} className="hover:text-primary">
            <Pencil className="h-4 w-4" />
          </Button>
          <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("gestor_combos")}
        subtitle={t("gestor_combos_desc")}
        icon={Layers}
        actions={
          clientId ? (
            <Button onClick={openCreate} className="glow-hover">
              <Plus className="mr-2 h-4 w-4" />
              {t("add_combo")}
            </Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={filtered}
        keyExtractor={(c) => c.id}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t("search_combos")}
        emptyMessage={t("no_combos_found")}
        emptyHint={t("combo_empty_hint")}
        emptyActionLabel={clientId ? t("add_combo") : undefined}
        onEmptyAction={clientId ? openCreate : undefined}
      />

      <ModalForm
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={editing ? t("edit_combo") : t("new_combo")}
        onSubmit={handleSave}
        saving={saving}
        submitLabel={editing ? t("update") : t("create")}
        disabled={!isFormValid}
      >
        <div className="space-y-2">
          <Label>{t("combo_name")} *</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            maxLength={150}
            autoFocus
            placeholder={t("combo_name_placeholder")}
          />
          {form.name.length > 0 && !form.name.trim() && (
            <p className="text-xs text-destructive">{t("combo_validation_name_required")}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>{t("description")}</Label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            maxLength={500}
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("price")} *</Label>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            placeholder="0,00"
          />
          {form.price && (isNaN(priceNum) || priceNum <= 0) && (
            <p className="text-xs text-destructive">{t("combo_validation_price_positive")}</p>
          )}
        </div>

        <Separator className="my-4" />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-semibold">{t("combo_items_label")}</Label>
              <Badge variant="outline" className="text-xs font-mono">{items.length}</Badge>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="mr-1 h-3 w-3" />
              {t("combo_add_item")}
            </Button>
          </div>

          {items.length === 0 && (
            <div className="rounded-lg border border-dashed border-border/60 p-6 text-center">
              <Package className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t("combo_no_items")}</p>
            </div>
          )}

          {items.map((item, index) => {
            const product = products.find((p) => p.id === item.product_id);
            return (
              <div key={index} className="flex items-center gap-2 rounded-md border border-border/40 bg-secondary/30 p-2">
                <Select value={item.product_id} onValueChange={(v) => updateItem(index, "product_id", v)}>
                  <SelectTrigger className="flex-1 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableProducts(index).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {formatPrice(p.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="1"
                  className="w-20 bg-background"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, "quantity", e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => confirmRemoveItem(index)}
                  className="hover:text-destructive shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </ModalForm>

      {/* Confirm remove item dialog */}
      <AlertDialog open={removeConfirm !== null} onOpenChange={(open) => { if (!open) setRemoveConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("combo_remove_item_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("combo_remove_item_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={executeRemoveItem} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
