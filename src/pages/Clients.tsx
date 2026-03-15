import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPtBrErrorMessage } from "@/lib/error-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import { ENTITY_STATUS } from "@/config";
import { logAudit } from "@/lib/audit";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { ModalForm } from "@/components/ModalForm";

type Client = {
  id: string; name: string; slug: string; logo_url: string | null;
  email: string | null; phone: string | null; document: string | null;
  address: string | null; status: string; created_at: string;
};

export default function Clients() {
  const { isSuperAdmin, hasRole } = useAuth();
  const canManage = isSuperAdmin || hasRole("client_admin");
  const { t } = useTranslation();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", slug: "", email: "", phone: "", document: "", address: "", status: ENTITY_STATUS.ACTIVE as string });

  const fetchClients = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
    if (error) { toast.error(getPtBrErrorMessage(error)); }
    setClients((data as Client[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchClients(); }, []);

  const openCreate = () => { setEditing(null); setForm({ name: "", slug: "", email: "", phone: "", document: "", address: "", status: ENTITY_STATUS.ACTIVE as string }); setSheetOpen(true); };
  const openEdit = (client: Client) => {
    setEditing(client);
    setForm({ name: client.name, slug: client.slug, email: client.email || "", phone: client.phone || "", document: client.document || "", address: client.address || "", status: client.status });
    setSheetOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    if (editing) {
      const { error } = await supabase.from("clients").update(form).eq("id", editing.id);
      if (error) { toast.error(getPtBrErrorMessage(error)); setSaving(false); return; }
      await logAudit({ action: "client.updated", entityType: "client", entityId: editing.id, metadata: { name: form.name, previous_status: editing.status, new_status: form.status }, oldData: { name: editing.name, status: editing.status }, newData: form });
      toast.success(t("client_updated"));
    } else {
      const { data, error } = await supabase.from("clients").insert(form).select("id").single();
      if (error) { toast.error(getPtBrErrorMessage(error)); setSaving(false); return; }
      if (data) await logAudit({ action: "client.created", entityType: "client", entityId: data.id, metadata: { name: form.name }, newData: form });
      toast.success(t("client_created"));
    }
    setSaving(false);
    setSheetOpen(false); fetchClients();
  };

  const toggleStatus = async (client: Client) => {
    if (!canManage) return;
    const newStatus = client.status === ENTITY_STATUS.ACTIVE ? ENTITY_STATUS.INACTIVE : ENTITY_STATUS.ACTIVE;
    const { error } = await supabase.from("clients").update({ status: newStatus }).eq("id", client.id);
    if (error) { toast.error(getPtBrErrorMessage(error)); return; }
    await logAudit({ action: "client.updated", entityType: "client", entityId: client.id, metadata: { name: client.name, previous_status: client.status, new_status: newStatus }, oldData: { status: client.status }, newData: { status: newStatus } });
    toast.success(newStatus === ENTITY_STATUS.ACTIVE ? t("client_activated") : t("client_deactivated"));
    fetchClients();
  };

  const filtered = clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  const columns: DataTableColumn<Client>[] = [
    { key: "name", header: t("name"), render: (c) => <span className="font-medium">{c.name}</span> },
    { key: "slug", header: t("slug"), render: (c) => <span className="font-mono text-xs text-muted-foreground">{c.slug}</span> },
    { key: "email", header: t("email"), render: (c) => <span className="text-muted-foreground">{c.email || "—"}</span> },
    { key: "status", header: t("status"), render: (c) => (
      <StatusBadge
        status={c.status === ENTITY_STATUS.ACTIVE ? "active" : "inactive"}
        label={c.status === ENTITY_STATUS.ACTIVE ? t("active") : t("inactive")}
        onClick={() => toggleStatus(c)}
      />
    )},
    ...(canManage ? [{ key: "actions", header: t("actions"), className: "w-20", render: (c: Client) => (
      <Button variant="ghost" size="icon" onClick={() => openEdit(c)} className="hover:text-primary"><Pencil className="h-4 w-4" /></Button>
    )}] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("clients")}
        subtitle={t("manage_clients")}
        icon={Building2}
        actions={canManage ? <Button onClick={openCreate} className="glow-hover"><Plus className="mr-2 h-4 w-4" />{t("add_client")}</Button> : undefined}
      />

      <DataTable
        columns={columns}
        data={filtered}
        keyExtractor={(c) => c.id}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t("search_clients")}
        emptyMessage={t("no_clients_found")}
        emptyActionLabel={canManage ? t("add_client") : undefined}
        onEmptyAction={canManage ? openCreate : undefined}
      />

      <ModalForm
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={editing ? t("edit_client") : t("new_client")}
        onSubmit={handleSubmit}
        saving={saving}
        submitLabel={editing ? t("update") : t("create")}
      >
        <div className="space-y-2"><Label>{t("name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div className="space-y-2"><Label>{t("slug")}</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required placeholder="identificador-unico" /></div>
        <div className="space-y-2"><Label>{t("document")}</Label><Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} placeholder="CNPJ ou CPF" /></div>
        <div className="space-y-2"><Label>{t("email")}</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="space-y-2"><Label>{t("phone")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div className="space-y-2"><Label>{t("address")}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
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
