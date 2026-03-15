import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPtBrErrorMessage } from "@/lib/error-messages";
import { useGestor } from "@/contexts/GestorContext";
import { useTranslation } from "@/i18n/use-translation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Search, Pencil } from "lucide-react";

type Category = { id: string; name: string };
type Product = {
  id: string;
  client_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  is_active: boolean;
};

const emptyForm = { name: "", description: "", price: "", category_id: "" };

export default function GestorProdutos() {
  const { clientId, isSuperAdmin } = useGestor();
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchProducts = async () => {
    let q = supabase.from("products").select("id, client_id, category_id, name, description, price, is_active").order("name");
    if (!isSuperAdmin && clientId) q = q.eq("client_id", clientId);
    const { data, error } = await q;
    if (error) { console.error("products fetch error", error); toast.error(getPtBrErrorMessage(error)); return; }
    setProducts(data ?? []);
  };

  const fetchCategories = async () => {
    let q = supabase.from("categories").select("id, name").eq("is_active", true).order("name");
    if (!isSuperAdmin && clientId) q = q.eq("client_id", clientId);
    const { data } = await q;
    setCategories(data ?? []);
  };

  useEffect(() => { fetchProducts(); fetchCategories(); }, [clientId]);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const filtered = useMemo(
    () => products.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCat !== "all" && p.category_id !== filterCat) return false;
      return true;
    }),
    [products, search, filterCat]
  );

  const openCreate = () => { setEditing(null); setForm(emptyForm); setSheetOpen(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ name: p.name, description: p.description ?? "", price: String(p.price), category_id: p.category_id ?? "" });
    setSheetOpen(true);
  };

  const handleSave = async () => {
    const name = form.name.trim();
    const price = parseFloat(form.price);
    if (!name || isNaN(price) || price < 0) return;
    if (!clientId && !isSuperAdmin) return;
    setSaving(true);
    try {
      const payload = {
        name,
        description: form.description.trim() || null,
        price,
        category_id: form.category_id || null,
      };
      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success(t("product_updated"));
      } else {
        const { error } = await supabase.from("products").insert({ ...payload, client_id: clientId! });
        if (error) throw error;
        toast.success(t("product_created"));
      }
      setSheetOpen(false);
      fetchProducts();
    } catch (err: any) {
      console.error("product save error", err);
      toast.error(getPtBrErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: Product) => {
    const { error } = await supabase.from("products").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) { toast.error(getPtBrErrorMessage(error)); return; }
    toast.success(p.is_active ? t("product_deactivated") : t("product_activated"));
    fetchProducts();
  };

  const formatPrice = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("gestor_products")}</h1>
          <p className="text-muted-foreground">{t("gestor_products_desc")}</p>
        </div>
        {clientId && (
          <Button onClick={openCreate} size="sm">
            <Plus className="mr-2 h-4 w-4" /> {t("add_product")}
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder={t("search_products")} value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
            </div>
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all_categories")}</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("category")}</TableHead>
                <TableHead>{t("price")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t("no_products_found")}</TableCell></TableRow>
              ) : filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.category_id ? catMap.get(p.category_id) ?? "—" : <span className="text-muted-foreground">{t("no_category")}</span>}</TableCell>
                  <TableCell>{formatPrice(p.price)}</TableCell>
                  <TableCell>
                    <Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? t("active") : t("inactive")}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Switch checked={p.is_active} onCheckedChange={() => toggleActive(p)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editing ? t("edit_product") : t("new_product")}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <Label>{t("product_name")}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={150} />
            </div>
            <div>
              <Label>{t("description")}</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} rows={3} />
            </div>
            <div>
              <Label>{t("price")}</Label>
              <Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div>
              <Label>{t("category")}</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v === "_none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder={t("select_category")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{t("no_category")}</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSave} disabled={saving || !form.name.trim() || !form.price} className="w-full">
              {editing ? t("update") : t("create")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
