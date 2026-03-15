import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPtBrErrorMessage } from "@/lib/error-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, MapPin } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import { ENTITY_STATUS } from "@/config";
import { logAudit } from "@/lib/audit";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { ModalForm } from "@/components/ModalForm";

type Venue = { id: string; client_id: string; name: string; address: string | null; city: string | null; state: string | null; latitude: number | null; longitude: number | null; status: string; clients?: { name: string } };
type Client = { id: string; name: string };

export default function Venues() {
  const { isSuperAdmin, hasRole } = useAuth();
  const { t } = useTranslation();
  const canManage = isSuperAdmin || hasRole("client_admin");
  const [venues, setVenues] = useState<Venue[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState<string>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Venue | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", client_id: "", address: "", city: "", state: "", latitude: "", longitude: "", status: ENTITY_STATUS.ACTIVE as string });

  const fetchData = async () => {
    setLoading(true);
    const [v, c] = await Promise.all([
      supabase.from("venues").select("*, clients(name)").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, name").eq("status", ENTITY_STATUS.ACTIVE),
    ]);
    if (v.error) toast.error(getPtBrErrorMessage(v.error));
    if (c.error) toast.error(getPtBrErrorMessage(c.error));
    if (v.data) setVenues(v.data as Venue[]);
    if (c.data) setClients(c.data as Client[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => { setEditing(null); setForm({ name: "", client_id: clients[0]?.id || "", address: "", city: "", state: "", latitude: "", longitude: "", status: ENTITY_STATUS.ACTIVE as string }); setSheetOpen(true); };
  const openEdit = (venue: Venue) => {
    setEditing(venue);
    setForm({ name: venue.name, client_id: venue.client_id, address: venue.address || "", city: venue.city || "", state: venue.state || "", latitude: venue.latitude?.toString() || "", longitude: venue.longitude?.toString() || "", status: venue.status });
    setSheetOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name, client_id: form.client_id, address: form.address || null,
      city: form.city || null, state: form.state || null,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      status: form.status,
    };
    if (editing) {
      const { error } = await supabase.from("venues").update(payload).eq("id", editing.id);
      if (error) { toast.error(getPtBrErrorMessage(error)); setSaving(false); return; }
      await logAudit({ action: "venue.updated", entityType: "venue", entityId: editing.id, metadata: { name: payload.name, client_id: payload.client_id, previous_status: editing.status, new_status: payload.status }, oldData: { name: editing.name, status: editing.status }, newData: payload });
      toast.success(t("venue_updated"));
    } else {
      const { data, error } = await supabase.from("venues").insert(payload).select("id").single();
      if (error) { toast.error(getPtBrErrorMessage(error)); setSaving(false); return; }
      if (data) await logAudit({ action: "venue.created", entityType: "venue", entityId: data.id, metadata: { name: payload.name, client_id: payload.client_id }, newData: payload });
      toast.success(t("venue_created"));
    }
    setSaving(false);
    setSheetOpen(false); fetchData();
  };

  const toggleStatus = async (venue: Venue) => {
    if (!canManage) return;
    const newStatus = venue.status === ENTITY_STATUS.ACTIVE ? ENTITY_STATUS.INACTIVE : ENTITY_STATUS.ACTIVE;
    const { error } = await supabase.from("venues").update({ status: newStatus }).eq("id", venue.id);
    if (error) { toast.error(getPtBrErrorMessage(error)); return; }
    await logAudit({ action: "venue.updated", entityType: "venue", entityId: venue.id, metadata: { name: venue.name, client_id: venue.client_id, previous_status: venue.status, new_status: newStatus }, oldData: { status: venue.status }, newData: { status: newStatus } });
    toast.success(newStatus === ENTITY_STATUS.ACTIVE ? t("venue_activated") : t("venue_deactivated"));
    fetchData();
  };

  const filtered = venues.filter((v) => filterClient === "all" || v.client_id === filterClient).filter((v) => v.name.toLowerCase().includes(search.toLowerCase()));

  const columns: DataTableColumn<Venue>[] = [
    { key: "name", header: t("name"), render: (v) => <span className="font-medium">{v.name}</span> },
    { key: "client", header: t("client"), render: (v) => <span className="text-muted-foreground">{v.clients?.name || "—"}</span> },
    { key: "city", header: t("city"), render: (v) => <span className="text-muted-foreground">{v.city || "—"}</span> },
    { key: "status", header: t("status"), render: (v) => (
      <StatusBadge status={v.status === ENTITY_STATUS.ACTIVE ? "active" : "inactive"} label={v.status === ENTITY_STATUS.ACTIVE ? t("active") : t("inactive")} onClick={() => toggleStatus(v)} />
    )},
    ...(canManage ? [{ key: "actions", header: t("actions"), className: "w-20", render: (v: Venue) => (
      <Button variant="ghost" size="icon" onClick={() => openEdit(v)} className="hover:text-primary"><Pencil className="h-4 w-4" /></Button>
    )}] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("venues")} subtitle={t("manage_venues")} icon={MapPin}
        actions={canManage ? <Button onClick={openCreate} className="glow-hover"><Plus className="mr-2 h-4 w-4" />{t("add_venue")}</Button> : undefined}
      />

      <DataTable
        columns={columns} data={filtered} keyExtractor={(v) => v.id}
        loading={loading} search={search} onSearchChange={setSearch} searchPlaceholder={t("search_venues")}
        emptyMessage={t("no_venues_found")}
        filters={
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-48 bg-secondary/50 border-border/60"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("all_clients")}</SelectItem>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      <ModalForm open={sheetOpen} onOpenChange={setSheetOpen} title={editing ? t("edit_venue") : t("new_venue")}
        onSubmit={handleSubmit} saving={saving} submitLabel={editing ? t("update") : t("create")}>
        <div className="space-y-2">
          <Label>{t("client")}</Label>
          <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
            <SelectTrigger><SelectValue placeholder={t("select_client")} /></SelectTrigger>
            <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>{t("name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div className="space-y-2"><Label>{t("address")}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>{t("city")}</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div className="space-y-2"><Label>{t("state")}</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>{t("latitude")}</Label><Input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="-23.5505" /></div>
          <div className="space-y-2"><Label>{t("longitude")}</Label><Input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="-46.6333" /></div>
        </div>
        <div className="space-y-2">
          <Label>{t("status")}</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ENTITY_STATUS.ACTIVE}>{t("active")}</SelectItem>
              <SelectItem value={ENTITY_STATUS.INACTIVE}>{t("inactive")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </ModalForm>
    </div>
  );
}
