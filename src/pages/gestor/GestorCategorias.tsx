import { useEffect, useState, useMemo } from "react";
import { GestorClientGuard } from "@/components/GestorClientGuard";
import { supabase } from "@/integrations/supabase/client";
import { getPtBrErrorMessage } from "@/lib/error-messages";
import { useGestor } from "@/contexts/GestorContext";
import { useTranslation } from "@/i18n/use-translation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Tags } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { ModalForm } from "@/components/ModalForm";

type Category = { id: string; client_id: string; name: string; is_active: boolean; created_at: string };

export default function GestorCategorias() {
  const { effectiveClientId: clientId } = useGestor();
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: "" });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchCategories = async () => {
    setLoading(true);
    let q = supabase.from("categories").select("id, client_id, name, is_active, created_at").order("name");
    if (!isSuperAdmin && clientId) q = q.eq("client_id", clientId);
    const { data, error } = await q;
    if (error) { toast.error(getPtBrErrorMessage(error)); }
    setCategories(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchCategories(); }, [clientId]);

  const filtered = useMemo(() => categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())), [categories, search]);

  const openCreate = () => { setEditing(null); setForm({ name: "" }); setSheetOpen(true); };
  const openEdit = (c: Category) => { setEditing(c); setForm({ name: c.name }); setSheetOpen(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name || (!clientId && !isSuperAdmin)) return;
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase.from("categories").update({ name }).eq("id", editing.id);
        if (error) throw error;
        toast.success(t("category_updated"));
      } else {
        const { error } = await supabase.from("categories").insert({ name, client_id: clientId! });
        if (error) throw error;
        toast.success(t("category_created"));
      }
      setSheetOpen(false); fetchCategories();
    } catch (err: any) {
      toast.error(getPtBrErrorMessage(err));
    } finally { setSaving(false); }
  };

  const toggleActive = async (c: Category) => {
    const { error } = await supabase.from("categories").update({ is_active: !c.is_active }).eq("id", c.id);
    if (error) { toast.error(getPtBrErrorMessage(error)); return; }
    toast.success(c.is_active ? t("category_deactivated") : t("category_activated"));
    fetchCategories();
  };

  const columns: DataTableColumn<Category>[] = [
    { key: "name", header: t("name"), render: (c) => <span className="font-medium">{c.name}</span> },
    { key: "status", header: t("status"), render: (c) => <StatusBadge status={c.is_active ? "active" : "inactive"} label={c.is_active ? t("active") : t("inactive")} /> },
    { key: "actions", header: t("actions"), className: "w-28 text-right", render: (c) => (
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="icon" onClick={() => openEdit(c)} className="hover:text-primary"><Pencil className="h-4 w-4" /></Button>
        <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} />
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("gestor_categories")} subtitle={t("gestor_categories_desc")} icon={Tags}
        actions={clientId ? <Button onClick={openCreate} className="glow-hover"><Plus className="mr-2 h-4 w-4" />{t("add_category")}</Button> : undefined}
      />

      <DataTable
        columns={columns} data={filtered} keyExtractor={(c) => c.id}
        loading={loading} search={search} onSearchChange={setSearch} searchPlaceholder={t("search_categories")}
        emptyMessage={t("no_categories_found")}
        emptyActionLabel={clientId ? t("add_category") : undefined}
        onEmptyAction={clientId ? openCreate : undefined}
      />

      <ModalForm open={sheetOpen} onOpenChange={setSheetOpen} title={editing ? t("edit_category") : t("new_category")}
        onSubmit={handleSave} saving={saving} submitLabel={editing ? t("update") : t("create")} disabled={!form.name.trim()}>
        <div className="space-y-2">
          <Label>{t("category_name")}</Label>
          <Input value={form.name} onChange={(e) => setForm({ name: e.target.value })} maxLength={100} autoFocus />
        </div>
      </ModalForm>
    </div>
  );
}
