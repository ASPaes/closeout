import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPtBrErrorMessage } from "@/lib/error-messages";
import { useGestor } from "@/contexts/GestorContext";
import { useTranslation } from "@/i18n/use-translation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Search, Pencil } from "lucide-react";

type Category = {
  id: string;
  client_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
};

export default function GestorCategorias() {
  const { clientId, isSuperAdmin } = useGestor();
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: "" });
  const [saving, setSaving] = useState(false);

  const fetchCategories = async () => {
    let q = supabase.from("categories").select("id, client_id, name, is_active, created_at").order("name");
    if (!isSuperAdmin && clientId) q = q.eq("client_id", clientId);
    const { data, error } = await q;
    if (error) {
      console.error("categories fetch error", error);
      toast.error(getPtBrErrorMessage(error));
      return;
    }
    setCategories(data ?? []);
  };

  useEffect(() => { fetchCategories(); }, [clientId]);

  const filtered = useMemo(
    () => categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
    [categories, search]
  );

  const openCreate = () => { setEditing(null); setForm({ name: "" }); setSheetOpen(true); };
  const openEdit = (c: Category) => { setEditing(c); setForm({ name: c.name }); setSheetOpen(true); };

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name) return;
    if (!clientId && !isSuperAdmin) return;
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase.from("categories").update({ name }).eq("id", editing.id);
        if (error) throw error;
        toast.success(t("category_updated"));
      } else {
        const cid = clientId!;
        const { error } = await supabase.from("categories").insert({ name, client_id: cid });
        if (error) throw error;
        toast.success(t("category_created"));
      }
      setSheetOpen(false);
      fetchCategories();
    } catch (err: any) {
      console.error("category save error", err);
      toast.error(getPtBrErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (c: Category) => {
    const { error } = await supabase.from("categories").update({ is_active: !c.is_active }).eq("id", c.id);
    if (error) { toast.error(getPtBrErrorMessage(error)); return; }
    toast.success(c.is_active ? t("category_deactivated") : t("category_activated"));
    fetchCategories();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("gestor_categories")}</h1>
          <p className="text-muted-foreground">{t("gestor_categories_desc")}</p>
        </div>
        {clientId && (
          <Button onClick={openCreate} size="sm">
            <Plus className="mr-2 h-4 w-4" /> {t("add_category")}
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("search_categories")} value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">{t("no_categories_found")}</TableCell></TableRow>
              ) : filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <Badge variant={c.is_active ? "default" : "secondary"}>{c.is_active ? t("active") : t("inactive")}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} />
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
            <SheetTitle>{editing ? t("edit_category") : t("new_category")}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <Label>{t("category_name")}</Label>
              <Input value={form.name} onChange={(e) => setForm({ name: e.target.value })} maxLength={100} />
            </div>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="w-full">
              {editing ? t("update") : t("create")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
