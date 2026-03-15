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
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Megaphone, Trash2, CalendarIcon, Tag } from "lucide-react";
import { format } from "date-fns";
import { ptBR as ptBRLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { ModalForm } from "@/components/ModalForm";
import { Separator } from "@/components/ui/separator";

type Campaign = {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  item_count?: number;
};

type CampaignItem = {
  id?: string;
  item_type: "product" | "combo";
  product_id: string | null;
  combo_id: string | null;
  promo_price: string;
  discount_percent: string;
  is_active: boolean;
};

type Product = { id: string; name: string; price: number };
type Combo = { id: string; name: string; price: number };

type CampaignForm = {
  name: string;
  description: string;
  starts_at: Date | undefined;
  ends_at: Date | undefined;
};

const emptyForm: CampaignForm = { name: "", description: "", starts_at: undefined, ends_at: undefined };

export default function GestorCampanhas() {
  const { effectiveClientId: clientId } = useGestor();
  const { t } = useTranslation();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [form, setForm] = useState<CampaignForm>(emptyForm);
  const [items, setItems] = useState<CampaignItem[]>([]);
  const [originalItems, setOriginalItems] = useState<CampaignItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [removeConfirm, setRemoveConfirm] = useState<number | null>(null);

  const fetchCampaigns = async () => {
    setLoading(true);
    let q = supabase.from("campaigns").select("id, client_id, name, description, starts_at, ends_at, is_active").order("starts_at", { ascending: false });
    if (!isSuperAdmin && clientId) q = q.eq("client_id", clientId);
    const { data, error } = await q;
    if (error) toast.error(getPtBrErrorMessage(error));

    const list = (data as Campaign[]) ?? [];
    if (list.length > 0) {
      const { data: itemData } = await supabase
        .from("campaign_items")
        .select("campaign_id")
        .in("campaign_id", list.map((c) => c.id));
      const countMap = new Map<string, number>();
      (itemData ?? []).forEach((row: { campaign_id: string }) => {
        countMap.set(row.campaign_id, (countMap.get(row.campaign_id) ?? 0) + 1);
      });
      list.forEach((c) => { c.item_count = countMap.get(c.id) ?? 0; });
    }
    setCampaigns(list);
    setLoading(false);
  };

  const fetchProducts = async () => {
    let q = supabase.from("products").select("id, name, price").eq("is_active", true).order("name");
    if (!isSuperAdmin && clientId) q = q.eq("client_id", clientId);
    const { data } = await q;
    setProducts(data ?? []);
  };

  const fetchCombos = async () => {
    let q = supabase.from("combos").select("id, name, price").eq("is_active", true).order("name");
    if (!isSuperAdmin && clientId) q = q.eq("client_id", clientId);
    const { data } = await q;
    setCombos((data as Combo[]) ?? []);
  };

  useEffect(() => {
    fetchCampaigns();
    fetchProducts();
    fetchCombos();
  }, [clientId]);

  const filtered = useMemo(
    () => campaigns.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase())),
    [campaigns, search]
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setItems([]);
    setOriginalItems([]);
    setSheetOpen(true);
  };

  const openEdit = async (campaign: Campaign) => {
    setEditing(campaign);
    setForm({
      name: campaign.name,
      description: campaign.description ?? "",
      starts_at: new Date(campaign.starts_at),
      ends_at: new Date(campaign.ends_at),
    });

    const { data } = await supabase
      .from("campaign_items")
      .select("id, item_type, product_id, combo_id, promo_price, discount_percent, is_active")
      .eq("campaign_id", campaign.id);

    const loaded: CampaignItem[] = (data ?? []).map((d: any) => ({
      id: d.id,
      item_type: d.item_type,
      product_id: d.product_id,
      combo_id: d.combo_id,
      promo_price: d.promo_price != null ? String(d.promo_price) : "",
      discount_percent: d.discount_percent != null ? String(d.discount_percent) : "",
      is_active: d.is_active,
    }));
    setItems(loaded.map((i) => ({ ...i })));
    setOriginalItems(loaded.map((i) => ({ ...i })));
    setSheetOpen(true);
  };

  const isFormValid = form.name.trim().length > 0 && form.starts_at && form.ends_at && form.ends_at > form.starts_at;

  const validateItems = (): boolean => {
    for (const item of items) {
      const pp = item.promo_price ? parseFloat(item.promo_price) : null;
      const dp = item.discount_percent ? parseFloat(item.discount_percent) : null;

      if (pp === null && dp === null) {
        toast.error(t("camp_validation_item_pricing"));
        return false;
      }
      if (pp !== null && (isNaN(pp) || pp <= 0)) {
        toast.error(t("camp_validation_promo_positive"));
        return false;
      }
      if (dp !== null && (isNaN(dp) || dp < 1 || dp > 100)) {
        toast.error(t("camp_validation_discount_range"));
        return false;
      }
    }
    return true;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) { toast.error(t("camp_validation_name")); return; }
    if (!form.starts_at || !form.ends_at) { toast.error(t("camp_validation_dates")); return; }
    if (form.ends_at <= form.starts_at) { toast.error(t("camp_validation_end_after_start")); return; }
    if (!clientId && !isSuperAdmin) return;

    if (!validateItems()) return;

    setSaving(true);
    try {
      let campaignId: string;
      const payload = {
        name,
        description: form.description.trim() || null,
        starts_at: form.starts_at.toISOString(),
        ends_at: form.ends_at.toISOString(),
      };

      if (editing) {
        const { error } = await supabase.from("campaigns").update(payload).eq("id", editing.id);
        if (error) throw error;
        campaignId = editing.id;
      } else {
        const { data, error } = await supabase
          .from("campaigns")
          .insert({ ...payload, client_id: clientId! })
          .select("id")
          .single();
        if (error) throw error;
        campaignId = data.id;
      }

      await syncCampaignItems(campaignId, items, originalItems);
      toast.success(editing ? t("camp_updated") : t("camp_created"));
      setSheetOpen(false);
      fetchCampaigns();
    } catch (err: any) {
      toast.error(getPtBrErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const syncCampaignItems = async (campaignId: string, current: CampaignItem[], original: CampaignItem[]) => {
    const currentIds = new Set(current.filter((i) => i.id).map((i) => i.id!));

    const toDelete = original.filter((i) => i.id && !currentIds.has(i.id!));
    if (toDelete.length > 0) {
      const { error } = await supabase.from("campaign_items").delete().in("id", toDelete.map((i) => i.id!));
      if (error) throw error;
    }

    const toInsert = current.filter((i) => !i.id);
    if (toInsert.length > 0) {
      const { error } = await supabase.from("campaign_items").insert(
        toInsert.map((i) => ({
          campaign_id: campaignId,
          item_type: i.item_type,
          product_id: i.item_type === "product" ? i.product_id : null,
          combo_id: i.item_type === "combo" ? i.combo_id : null,
          promo_price: i.promo_price ? parseFloat(i.promo_price) : null,
          discount_percent: i.discount_percent ? parseFloat(i.discount_percent) : null,
          is_active: i.is_active,
        }))
      );
      if (error) throw error;
    }

    const toUpdate = current.filter((i) => {
      if (!i.id) return false;
      const orig = original.find((o) => o.id === i.id);
      if (!orig) return false;
      return (
        orig.item_type !== i.item_type ||
        orig.product_id !== i.product_id ||
        orig.combo_id !== i.combo_id ||
        orig.promo_price !== i.promo_price ||
        orig.discount_percent !== i.discount_percent ||
        orig.is_active !== i.is_active
      );
    });
    for (const item of toUpdate) {
      const { error } = await supabase
        .from("campaign_items")
        .update({
          item_type: item.item_type,
          product_id: item.item_type === "product" ? item.product_id : null,
          combo_id: item.item_type === "combo" ? item.combo_id : null,
          promo_price: item.promo_price ? parseFloat(item.promo_price) : null,
          discount_percent: item.discount_percent ? parseFloat(item.discount_percent) : null,
          is_active: item.is_active,
        })
        .eq("id", item.id!);
      if (error) throw error;
    }
  };

  const toggleActive = async (campaign: Campaign) => {
    // Block activation without items
    if (!campaign.is_active && (campaign.item_count ?? 0) === 0) {
      toast.error(t("camp_activate_needs_items"));
      return;
    }

    const { error } = await supabase.from("campaigns").update({ is_active: !campaign.is_active }).eq("id", campaign.id);
    if (error) { toast.error(getPtBrErrorMessage(error)); return; }
    toast.success(campaign.is_active ? t("camp_deactivated") : t("camp_activated"));
    fetchCampaigns();
  };

  const addItem = () => {
    const defaultType: "product" | "combo" = products.length > 0 ? "product" : "combo";
    const defaultTarget = defaultType === "product" ? products[0]?.id ?? null : combos[0]?.id ?? null;
    if (!defaultTarget) { toast.error(t("camp_no_items_available")); return; }

    setItems([
      ...items,
      {
        item_type: defaultType,
        product_id: defaultType === "product" ? defaultTarget : null,
        combo_id: defaultType === "combo" ? defaultTarget : null,
        promo_price: "",
        discount_percent: "",
        is_active: true,
      },
    ]);
  };

  const confirmRemoveItem = (index: number) => setRemoveConfirm(index);
  const executeRemoveItem = () => {
    if (removeConfirm !== null) {
      setItems(items.filter((_, i) => i !== removeConfirm));
      setRemoveConfirm(null);
    }
  };

  const updateItem = (index: number, updates: Partial<CampaignItem>) => {
    setItems(items.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, ...updates };
      // Reset target when type changes
      if (updates.item_type && updates.item_type !== item.item_type) {
        if (updates.item_type === "product") {
          updated.product_id = products[0]?.id ?? null;
          updated.combo_id = null;
        } else {
          updated.combo_id = combos[0]?.id ?? null;
          updated.product_id = null;
        }
      }
      return updated;
    }));
  };

  const formatPrice = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const formatDate = (d: string) => format(new Date(d), "dd/MM/yyyy HH:mm");

  const getCampaignStatus = (c: Campaign) => {
    if (!c.is_active) return { status: "inactive" as const, label: t("inactive") };
    const now = new Date();
    const start = new Date(c.starts_at);
    const end = new Date(c.ends_at);
    if (now < start) return { status: "draft" as const, label: t("camp_scheduled") };
    if (now > end) return { status: "inactive" as const, label: t("camp_ended") };
    return { status: "active" as const, label: t("active") };
  };

  const columns: DataTableColumn<Campaign>[] = [
    { key: "name", header: t("name"), render: (c) => <span className="font-medium">{c.name}</span> },
    {
      key: "period",
      header: t("camp_period"),
      render: (c) => (
        <div className="text-sm text-muted-foreground">
          <span>{formatDate(c.starts_at)}</span>
          <span className="mx-1">→</span>
          <span>{formatDate(c.ends_at)}</span>
        </div>
      ),
    },
    {
      key: "items",
      header: t("camp_items_label"),
      render: (c) => (
        <Badge variant="secondary" className="font-mono text-xs">
          <Tag className="mr-1 h-3 w-3" />
          {c.item_count ?? 0} {(c.item_count ?? 0) === 1 ? "item" : "itens"}
        </Badge>
      ),
    },
    {
      key: "status",
      header: t("status"),
      render: (c) => {
        const s = getCampaignStatus(c);
        return <StatusBadge status={s.status} label={s.label} />;
      },
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
        title={t("gestor_campaigns")}
        subtitle={t("gestor_campaigns_desc")}
        icon={Megaphone}
        actions={
          clientId ? (
            <Button onClick={openCreate} className="glow-hover">
              <Plus className="mr-2 h-4 w-4" />
              {t("camp_add")}
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
        searchPlaceholder={t("camp_search")}
        emptyMessage={t("camp_not_found")}
        emptyHint={t("camp_empty_hint")}
        emptyActionLabel={clientId ? t("camp_add") : undefined}
        onEmptyAction={clientId ? openCreate : undefined}
      />

      <ModalForm
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={editing ? t("camp_edit") : t("camp_new")}
        onSubmit={handleSave}
        saving={saving}
        submitLabel={editing ? t("update") : t("create")}
        disabled={!isFormValid}
      >
        <div className="space-y-2">
          <Label>{t("name")} *</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={150} autoFocus />
        </div>
        <div className="space-y-2">
          <Label>{t("description")}</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} rows={3} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>{t("start")} *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.starts_at && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.starts_at ? format(form.starts_at, "dd/MM/yyyy") : t("camp_select_date")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={form.starts_at}
                  onSelect={(d) => setForm({ ...form, starts_at: d })}
                  locale={ptBRLocale}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label>{t("end")} *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.ends_at && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.ends_at ? format(form.ends_at, "dd/MM/yyyy") : t("camp_select_date")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={form.ends_at}
                  onSelect={(d) => setForm({ ...form, ends_at: d })}
                  locale={ptBRLocale}
                  disabled={(date) => form.starts_at ? date <= form.starts_at : false}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {form.starts_at && form.ends_at && form.ends_at <= form.starts_at && (
          <p className="text-xs text-destructive">{t("camp_validation_end_after_start")}</p>
        )}

        <Separator className="my-4" />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-semibold">{t("camp_items_label")}</Label>
              <Badge variant="outline" className="text-xs font-mono">{items.length}</Badge>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="mr-1 h-3 w-3" />
              {t("camp_add_item")}
            </Button>
          </div>

          {items.length === 0 && (
            <div className="rounded-lg border border-dashed border-border/60 p-6 text-center">
              <Tag className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t("camp_no_items")}</p>
            </div>
          )}

          {items.map((item, index) => (
            <div key={index} className="rounded-md border border-border/40 bg-secondary/30 p-3 space-y-2">
              <div className="flex items-center gap-2">
                {/* Type selector */}
                <Select value={item.item_type} onValueChange={(v) => updateItem(index, { item_type: v as "product" | "combo" })}>
                  <SelectTrigger className="w-28 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">{t("camp_type_product")}</SelectItem>
                    <SelectItem value="combo">{t("camp_type_combo")}</SelectItem>
                  </SelectContent>
                </Select>

                {/* Target selector */}
                {item.item_type === "product" ? (
                  <Select value={item.product_id ?? ""} onValueChange={(v) => updateItem(index, { product_id: v })}>
                    <SelectTrigger className="flex-1 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name} — {formatPrice(p.price)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={item.combo_id ?? ""} onValueChange={(v) => updateItem(index, { combo_id: v })}>
                    <SelectTrigger className="flex-1 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {combos.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name} — {formatPrice(c.price)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Button type="button" variant="ghost" size="icon" onClick={() => confirmRemoveItem(index)} className="hover:text-destructive shrink-0">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("camp_promo_price")}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    value={item.promo_price}
                    onChange={(e) => updateItem(index, { promo_price: e.target.value })}
                    className="bg-background"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("camp_discount_percent")}</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    placeholder="0%"
                    value={item.discount_percent}
                    onChange={(e) => updateItem(index, { discount_percent: e.target.value })}
                    className="bg-background"
                  />
                </div>
                <div className="flex items-center gap-1 pt-4">
                  <Switch checked={item.is_active} onCheckedChange={(v) => updateItem(index, { is_active: v })} />
                </div>
              </div>

              {/* Discount preview + validation */}
              <div className="flex items-center gap-2 flex-wrap">
                {item.promo_price && parseFloat(item.promo_price) > 0 && (
                  <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                    {t("camp_preview_promo")}
                  </Badge>
                )}
                {item.discount_percent && parseFloat(item.discount_percent) >= 1 && parseFloat(item.discount_percent) <= 100 && (
                  <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                    {item.discount_percent}% off
                  </Badge>
                )}
                {item.promo_price && parseFloat(item.promo_price) <= 0 && (
                  <p className="text-xs text-destructive">{t("camp_validation_promo_positive")}</p>
                )}
                {item.discount_percent && (parseFloat(item.discount_percent) < 1 || parseFloat(item.discount_percent) > 100) && (
                  <p className="text-xs text-destructive">{t("camp_validation_discount_range")}</p>
                )}
                {!item.promo_price && !item.discount_percent && (
                  <p className="text-xs text-destructive">{t("camp_validation_item_pricing")}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </ModalForm>

      <AlertDialog open={removeConfirm !== null} onOpenChange={(open) => { if (!open) setRemoveConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("camp_remove_item_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("camp_remove_item_desc")}</AlertDialogDescription>
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
