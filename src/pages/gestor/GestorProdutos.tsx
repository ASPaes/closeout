import { useEffect, useState, useMemo, useCallback } from "react";
import { GestorClientGuard } from "@/components/GestorClientGuard";
import { supabase } from "@/integrations/supabase/client";
import { getPtBrErrorMessage } from "@/lib/error-messages";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTION } from "@/config/audit-actions";
import { useGestor } from "@/contexts/GestorContext";
import { useTranslation } from "@/i18n/use-translation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus, Pencil, Package, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { ModalForm } from "@/components/ModalForm";
import { EmptyState } from "@/components/EmptyState";
import { ProductImageSection } from "@/components/ProductImageSection";
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

type Category = { id: string; name: string };
type Product = {
  id: string; client_id: string; category_id: string | null;
  name: string; description: string | null; price: number; is_active: boolean;
  is_sellable: boolean; is_stock_tracked: boolean; is_ingredient: boolean;
  stock_unit: string | null; base_unit: string | null; base_per_stock_unit: number | null;
  image_path: string | null; image_source: string | null;
};
type Recipe = {
  id: string; client_id: string; product_id: string;
  ingredient_product_id: string; quantity_base: number;
  base_unit: string; is_active: boolean;
};

const STOCK_UNITS = [
  { value: "bottle", label: "prod_unit_bottle" },
  { value: "kg", label: "prod_unit_kg" },
  { value: "unit", label: "prod_unit_unit" },
  { value: "pack", label: "prod_unit_pack" },
] as const;

const BASE_UNITS = [
  { value: "ml", label: "prod_base_ml" },
  { value: "g", label: "prod_base_g" },
  { value: "unit", label: "prod_base_unit_unit" },
] as const;

const emptyForm = {
  name: "", description: "", price: "", category_id: "",
  is_sellable: true, is_stock_tracked: false, is_ingredient: false,
  stock_unit: "", base_unit: "", base_per_stock_unit: "",
  image_path: "" as string | null, image_source: "" as string | null,
};

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

  // Recipe state
  const [recipeProduct, setRecipeProduct] = useState<Product | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [recipeModalOpen, setRecipeModalOpen] = useState(false);
  const [recipeForm, setRecipeForm] = useState({ ingredient_product_id: "", quantity_base: "", base_unit: "" });
  const [recipeSaving, setRecipeSaving] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [deleteRecipe, setDeleteRecipe] = useState<Recipe | null>(null);
  const [ingredients, setIngredients] = useState<Product[]>([]);

  // Active tab per product detail
  const [activeTab, setActiveTab] = useState("details");

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("products")
      .select("id, client_id, category_id, name, description, price, is_active, is_sellable, is_stock_tracked, is_ingredient, stock_unit, base_unit, base_per_stock_unit, image_path, image_source" as any)
      .order("name");
    if (clientId) q = q.eq("client_id", clientId);
    const { data, error } = await q;
    if (error) toast.error(getPtBrErrorMessage(error));
    setProducts((data as unknown as Product[]) ?? []);
    setLoading(false);
  }, [clientId]);

  const fetchCategories = useCallback(async () => {
    let q = supabase.from("categories").select("id, name").eq("is_active", true).order("name");
    if (clientId) q = q.eq("client_id", clientId);
    const { data } = await q;
    setCategories(data ?? []);
  }, [clientId]);

  const fetchIngredients = useCallback(async () => {
    if (!clientId) return;
    const { data } = await supabase.from("products")
      .select("id, client_id, category_id, name, description, price, is_active, is_sellable, is_stock_tracked, is_ingredient, stock_unit, base_unit, base_per_stock_unit, image_path, image_source" as any)
      .eq("client_id", clientId)
      .eq("is_ingredient", true)
      .eq("is_active", true)
      .order("name");
    setIngredients((data as unknown as Product[]) ?? []);
  }, [clientId]);

  useEffect(() => { fetchProducts(); fetchCategories(); fetchIngredients(); }, [fetchProducts, fetchCategories, fetchIngredients]);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const ingredientMap = useMemo(() => new Map(ingredients.map((p) => [p.id, p])), [ingredients]);

  const filtered = useMemo(() => products.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCat !== "all" && p.category_id !== filterCat) return false;
    return true;
  }), [products, search, filterCat]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setSheetOpen(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name, description: p.description ?? "", price: String(p.price),
      category_id: p.category_id ?? "",
      is_sellable: p.is_sellable, is_stock_tracked: p.is_stock_tracked, is_ingredient: p.is_ingredient,
      stock_unit: p.stock_unit ?? "", base_unit: p.base_unit ?? "",
      base_per_stock_unit: p.base_per_stock_unit != null ? String(p.base_per_stock_unit) : "",
      image_path: p.image_path ?? null, image_source: p.image_source ?? null,
    });
    setSheetOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    const price = parseFloat(form.price);
    if (!name || isNaN(price) || price < 0 || !clientId) return;

    // Validate stock fields
    if (form.is_stock_tracked) {
      if (!form.stock_unit || !form.base_unit || !form.base_per_stock_unit) {
        toast.error(t("prod_stock_fields_required"));
        return;
      }
      if (parseFloat(form.base_per_stock_unit) <= 0) {
        toast.error(t("prod_base_per_must_positive"));
        return;
      }
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name, description: form.description.trim() || null, price,
        category_id: form.category_id || null,
        is_sellable: form.is_sellable,
        is_stock_tracked: form.is_stock_tracked,
        is_ingredient: form.is_ingredient,
        stock_unit: form.is_stock_tracked ? form.stock_unit : null,
        base_unit: form.is_stock_tracked || form.is_ingredient ? (form.base_unit || null) : null,
        base_per_stock_unit: form.is_stock_tracked ? parseFloat(form.base_per_stock_unit) : null,
      };
      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success(t("product_updated"));
      } else {
        const { error } = await supabase.from("products").insert([{ ...payload, client_id: clientId } as any]);
        if (error) throw error;
        toast.success(t("product_created"));
      }
      setSheetOpen(false);
      fetchProducts();
      fetchIngredients();
    } catch (err: unknown) {
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

  // === Recipe logic ===
  const showRecipe = (p: Product) => p.is_sellable && !p.is_stock_tracked;

  const openRecipeTab = async (p: Product) => {
    setRecipeProduct(p);
    setActiveTab("recipe");
    await fetchRecipes(p.id);
  };

  const fetchRecipes = async (productId: string) => {
    if (!clientId) return;
    setRecipesLoading(true);
    const { data, error } = await supabase.from("product_recipes")
      .select("*")
      .eq("product_id", productId)
      .eq("client_id", clientId)
      .order("created_at");
    if (error) toast.error(getPtBrErrorMessage(error));
    setRecipes((data as Recipe[]) ?? []);
    setRecipesLoading(false);
  };

  const openRecipeCreate = () => {
    setEditingRecipe(null);
    setRecipeForm({ ingredient_product_id: "", quantity_base: "", base_unit: "" });
    setRecipeModalOpen(true);
  };

  const openRecipeEdit = (r: Recipe) => {
    setEditingRecipe(r);
    setRecipeForm({
      ingredient_product_id: r.ingredient_product_id,
      quantity_base: String(r.quantity_base),
      base_unit: r.base_unit,
    });
    setRecipeModalOpen(true);
  };

  // Auto-fill base_unit when ingredient selected
  const handleIngredientChange = (ingredientId: string) => {
    const ing = ingredientMap.get(ingredientId);
    setRecipeForm(prev => ({
      ...prev,
      ingredient_product_id: ingredientId,
      base_unit: ing?.base_unit ?? prev.base_unit,
    }));
  };

  const handleRecipeSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeProduct || !clientId) return;
    const qty = parseFloat(recipeForm.quantity_base);
    if (!recipeForm.ingredient_product_id || isNaN(qty) || qty <= 0 || !recipeForm.base_unit) return;

    // Validate ingredient has base_unit set
    const ing = ingredientMap.get(recipeForm.ingredient_product_id);
    if (ing && ing.base_unit && ing.base_unit !== recipeForm.base_unit) {
      toast.error(t("recipe_ingredient_no_base_unit"));
      return;
    }
    if (ing && !ing.base_unit) {
      toast.error(t("recipe_ingredient_no_base_unit"));
      return;
    }

    setRecipeSaving(true);
    try {
      const payload = {
        client_id: clientId,
        product_id: recipeProduct.id,
        ingredient_product_id: recipeForm.ingredient_product_id,
        quantity_base: qty,
        base_unit: recipeForm.base_unit,
      };
      if (editingRecipe) {
        const { error } = await supabase.from("product_recipes")
          .update({ quantity_base: qty, base_unit: recipeForm.base_unit })
          .eq("id", editingRecipe.id);
        if (error) throw error;
        toast.success(t("recipe_updated"));
      } else {
        const { error } = await supabase.from("product_recipes").insert(payload);
        if (error) throw error;
        toast.success(t("recipe_created"));
      }
      setRecipeModalOpen(false);
      fetchRecipes(recipeProduct.id);
    } catch (err: unknown) {
      toast.error(getPtBrErrorMessage(err));
    } finally { setRecipeSaving(false); }
  };

  const confirmDeleteRecipe = async () => {
    if (!deleteRecipe || !recipeProduct) return;
    try {
      const { error } = await supabase.from("product_recipes").delete().eq("id", deleteRecipe.id);
      if (error) throw error;
      toast.success(t("recipe_removed"));
      fetchRecipes(recipeProduct.id);
    } catch (err: unknown) {
      toast.error(getPtBrErrorMessage(err));
    }
    setDeleteRecipe(null);
  };

  // Available ingredients (filter out already added)
  const availableIngredients = useMemo(() => {
    const usedIds = new Set(recipes.map(r => r.ingredient_product_id));
    if (editingRecipe) usedIds.delete(editingRecipe.ingredient_product_id);
    return ingredients.filter(i =>
      !usedIds.has(i.id) &&
      (recipeProduct ? i.id !== recipeProduct.id : true)
    );
  }, [ingredients, recipes, editingRecipe, recipeProduct]);

  const columns: DataTableColumn<Product>[] = [
    { key: "name", header: t("name"), render: (p) => <span className="font-medium">{p.name}</span> },
    { key: "category", header: t("category"), render: (p) => p.category_id ? <span>{catMap.get(p.category_id) ?? "—"}</span> : <span className="text-muted-foreground">{t("no_category")}</span> },
    { key: "price", header: t("price"), render: (p) => <span className="font-mono text-sm">{formatPrice(p.price)}</span> },
    { key: "status", header: t("status"), render: (p) => <StatusBadge status={p.is_active ? "active" : "inactive"} label={p.is_active ? t("active") : t("inactive")} /> },
    { key: "actions", header: t("actions"), className: "w-40 text-right", render: (p) => (
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="icon" onClick={() => openEdit(p)} className="hover:text-primary"><Pencil className="h-4 w-4" /></Button>
        {showRecipe(p) && (
          <Button variant="ghost" size="icon" onClick={() => openRecipeTab(p)} className="hover:text-primary" title={t("recipe_tab")}>
            <Package className="h-4 w-4" />
          </Button>
        )}
        <Switch checked={p.is_active} onCheckedChange={() => toggleActive(p)} />
      </div>
    )},
  ];

  const recipeColumns: DataTableColumn<Recipe>[] = [
    { key: "ingredient", header: t("recipe_ingredient"), render: (r) => <span className="font-medium">{ingredientMap.get(r.ingredient_product_id)?.name ?? r.ingredient_product_id}</span> },
    { key: "quantity", header: t("recipe_quantity"), render: (r) => <span className="font-mono text-sm">{r.quantity_base}</span> },
    { key: "unit", header: t("recipe_unit"), render: (r) => <span>{r.base_unit}</span> },
    { key: "actions", header: t("actions"), className: "w-28 text-right", render: (r) => (
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="icon" onClick={() => openRecipeEdit(r)}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => setDeleteRecipe(r)} className="hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
      </div>
    )},
  ];

  return (
    <GestorClientGuard>
    <div className="space-y-6">
      <PageHeader title={t("gestor_products")} subtitle={t("gestor_products_desc")} icon={Package}
        actions={clientId ? <Button onClick={openCreate} className="glow-hover"><Plus className="mr-2 h-4 w-4" />{t("add_product")}</Button> : undefined}
      />

      {recipeProduct ? (
        /* Recipe detail view */
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => { setRecipeProduct(null); setActiveTab("details"); }}>
              ← {t("gestor_products")}
            </Button>
            <h2 className="text-lg font-semibold">{recipeProduct.name} — {t("recipe_tab")}</h2>
          </div>

          <DataTable
            columns={recipeColumns}
            data={recipes}
            keyExtractor={(r) => r.id}
            loading={recipesLoading}
            emptyMessage={t("recipe_empty")}
            emptyActionLabel={t("recipe_add_ingredient")}
            onEmptyAction={openRecipeCreate}
          />
          {recipes.length > 0 && (
            <Button onClick={openRecipeCreate} className="glow-hover">
              <Plus className="mr-2 h-4 w-4" />{t("recipe_add_ingredient")}
            </Button>
          )}
        </div>
      ) : (
        /* Product list */
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
      )}

      {/* Product create/edit modal */}
      <ModalForm open={sheetOpen} onOpenChange={setSheetOpen} title={editing ? t("edit_product") : t("new_product")}
        onSubmit={handleSave} saving={saving} submitLabel={editing ? t("update") : t("create")}
        disabled={!form.name.trim() || !form.price}>
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

        <Separator className="my-2" />
        <p className="text-sm font-semibold text-foreground/80">{t("prod_config")}</p>

        <div className="flex items-center justify-between">
          <Label>{t("prod_sellable")}</Label>
          <Switch checked={form.is_sellable} onCheckedChange={(v) => setForm({ ...form, is_sellable: v })} />
        </div>
        <div className="flex items-center justify-between">
          <Label>{t("prod_stock_tracked")}</Label>
          <Switch checked={form.is_stock_tracked} onCheckedChange={(v) => setForm({ ...form, is_stock_tracked: v })} />
        </div>
        <div className="flex items-center justify-between">
          <Label>{t("prod_ingredient")}</Label>
          <Switch checked={form.is_ingredient} onCheckedChange={(v) => setForm({ ...form, is_ingredient: v })} />
        </div>

        {form.is_stock_tracked && (
          <div className="space-y-3 rounded-lg border border-border/60 p-3 bg-secondary/20">
            <div className="space-y-2">
              <Label>{t("prod_stock_unit")}</Label>
              <Select value={form.stock_unit || "_none"} onValueChange={(v) => setForm({ ...form, stock_unit: v === "_none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {STOCK_UNITS.map(u => <SelectItem key={u.value} value={u.value}>{t(u.label)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("prod_base_unit")}</Label>
              <Select value={form.base_unit || "_none"} onValueChange={(v) => setForm({ ...form, base_unit: v === "_none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {BASE_UNITS.map(u => <SelectItem key={u.value} value={u.value}>{t(u.label)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("prod_base_per_stock_unit")}</Label>
              <Input type="number" min="0.0001" step="any" value={form.base_per_stock_unit}
                onChange={(e) => setForm({ ...form, base_per_stock_unit: e.target.value })} />
            </div>
          </div>
        )}

        {/* Show base_unit for ingredients even when not stock tracked */}
        {form.is_ingredient && !form.is_stock_tracked && (
          <div className="space-y-2 rounded-lg border border-border/60 p-3 bg-secondary/20">
            <Label>{t("prod_base_unit")}</Label>
            <Select value={form.base_unit || "_none"} onValueChange={(v) => setForm({ ...form, base_unit: v === "_none" ? "" : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">—</SelectItem>
                {BASE_UNITS.map(u => <SelectItem key={u.value} value={u.value}>{t(u.label)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Product Image */}
        <ProductImageSection
          productId={editing?.id ?? null}
          productName={form.name}
          currentImagePath={form.image_path}
          imageSource={form.image_source}
          onImageUpdated={(imagePath, imageSource) =>
            setForm((prev) => ({ ...prev, image_path: imagePath, image_source: imageSource }))
          }
        />
      </ModalForm>

      {/* Recipe ingredient modal */}
      <ModalForm open={recipeModalOpen} onOpenChange={setRecipeModalOpen}
        title={editingRecipe ? t("edit") : t("recipe_add_ingredient")}
        onSubmit={handleRecipeSave} saving={recipeSaving}
        submitLabel={editingRecipe ? t("update") : t("create")}
        disabled={!recipeForm.ingredient_product_id || !recipeForm.quantity_base || !recipeForm.base_unit}>
        <div className="space-y-2">
          <Label>{t("recipe_ingredient")}</Label>
          {editingRecipe ? (
            <Input value={ingredientMap.get(editingRecipe.ingredient_product_id)?.name ?? ""} disabled />
          ) : (
            <Select value={recipeForm.ingredient_product_id || "_none"} onValueChange={(v) => handleIngredientChange(v === "_none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder={t("recipe_select_ingredient")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">—</SelectItem>
                {availableIngredients.map(i => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name} {i.base_unit ? `(${i.base_unit})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {availableIngredients.length === 0 && !editingRecipe && (
            <p className="text-xs text-muted-foreground">{t("recipe_no_ingredients_available")}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>{t("recipe_quantity")}</Label>
          <Input type="number" min="0.0001" step="any" value={recipeForm.quantity_base}
            onChange={(e) => setRecipeForm({ ...recipeForm, quantity_base: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>{t("recipe_unit")}</Label>
          <Select value={recipeForm.base_unit || "_none"} onValueChange={(v) => setRecipeForm({ ...recipeForm, base_unit: v === "_none" ? "" : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">—</SelectItem>
              {BASE_UNITS.map(u => <SelectItem key={u.value} value={u.value}>{t(u.label)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </ModalForm>

      {/* Confirm delete recipe */}
      <AlertDialog open={!!deleteRecipe} onOpenChange={(open) => !open && setDeleteRecipe(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("recipe_delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("recipe_delete_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRecipe} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </GestorClientGuard>
  );
}
