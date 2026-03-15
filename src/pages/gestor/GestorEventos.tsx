import { useState, useEffect, useCallback } from "react";
import { GestorClientGuard } from "@/components/GestorClientGuard";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useGestor } from "@/contexts/GestorContext";
import { useTranslation } from "@/i18n/use-translation";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTION } from "@/config/audit-actions";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { ModalForm } from "@/components/ModalForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CalendarDays, Plus, Settings2, Play, CheckCircle2, XCircle, BookOpen, Link2, Unlink, MapPin } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

type Event = {
  id: string;
  name: string;
  description: string | null;
  start_at: string | null;
  end_at: string | null;
  status: string;
  venue_id: string;
  venue_name?: string;
};

type Venue = { id: string; name: string };

type EventCatalogLink = {
  id: string;
  catalog_id: string;
  catalog_name: string;
  is_active: boolean;
  active_item_count: number;
};

const STATUS_OPTIONS = ["draft", "active", "completed", "cancelled"] as const;

export default function GestorEventos() {
  const { t } = useTranslation();
  const { effectiveClientId: clientId } = useGestor();
  const navigate = useNavigate();

  const [events, setEvents] = useState<Event[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Form state
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTab, setFormTab] = useState("general");

  // General fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [venueId, setVenueId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [status, setStatus] = useState<string>("draft");

  // Settings fields
  const [geoRadius, setGeoRadius] = useState("500");
  const [maxOrderValue, setMaxOrderValue] = useState("");
  const [alertMinutes, setAlertMinutes] = useState("15");
  const [stockEnabled, setStockEnabled] = useState(true);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  // Catalogs tab
  const [eventCatalogs, setEventCatalogs] = useState<EventCatalogLink[]>([]);
  const [allCatalogs, setAllCatalogs] = useState<{ id: string; name: string }[]>([]);
  const [linkCatalogId, setLinkCatalogId] = useState("");

  const fetchData = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);

    const [eventsRes, venuesRes] = await Promise.all([
      supabase
        .from("events")
        .select("id, name, description, start_at, end_at, status, venue_id")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false }),
      supabase
        .from("venues")
        .select("id, name")
        .eq("client_id", clientId)
        .eq("status", "active")
        .order("name"),
    ]);

    const vns = venuesRes.data ?? [];
    setVenues(vns);
    const venueMap = new Map(vns.map((v) => [v.id, v.name]));

    setEvents(
      (eventsRes.data ?? []).map((e) => ({
        ...e,
        venue_name: venueMap.get(e.venue_id) ?? "—",
      }))
    );
    setLoading(false);
  }, [clientId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = events.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  // ---- Load platform defaults ----
  const loadDefaults = async () => {
    const { data } = await supabase
      .from("platform_settings")
      .select("default_geo_radius_meters, default_max_order_value, default_unretrieved_order_alert_minutes")
      .limit(1)
      .maybeSingle();
    return {
      geo_radius_meters: data?.default_geo_radius_meters ?? 500,
      max_order_value: data?.default_max_order_value ?? null,
      unretrieved_order_alert_minutes: data?.default_unretrieved_order_alert_minutes ?? 15,
    };
  };

  // ---- Load event catalogs ----
  const loadEventCatalogs = async (eventId: string) => {
    const [linksRes, catalogsRes, itemsRes] = await Promise.all([
      supabase.from("event_catalogs").select("id, catalog_id, is_active").eq("event_id", eventId),
      supabase.from("catalogs").select("id, name").eq("client_id", clientId!).eq("is_active", true).order("name"),
      supabase.from("catalog_items").select("catalog_id, is_active").eq("client_id", clientId!),
    ]);

    const cats = catalogsRes.data ?? [];
    setAllCatalogs(cats);
    const catMap = new Map(cats.map((c) => [c.id, c.name]));

    // Count active items per catalog
    const activeCountMap = new Map<string, number>();
    (itemsRes.data ?? []).forEach((i) => {
      if (i.is_active) activeCountMap.set(i.catalog_id, (activeCountMap.get(i.catalog_id) ?? 0) + 1);
    });

    const links = (linksRes.data ?? []).map((l) => ({
      id: l.id,
      catalog_id: l.catalog_id,
      catalog_name: catMap.get(l.catalog_id) ?? "—",
      is_active: l.is_active,
      active_item_count: activeCountMap.get(l.catalog_id) ?? 0,
    }));

    setEventCatalogs(links);
    setLinkCatalogId("");
  };

  // ---- Open modal ----
  const openCreate = async () => {
    setEditingId(null);
    setName(""); setDescription(""); setVenueId(""); setStartAt(""); setEndAt(""); setStatus("draft");
    setSettingsId(null); setFormTab("general"); setEventCatalogs([]); setAllCatalogs([]);
    const defaults = await loadDefaults();
    setGeoRadius(String(defaults.geo_radius_meters));
    setMaxOrderValue(defaults.max_order_value != null ? String(defaults.max_order_value) : "");
    setAlertMinutes(String(defaults.unretrieved_order_alert_minutes));
    setStockEnabled(true);
    setModalOpen(true);
  };

  const openEdit = async (ev: Event) => {
    setEditingId(ev.id);
    setName(ev.name); setDescription(ev.description ?? ""); setVenueId(ev.venue_id);
    setStartAt(ev.start_at ? ev.start_at.slice(0, 16) : "");
    setEndAt(ev.end_at ? ev.end_at.slice(0, 16) : "");
    setStatus(ev.status); setFormTab("general");

    const { data: settings } = await supabase
      .from("event_settings")
      .select("id, geo_radius_meters, max_order_value, unretrieved_order_alert_minutes, stock_control_enabled")
      .eq("event_id", ev.id)
      .maybeSingle();

    if (settings) {
      setSettingsId(settings.id);
      setGeoRadius(String(settings.geo_radius_meters));
      setMaxOrderValue(settings.max_order_value != null ? String(settings.max_order_value) : "");
      setAlertMinutes(String(settings.unretrieved_order_alert_minutes));
      setStockEnabled(settings.stock_control_enabled);
    } else {
      setSettingsId(null);
      const defaults = await loadDefaults();
      setGeoRadius(String(defaults.geo_radius_meters));
      setMaxOrderValue(defaults.max_order_value != null ? String(defaults.max_order_value) : "");
      setAlertMinutes(String(defaults.unretrieved_order_alert_minutes));
      setStockEnabled(true);
    }

    await loadEventCatalogs(ev.id);
    setModalOpen(true);
  };

  // ---- Save ----
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error(t("gevt_validation_name")); return; }
    if (!venueId) { toast.error(t("gevt_validation_venue")); return; }
    if (startAt && endAt && new Date(endAt) <= new Date(startAt)) { toast.error(t("gevt_validation_dates")); return; }

    setSaving(true);
    const eventPayload = {
      name: name.trim(), description: description.trim() || null, venue_id: venueId, client_id: clientId!,
      start_at: startAt ? new Date(startAt).toISOString() : null, end_at: endAt ? new Date(endAt).toISOString() : null, status,
    };

    let eventId = editingId;
    if (editingId) {
      const { error } = await supabase.from("events").update(eventPayload).eq("id", editingId);
      if (error) { toast.error(t("gevt_save_error")); setSaving(false); return; }
      await logAudit({ action: AUDIT_ACTION.EVENT_UPDATED, entityType: "event", entityId: editingId, newData: eventPayload });
    } else {
      const { data, error } = await supabase.from("events").insert(eventPayload).select("id").single();
      if (error || !data) { toast.error(t("gevt_save_error")); setSaving(false); return; }
      eventId = data.id;
      await logAudit({ action: AUDIT_ACTION.EVENT_CREATED, entityType: "event", entityId: data.id, newData: eventPayload });
    }

    const settingsPayload = {
      event_id: eventId!, client_id: clientId!,
      geo_radius_meters: parseInt(geoRadius, 10) || 500,
      max_order_value: maxOrderValue ? parseFloat(maxOrderValue) : null,
      unretrieved_order_alert_minutes: parseInt(alertMinutes, 10) || 15,
      stock_control_enabled: stockEnabled,
    };
    await supabase.from("event_settings").upsert({ ...settingsPayload, ...(settingsId ? { id: settingsId } : {}) }, { onConflict: "event_id" });

    setSaving(false);
    toast.success(editingId ? t("event_updated") : t("event_created"));
    setModalOpen(false);
    fetchData();
  };

  // ---- Catalog linking ----
  const linkCatalog = async () => {
    if (!linkCatalogId || !editingId) return;
    const { error } = await supabase.from("event_catalogs").insert({ event_id: editingId, client_id: clientId!, catalog_id: linkCatalogId, is_active: true });
    if (error) { toast.error(t("ctlg_save_error")); return; }
    toast.success(t("ctlg_linked"));
    await loadEventCatalogs(editingId);
  };

  const unlinkCatalog = async (linkId: string) => {
    if (!editingId) return;
    await supabase.from("event_catalogs").delete().eq("id", linkId);
    toast.success(t("ctlg_unlinked"));
    await loadEventCatalogs(editingId);
  };

  const toggleCatalogActive = async (link: EventCatalogLink) => {
    if (!editingId) return;
    await supabase.from("event_catalogs").update({ is_active: !link.is_active }).eq("id", link.id);
    await loadEventCatalogs(editingId);
  };

  // ---- Status actions ----
  const changeStatus = async (ev: Event, newStatus: string) => {
    const { error } = await supabase.from("events").update({ status: newStatus }).eq("id", ev.id);
    if (error) { toast.error(t("gevt_save_error")); return; }
    await logAudit({ action: AUDIT_ACTION.EVENT_UPDATED, entityType: "event", entityId: ev.id, newData: { status: newStatus }, oldData: { status: ev.status } });
    toast.success(t("event_updated"));
    fetchData();
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { draft: t("draft"), active: t("active"), completed: t("completed"), cancelled: t("cancelled") };
    return map[s] ?? s;
  };

  const statusVariant = (s: string): "draft" | "active" | "completed" | "cancelled" | "inactive" => {
    if (s === "draft") return "draft";
    if (s === "active") return "active";
    if (s === "completed") return "completed";
    if (s === "cancelled") return "cancelled";
    return "inactive";
  };

  // Already linked catalog IDs
  const linkedCatalogIds = new Set(eventCatalogs.map((ec) => ec.catalog_id));
  const availableCatalogs = allCatalogs.filter((c) => !linkedCatalogIds.has(c.id));

  const columns: DataTableColumn<Event>[] = [
    {
      key: "name", header: t("name"),
      render: (r) => <button onClick={() => openEdit(r)} className="font-medium text-primary hover:underline text-left">{r.name}</button>,
    },
    { key: "venue", header: t("venue"), render: (r) => <span className="text-muted-foreground">{r.venue_name}</span> },
    {
      key: "start", header: t("start"), className: "w-40",
      render: (r) => r.start_at ? <span className="text-sm">{new Date(r.start_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</span> : <span className="text-muted-foreground">—</span>,
    },
    {
      key: "end", header: t("end"), className: "w-40",
      render: (r) => r.end_at ? <span className="text-sm">{new Date(r.end_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</span> : <span className="text-muted-foreground">—</span>,
    },
    { key: "status", header: "Status", className: "w-32", render: (r) => <StatusBadge status={statusVariant(r.status)} label={statusLabel(r.status)} /> },
    {
      key: "actions", header: "", className: "w-40 text-right",
      render: (r) => (
        <div className="flex gap-1 justify-end">
          {r.status === "draft" && <Button size="sm" variant="ghost" onClick={() => changeStatus(r, "active")} title={t("gevt_activate")}><Play className="h-4 w-4 text-success" /></Button>}
          {r.status === "active" && <Button size="sm" variant="ghost" onClick={() => changeStatus(r, "completed")} title={t("complete_event")}><CheckCircle2 className="h-4 w-4 text-info" /></Button>}
          {(r.status === "draft" || r.status === "active") && <Button size="sm" variant="ghost" onClick={() => changeStatus(r, "cancelled")} title={t("gevt_cancel")}><XCircle className="h-4 w-4 text-destructive" /></Button>}
          <Button size="sm" variant="ghost" onClick={() => openEdit(r)} title={t("edit_event")}><Settings2 className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("events")} subtitle={t("gevt_subtitle")} icon={CalendarDays}
        actions={<Button onClick={openCreate} className="glow-hover"><Plus className="mr-2 h-4 w-4" />{t("create_event")}</Button>}
      />

      <DataTable columns={columns} data={filtered} keyExtractor={(r) => r.id} loading={loading}
        search={search} onSearchChange={setSearch} searchPlaceholder={t("search_events")}
        emptyMessage={t("no_events_found")} emptyHint={t("gevt_empty_hint")}
        emptyActionLabel={t("create_event")} onEmptyAction={openCreate}
      />

      <ModalForm open={modalOpen} onOpenChange={setModalOpen} title={editingId ? t("edit_event") : t("new_event")} onSubmit={handleSave} saving={saving} disabled={venues.length === 0 && !editingId}>
        <Tabs value={formTab} onValueChange={setFormTab} className="w-full">
          <TabsList className={`grid w-full ${editingId ? "grid-cols-3" : "grid-cols-2"}`}>
            <TabsTrigger value="general">{t("gevt_tab_general")}</TabsTrigger>
            <TabsTrigger value="settings">{t("gevt_tab_settings")}</TabsTrigger>
            {editingId && <TabsTrigger value="catalogs">{t("ctlg_title")}</TabsTrigger>}
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>{t("name")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("gevt_name_placeholder")} />
            </div>
            <div className="space-y-2">
              <Label>{t("description")}</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>{t("venue")}</Label>
              {venues.length === 0 ? (
                <div className="rounded-lg border border-border/60 p-4">
                  <EmptyState
                    message={t("no_venues_found")}
                    hint={t("gevt_no_venues_hint")}
                    actionLabel={t("gevt_create_venue")}
                    onAction={() => navigate("/gestor/locais")}
                    icon={MapPin}
                  />
                </div>
              ) : (
                <Select value={venueId} onValueChange={setVenueId}>
                  <SelectTrigger><SelectValue placeholder={t("select_venue")} /></SelectTrigger>
                  <SelectContent>{venues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("start")}</Label>
                <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("end")}</Label>
                <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
              </div>
            </div>
            {editingId && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </TabsContent>

          <TabsContent value="settings" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>{t("geo_radius_meters")}</Label>
              <Input type="number" min={0} value={geoRadius} onChange={(e) => setGeoRadius(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("max_order_value")}</Label>
              <Input type="number" min={0} step="0.01" value={maxOrderValue} onChange={(e) => setMaxOrderValue(e.target.value)} placeholder={t("gevt_no_limit")} />
            </div>
            <div className="space-y-2">
              <Label>{t("unretrieved_order_alert")}</Label>
              <Input type="number" min={0} value={alertMinutes} onChange={(e) => setAlertMinutes(e.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <Label className="cursor-pointer">{t("stock_control")}</Label>
              <Switch checked={stockEnabled} onCheckedChange={setStockEnabled} />
            </div>
          </TabsContent>

          {editingId && (
            <TabsContent value="catalogs" className="space-y-4 mt-4">
              {/* Link catalog */}
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">{t("ctlg_link")}</Label>
                  <Select value={linkCatalogId} onValueChange={setLinkCatalogId}>
                    <SelectTrigger className="h-9"><SelectValue placeholder={t("ctlg_select_catalog")} /></SelectTrigger>
                    <SelectContent>
                      {availableCatalogs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" size="sm" onClick={linkCatalog} disabled={!linkCatalogId} className="h-9">
                  <Link2 className="h-4 w-4 mr-1" /> {t("ctlg_link")}
                </Button>
              </div>

              {eventCatalogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t("ctlg_no_catalogs")}</p>
              ) : (
                <div className="space-y-1">
                  {eventCatalogs.map((ec) => (
                    <div key={ec.id} className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{ec.catalog_name}</span>
                        <Badge variant="secondary" className="text-[10px]">{ec.active_item_count} {t("ctlg_active_items")}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={ec.is_active} onCheckedChange={() => toggleCatalogActive(ec)} />
                        <Button type="button" size="sm" variant="ghost" onClick={() => unlinkCatalog(ec.id)} title={t("ctlg_unlink")}>
                          <Unlink className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </ModalForm>
    </div>
  );
}
