import { useState, useEffect, useCallback } from "react";
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
import { toast } from "sonner";
import { MapPin, Plus, Pencil, ToggleLeft, ToggleRight } from "lucide-react";
import { LocationPicker } from "@/components/LocationPicker";

type Venue = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  created_at: string;
};

export default function GestorLocais() {
  const { t } = useTranslation();
  const { clientId } = useGestor();

  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  const fetchData = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const { data } = await supabase
      .from("venues")
      .select("id, name, address, city, state, latitude, longitude, status, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    setVenues(data ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = venues.filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    (v.city ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingId(null);
    setName(""); setAddress(""); setCity(""); setState(""); setLatitude(""); setLongitude("");
    setModalOpen(true);
  };

  const openEdit = (v: Venue) => {
    setEditingId(v.id);
    setName(v.name);
    setAddress(v.address ?? "");
    setCity(v.city ?? "");
    setState(v.state ?? "");
    setLatitude(v.latitude != null ? String(v.latitude) : "");
    setLongitude(v.longitude != null ? String(v.longitude) : "");
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error(t("gvn_validation_name")); return; }
    if (!city.trim()) { toast.error(t("gvn_validation_city")); return; }
    if (!state.trim()) { toast.error(t("gvn_validation_state")); return; }

    const latVal = latitude ? parseFloat(latitude) : null;
    const lngVal = longitude ? parseFloat(longitude) : null;

    if ((latVal != null && lngVal == null) || (latVal == null && lngVal != null)) {
      toast.error(t("gvn_validation_lat_lng_pair")); return;
    }
    if (latVal != null && (latVal < -90 || latVal > 90)) {
      toast.error(t("gvn_validation_lat_range")); return;
    }
    if (lngVal != null && (lngVal < -180 || lngVal > 180)) {
      toast.error(t("gvn_validation_lng_range")); return;
    }

    setSaving(true);
    const payload = {
      name: name.trim(),
      address: address.trim() || null,
      city: city.trim(),
      state: state.trim(),
      latitude: latVal,
      longitude: lngVal,
      client_id: clientId!,
    };

    if (editingId) {
      const { error } = await supabase.from("venues").update(payload).eq("id", editingId);
      if (error) { toast.error(t("gvn_save_error")); setSaving(false); return; }
      await logAudit({ action: AUDIT_ACTION.VENUE_UPDATED, entityType: "venue", entityId: editingId, newData: payload });
      toast.success(t("venue_updated"));
    } else {
      const { data, error } = await supabase.from("venues").insert(payload).select("id").single();
      if (error || !data) { toast.error(t("gvn_save_error")); setSaving(false); return; }
      await logAudit({ action: AUDIT_ACTION.VENUE_CREATED, entityType: "venue", entityId: data.id, newData: payload });
      toast.success(t("venue_created"));
    }

    setSaving(false);
    setModalOpen(false);
    fetchData();
  };

  const toggleStatus = async (v: Venue) => {
    const newStatus = v.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("venues").update({ status: newStatus }).eq("id", v.id);
    if (error) { toast.error(t("gvn_save_error")); return; }
    await logAudit({
      action: AUDIT_ACTION.VENUE_UPDATED, entityType: "venue", entityId: v.id,
      oldData: { status: v.status }, newData: { status: newStatus },
      metadata: { toggle: newStatus === "active" ? "activated" : "deactivated" },
    });
    toast.success(newStatus === "active" ? t("venue_activated") : t("venue_deactivated"));
    fetchData();
  };

  const columns: DataTableColumn<Venue>[] = [
    {
      key: "name", header: t("name"),
      render: (r) => <button onClick={() => openEdit(r)} className="font-medium text-primary hover:underline text-left">{r.name}</button>,
    },
    { key: "city", header: t("city"), render: (r) => <span className="text-muted-foreground">{r.city ?? "—"}</span> },
    { key: "state", header: t("state"), className: "w-20", render: (r) => <span className="text-muted-foreground">{r.state ?? "—"}</span> },
    {
      key: "status", header: "Status", className: "w-28",
      render: (r) => <StatusBadge status={r.status === "active" ? "active" : "inactive"} label={r.status === "active" ? t("active") : t("inactive")} />,
    },
    {
      key: "created_at", header: t("timestamp"), className: "w-32",
      render: (r) => <span className="text-sm text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-BR")}</span>,
    },
    {
      key: "actions", header: "", className: "w-24 text-right",
      render: (r) => (
        <div className="flex gap-1 justify-end">
          <Button size="sm" variant="ghost" onClick={() => toggleStatus(r)} title={r.status === "active" ? t("venue_deactivated") : t("venue_activated")}>
            {r.status === "active" ? <ToggleRight className="h-4 w-4 text-success" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openEdit(r)} title={t("edit_venue")}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("venues")} subtitle={t("gvn_subtitle")} icon={MapPin}
        actions={<Button onClick={openCreate} className="glow-hover"><Plus className="mr-2 h-4 w-4" />{t("add_venue")}</Button>}
      />

      <DataTable columns={columns} data={filtered} keyExtractor={(r) => r.id} loading={loading}
        search={search} onSearchChange={setSearch} searchPlaceholder={t("search_venues")}
        emptyMessage={t("no_venues_found")} emptyHint={t("gvn_empty_hint")}
        emptyActionLabel={t("add_venue")} onEmptyAction={openCreate}
      />

      <ModalForm open={modalOpen} onOpenChange={setModalOpen} title={editingId ? t("edit_venue") : t("new_venue")} onSubmit={handleSave} saving={saving}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("name")} *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("gvn_name_placeholder")} />
          </div>
          <div className="space-y-2">
            <Label>{t("address")}</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("city")} *</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("state")} *</Label>
              <Input value={state} onChange={(e) => setState(e.target.value)} maxLength={2} placeholder="UF" />
            </div>
          </div>
          <LocationPicker
            latitude={latitude}
            longitude={longitude}
            onLocationChange={(lat, lng) => { setLatitude(lat); setLongitude(lng); }}
            address={address}
            city={city}
            state={state}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("latitude")}</Label>
              <Input readOnly value={latitude} className="bg-muted/50" placeholder="—" />
            </div>
            <div className="space-y-2">
              <Label>{t("longitude")}</Label>
              <Input readOnly value={longitude} className="bg-muted/50" placeholder="—" />
            </div>
          </div>
        </div>
      </ModalForm>
    </div>
  );
}
