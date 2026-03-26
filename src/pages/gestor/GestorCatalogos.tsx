import { useState, useEffect, useCallback } from "react";
import { GestorClientGuard } from "@/components/GestorClientGuard";
import { supabase } from "@/integrations/supabase/client";
import { useGestor } from "@/contexts/GestorContext";
import { useTranslation } from "@/i18n/use-translation";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { ModalForm } from "@/components/ModalForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { BookOpen, Plus, Copy, Trash2, Package, Layers } from "lucide-react";

type Catalog = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  item_count: number;
};

type CatalogItem = {
  id: string;
  item_type: string;
  product_id: string | null;
  combo_id: string | null;
  is_active: boolean;
  name: string;
};

export default function GestorCatalogos() {
  const { t } = useTranslation();
  const { effectiveClientId: clientId } = useGestor();

  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Catalog form modal
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [catActive, setCatActive] = useState(true);

  // Items management
  const [itemsOpen, setItemsOpen] = useState(false);
  const [selectedCatalog, setSelectedCatalog] = useState<Catalog | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [combos, setCombos] = useState<{ id: string; name: string }[]>([]);
  const [addItemType, setAddItemType] = useState<"product" | "combo">("product");
  const [addItemId, setAddItemId] = useState("");

  // Duplicate modal
  const [dupOpen, setDupOpen] = useState(false);
  const [dupName, setDupName] = useState("");
  const [dupCatalog, setDupCatalog] = useState<Catalog | null>(null);
  const [dupSaving, setDupSaving] = useState(false);

  const fetchCatalogs = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);

    const { data: cats } = await supabase
      .from("catalogs")
      .select("id, name, description, is_active")
      .eq("client_id", clientId)
      .order("name");

    const catalogList = cats ?? [];

    // Count items per catalog
    const { data: itemCounts } = await supabase
      .from("catalog_items")
      .select("catalog_id")
      .eq("client_id", clientId);

    const countMap = new Map<string, number>();
    (itemCounts ?? []).forEach((i) => {
      countMap.set(i.catalog_id, (countMap.get(i.catalog_id) ?? 0) + 1);
    });

    setCatalogs(catalogList.map((c) => ({ ...c, item_count: countMap.get(c.id) ?? 0 })));
    setLoading(false);
  }, [clientId]);

  useEffect(() => { fetchCatalogs(); }, [fetchCatalogs]);

  const filtered = catalogs.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  // ---- Create / Edit catalog ----
  const openCreate = () => {
    setEditingId(null);
    setCatName("");
    setCatDesc("");
    setCatActive(true);
    setModalOpen(true);
  };

  const openEdit = (cat: Catalog) => {
    setEditingId(cat.id);
    setCatName(cat.name);
    setCatDesc(cat.description ?? "");
    setCatActive(cat.is_active);
    setModalOpen(true);
  };

  const handleSaveCatalog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) { toast.error(t("ctlg_validation_name")); return; }

    setSaving(true);
    const payload = { name: catName.trim(), description: catDesc.trim() || null, is_active: catActive, client_id: clientId! };

    if (editingId) {
      const { error } = await supabase.from("catalogs").update(payload).eq("id", editingId);
      if (error) { toast.error(t("ctlg_save_error")); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("catalogs").insert(payload);
      if (error) { toast.error(t("ctlg_save_error")); setSaving(false); return; }
    }

    setSaving(false);
    toast.success(editingId ? t("ctlg_updated") : t("ctlg_created"));
    setModalOpen(false);
    fetchCatalogs();
  };

  // ---- Toggle active ----
  const toggleActive = async (cat: Catalog) => {
    const { error } = await supabase.from("catalogs").update({ is_active: !cat.is_active }).eq("id", cat.id);
    if (error) { toast.error(t("ctlg_save_error")); return; }
    toast.success(cat.is_active ? t("ctlg_deactivated") : t("ctlg_activated"));
    fetchCatalogs();
  };

  // ---- Duplicate ----
  const openDuplicate = (cat: Catalog) => {
    setDupCatalog(cat);
    setDupName(`${cat.name} (${t("ctlg_copy")})`);
    setDupOpen(true);
  };

  const handleDuplicate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dupCatalog || !dupName.trim()) return;
    setDupSaving(true);

    // Create new catalog
    const { data: newCat, error: catErr } = await supabase
      .from("catalogs")
      .insert({ client_id: clientId!, name: dupName.trim(), description: dupCatalog.description, is_active: true })
      .select("id")
      .single();

    if (catErr || !newCat) { toast.error(t("ctlg_save_error")); setDupSaving(false); return; }

    // Copy items
    const { data: srcItems } = await supabase
      .from("catalog_items")
      .select("item_type, product_id, combo_id, is_active")
      .eq("catalog_id", dupCatalog.id);

    if (srcItems && srcItems.length > 0) {
      await supabase.from("catalog_items").insert(
        srcItems.map((i) => ({
          catalog_id: newCat.id,
          client_id: clientId!,
          item_type: i.item_type,
          product_id: i.product_id,
          combo_id: i.combo_id,
          is_active: i.is_active,
        }))
      );
    }

    setDupSaving(false);
    toast.success(t("ctlg_duplicated"));
    setDupOpen(false);
    fetchCatalogs();
  };

  // ---- Manage items ----
  const openItems = async (cat: Catalog) => {
    setSelectedCatalog(cat);
    setAddItemType("product");
    setAddItemId("");

    const [itemsRes, prodsRes, combosRes] = await Promise.all([
      supabase.from("catalog_items").select("id, item_type, product_id, combo_id, is_active").eq("catalog_id", cat.id),
      supabase.from("products").select("id, name").eq("client_id", clientId!).eq("is_active", true).order("name"),
      supabase.from("combos").select("id, name").eq("client_id", clientId!).eq("is_active", true).order("name"),
    ]);

    const prods = prodsRes.data ?? [];
    const cmbs = combosRes.data ?? [];
    setProducts(prods);
    setCombos(cmbs);

    const prodMap = new Map(prods.map((p) => [p.id, p.name]));
    const comboMap = new Map(cmbs.map((c) => [c.id, c.name]));

    setItems((itemsRes.data ?? []).map((i) => ({
      ...i,
      name: i.item_type === "product"
        ? prodMap.get(i.product_id ?? "") ?? "—"
        : comboMap.get(i.combo_id ?? "") ?? "—",
    })));

    setItemsOpen(true);
  };

  const addItem = async () => {
    if (!addItemId || !selectedCatalog) return;

    const payload = {
      catalog_id: selectedCatalog.id,
      client_id: clientId!,
      item_type: addItemType,
      product_id: addItemType === "product" ? addItemId : null,
      combo_id: addItemType === "combo" ? addItemId : null,
      is_active: true,
    };

    const { error } = await supabase.from("catalog_items").insert(payload);
    if (error) {
      toast.error(error.message.includes("duplicate") ? t("ctlg_item_duplicate") : t("ctlg_save_error"));
      return;
    }

    toast.success(t("ctlg_item_added"));
    setAddItemId("");
    openItems(selectedCatalog);
    fetchCatalogs();
  };

  const removeItem = async (itemId: string) => {
    await supabase.from("catalog_items").delete().eq("id", itemId);
    toast.success(t("ctlg_item_removed"));
    if (selectedCatalog) openItems(selectedCatalog);
    fetchCatalogs();
  };

  const toggleItemActive = async (item: CatalogItem) => {
    await supabase.from("catalog_items").update({ is_active: !item.is_active }).eq("id", item.id);
    if (selectedCatalog) openItems(selectedCatalog);
  };

  // Available items for dropdown (exclude already added)
  const existingProductIds = new Set(items.filter((i) => i.item_type === "product").map((i) => i.product_id));
  const existingComboIds = new Set(items.filter((i) => i.item_type === "combo").map((i) => i.combo_id));
  const availableProducts = products.filter((p) => !existingProductIds.has(p.id));
  const availableCombos = combos.filter((c) => !existingComboIds.has(c.id));
  const availableItems = addItemType === "product" ? availableProducts : availableCombos;

  // ---- Columns ----
  const columns: DataTableColumn<Catalog>[] = [
    {
      key: "name",
      header: t("name"),
      render: (r) => (
        <button onClick={() => openItems(r)} className="font-medium text-primary hover:underline text-left">
          {r.name}
        </button>
      ),
    },
    {
      key: "desc",
      header: t("description"),
      render: (r) => <span className="text-muted-foreground text-sm truncate max-w-[200px] block">{r.description || "—"}</span>,
    },
    {
      key: "items",
      header: t("ctlg_items"),
      className: "w-24 text-center",
      render: (r) => <Badge variant="secondary">{r.item_count}</Badge>,
    },
    {
      key: "status",
      header: "Status",
      className: "w-28",
      render: (r) => (
        <StatusBadge
          status={r.is_active ? "active" : "inactive"}
          label={r.is_active ? t("active") : t("inactive")}
          onClick={() => toggleActive(r)}
        />
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-32 text-right",
      render: (r) => (
        <div className="flex gap-1 justify-end">
          <Button size="sm" variant="ghost" onClick={() => openItems(r)} title={t("ctlg_items")}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openEdit(r)} title={t("ctlg_edit")}>
            <BookOpen className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openDuplicate(r)} title={t("ctlg_duplicate")}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <GestorClientGuard>
    <div className="space-y-6">
      <PageHeader
        title={t("ctlg_title")}
        subtitle={t("ctlg_subtitle")}
        icon={BookOpen}
        actions={
          <Button onClick={openCreate} className="glow-hover">
            <Plus className="mr-2 h-4 w-4" />
            {t("ctlg_add")}
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={filtered}
        keyExtractor={(r) => r.id}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t("ctlg_search")}
        emptyMessage={t("ctlg_empty")}
        emptyHint={t("ctlg_empty_hint")}
        emptyActionLabel={t("ctlg_add")}
        onEmptyAction={openCreate}
      />

      {/* Create/Edit Catalog Modal */}
      <ModalForm open={modalOpen} onOpenChange={setModalOpen} title={editingId ? t("ctlg_edit") : t("ctlg_add")} onSubmit={handleSaveCatalog} saving={saving}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("name")}</Label>
            <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder={t("ctlg_name_placeholder")} />
          </div>
          <div className="space-y-2">
            <Label>{t("description")}</Label>
            <Textarea value={catDesc} onChange={(e) => setCatDesc(e.target.value)} rows={2} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
            <Label className="cursor-pointer">{t("active")}</Label>
            <Switch checked={catActive} onCheckedChange={setCatActive} />
          </div>
        </div>
      </ModalForm>

      {/* Duplicate Modal */}
      <ModalForm open={dupOpen} onOpenChange={setDupOpen} title={t("ctlg_duplicate")} onSubmit={handleDuplicate} saving={dupSaving} submitLabel={t("ctlg_duplicate")}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("ctlg_dup_desc")}: <strong>{dupCatalog?.name}</strong></p>
          <div className="space-y-2">
            <Label>{t("ctlg_new_name")}</Label>
            <Input value={dupName} onChange={(e) => setDupName(e.target.value)} />
          </div>
        </div>
      </ModalForm>

      {/* Items Management Modal */}
      <ModalForm
        open={itemsOpen}
        onOpenChange={setItemsOpen}
        title={`${t("ctlg_items")}: ${selectedCatalog?.name ?? ""}`}
        onSubmit={(e) => { e.preventDefault(); setItemsOpen(false); }}
        submitLabel={t("close")}
      >
        <div className="space-y-4">
          {/* Add item row */}
          <div className="flex gap-2 items-end">
            <div className="w-28">
              <Label className="text-xs">{t("ctlg_item_type")}</Label>
              <Select value={addItemType} onValueChange={(v) => { setAddItemType(v as "product" | "combo"); setAddItemId(""); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">{t("camp_type_product")}</SelectItem>
                  <SelectItem value="combo">{t("camp_type_combo")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label className="text-xs">{addItemType === "product" ? t("product") : "Combo"}</Label>
              <Select value={addItemId} onValueChange={setAddItemId}>
                <SelectTrigger className="h-9"><SelectValue placeholder={t("ctlg_select_item")} /></SelectTrigger>
                <SelectContent>
                  {availableItems.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" size="sm" onClick={addItem} disabled={!addItemId} className="h-9">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t("ctlg_no_items")}</p>
          ) : (
            <div className="space-y-1">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2">
                  <div className="flex items-center gap-2">
                    {item.item_type === "product" ? <Package className="h-4 w-4 text-muted-foreground" /> : <Layers className="h-4 w-4 text-muted-foreground" />}
                    <span className="text-sm font-medium">{item.name}</span>
                    <Badge variant="outline" className="text-[10px]">{item.item_type === "product" ? t("camp_type_product") : t("camp_type_combo")}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={item.is_active} onCheckedChange={() => toggleItemActive(item)} />
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeItem(item.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ModalForm>
    </div>
    </GestorClientGuard>
  );
}
