import { useEffect, useState, useMemo } from "react";
import { GestorClientGuard } from "@/components/GestorClientGuard";
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
import { toast } from "sonner";
import { Plus, Pencil, Package } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { ModalForm } from "@/components/ModalForm";

type Category = { id: string; name: string };
type Product = { id: string; client_id: string; category_id: string | null; name: string; description: string | null; price: number; is_active: boolean };

const emptyForm = { name: "", description: "", price: "", category_id: "" };

export default function GestorProdutos() {
  const { effectiveClientId: clientId } = useGestor();
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    setLoading(true);
    let q = supabase.from("products").select("id, client_id, category_id, name, description, price, is_active").order("name");
    if (!isSuperAdmin && clientId) q = q.eq("client_id", clientId);
    const { data, error } = await q;
    if (error) toast.error(getPtBrErrorMessage(error));
    setProducts(data ?? []);
    setLoading(false);
  };

  const fetchCategories = async () => {
    let q = supabase.from("categories").select("id, name").eq("is_active", true).order("name");
    if (!isSuperAdmin && clientId) q = q.eq("client_id", clientId);
    const { data } = await q;
    setCategories(data ?? []);
  };

  useEffect(() => { fetchProducts(); fetchCategories(); }, [clientId]);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const filtered = useMemo(() => products.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCat !== "all" && p.category_id !== filterCat) return false;
    return true;
  }), [products, search, filterCat]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setSheetOpen(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ name: p.name, description: p.description ?? "", price: String(p.price), category_id: p.category_id ?? "" });
    setSheetOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    const price = parseFloat(form.price);
    if (!name || isNaN(price) || price < 0 || (!clientId && !isSuperAdmin)) return;
    setSaving(true);
    try {
      const payload = { name, description: form.description.trim() || null, price, category_id: form.category_id || null };
      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success(t("product_updated"));
      } else {
        const { error } = await supabase.from("products").insert({ ...payload, client_id: clientId! });
        if (error) throw error;
        toast.success(t("product_created"));
      }
      setSheetOpen(false); fetchProducts();
    } catch (err: any) {
      toast.error(getPtBrErrorMessage(err));
    } finally { setSaving(false); }
  };

  const toggleActive = async (p: Product) => {
    const { error } = await supabase.from("products").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) { toast.error(getPtBrErrorMessage(error)); return; }
    toast.success(p.is_active ? t("product_deactivated") : t("product_activated"));
    fetchProducts();
  };

  const formatPrice = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const columns: DataTableColumn<Product>[] = [
    { key: "name", header: t("name"), render: (p) => <span className="font-medium">{p.name}</span> },
    { key: "category", header: t("category"), render: (p) => p.category_id ? <span>{catMap.get(p.category_id) ?? "—"}</span> : <span className="text-muted-foreground">{t("no_category")}</span> },
    { key: "price", header: t("price"), render: (p) => <span className="font-mono text-sm">{formatPrice(p.price)}</span> },
    { key: "status", header: t("status"), render: (p) => <StatusBadge status={p.is_active ? "active" : "inactive"} label={p.is_active ? t("active") : t("inactive")} /> },
    { key: "actions", header: t("actions"), className: "w-28 text-right", render: (p) => (
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="icon" onClick={() => openEdit(p)} className="hover:text-primary"><Pencil className="h-4 w-4" /></Button>
        <Switch checked={p.is_active} onCheckedChange={() => toggleActive(p)} />
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("gestor_products")} subtitle={t("gestor_products_desc")} icon={Package}
        actions={clientId ? <Button onClick={openCreate} className="glow-hover"><Plus className="mr-2 h-4 w-4" />{t("add_product")}</Button> : undefined}
      />

      <DataTable
        columns={columns} data={filtered} keyExtractor={(p) => p.id}
        loading={loading} search={search} onSearchChange={setSearch} searchPlaceholder={t("search_products")}
        emptyMessage={t("no_products_found")}
        emptyActionLabel={clientId ? t("add_product") : undefined}
        onEmptyAction={clientId ? openCreate : undefined}
        filters={
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-48 bg-secondary/50 border-border/60"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("all_categories")}</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      <ModalForm open={sheetOpen} onOpenChange={setSheetOpen} title={editing ? t("edit_product") : t("new_product")}
        onSubmit={handleSave} saving={saving} submitLabel={editing ? t("update") : t("create")} disabled={!form.name.trim() || !form.price}>
        <div className="space-y-2"><Label>{t("product_name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={150} autoFocus /></div>
        <div className="space-y-2"><Label>{t("description")}</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} rows={3} /></div>
        <div className="space-y-2"><Label>{t("price")}</Label><Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
        <div className="space-y-2">
          <Label>{t("category")}</Label>
          <Select value={form.category_id || "_none"} onValueChange={(v) => setForm({ ...form, category_id: v === "_none" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder={t("select_category")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">{t("no_category")}</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </ModalForm>
    </div>
  );
}
