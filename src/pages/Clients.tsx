import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPtBrErrorMessage } from "@/lib/error-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Pencil, Building2, Upload, X, Image as ImageIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import { ENTITY_STATUS } from "@/config";
import { logAudit } from "@/lib/audit";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { ModalForm } from "@/components/ModalForm";
import { ClientBillingRules } from "@/components/ClientBillingRules";

type Client = {
  id: string; name: string; slug: string; logo_url: string | null;
  email: string | null; phone: string | null; document: string | null;
  address: string | null; status: string; created_at: string;
  owner_name: string | null; owner_cpf: string | null; owner_phone: string | null;
  contact_name: string | null; contact_phone: string | null;
  logo_path: string | null; default_fee_percent: number | null;
};

type FormState = {
  name: string; slug: string; email: string; phone: string; document: string;
  address: string; status: string;
  owner_name: string; owner_cpf: string; owner_phone: string;
  contact_name: string; contact_phone: string;
};

const emptyForm = (): FormState => ({
  name: "", slug: "", email: "", phone: "", document: "", address: "",
  status: ENTITY_STATUS.ACTIVE as string,
  owner_name: "", owner_cpf: "", owner_phone: "",
  contact_name: "", contact_phone: "",
});

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
  const [form, setForm] = useState<FormState>(emptyForm());

  // Logo state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchClients = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
    if (error) toast.error(getPtBrErrorMessage(error));
    setClients((data as Client[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchClients(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setLogoFile(null);
    setLogoPreview(null);
    setSheetOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditing(client);
    setForm({
      name: client.name, slug: client.slug,
      email: client.email || "", phone: client.phone || "",
      document: client.document || "", address: client.address || "",
      status: client.status,
      owner_name: client.owner_name || "", owner_cpf: client.owner_cpf || "",
      owner_phone: client.owner_phone || "",
      contact_name: client.contact_name || "", contact_phone: client.contact_phone || "",
    });
    setLogoFile(null);
    if (client.logo_path) {
      supabase.storage.from("client-logos").createSignedUrl(client.logo_path, 3600).then(({ data: signedData }) => {
        if (signedData?.signedUrl) setLogoPreview(signedData.signedUrl);
        else setLogoPreview(null);
      });
    } else {
      setLogoPreview(null);
    }
    setSheetOpen(true);
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "image/png") {
      toast.error(t("cl_logo_png_only"));
      return;
    }
    if (file.size > 512 * 1024) {
      toast.error(t("cl_logo_too_large"));
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadLogo = async (clientId: string): Promise<string | null> => {
    if (!logoFile) return editing?.logo_path || null;
    const path = `clients/${clientId}/logo.png`;
    const { error } = await supabase.storage.from("client-logos").upload(path, logoFile, {
      upsert: true,
      contentType: "image/png",
    });
    if (error) {
      toast.error(t("cl_logo_upload_error") + ": " + error.message);
      return editing?.logo_path || null;
    }
    return path;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload: Record<string, any> = {
      name: form.name, email: form.email || null, phone: form.phone || null,
      document: form.document || null, address: form.address || null, status: form.status,
      owner_name: form.owner_name || null, owner_cpf: form.owner_cpf || null,
      owner_phone: form.owner_phone || null,
      contact_name: form.contact_name || null, contact_phone: form.contact_phone || null,
    };

    if (editing) {
      // Upload logo
      const logoPath = await uploadLogo(editing.id);
      payload.logo_path = logoPath;

      const { error } = await supabase.from("clients").update(payload).eq("id", editing.id);
      if (error) { toast.error(getPtBrErrorMessage(error)); setSaving(false); return; }
      await logAudit({ action: "client.updated", entityType: "client", entityId: editing.id, metadata: { name: form.name, previous_status: editing.status, new_status: form.status }, oldData: { name: editing.name, status: editing.status }, newData: payload });
      toast.success(t("client_updated"));
    } else {
      // On create, slug is auto-generated by DB trigger — send empty/null slug
      payload.slug = "";
      const { data, error } = await supabase.from("clients").insert(payload as any).select("id, slug").single();
      if (error) { toast.error(getPtBrErrorMessage(error)); setSaving(false); return; }
      if (data) {
        // Upload logo with the new client ID
        const logoPath = await uploadLogo(data.id);
        if (logoPath) {
          await supabase.from("clients").update({ logo_path: logoPath }).eq("id", data.id);
        }
        await logAudit({ action: "client.created", entityType: "client", entityId: data.id, metadata: { name: form.name }, newData: payload });
      }
      toast.success(t("client_created"));
    }
    setSaving(false);
    setSheetOpen(false);
    fetchClients();
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
    { key: "fee", header: "Fee %", className: "w-20 text-right", render: (c) => (
      <span className="text-muted-foreground text-sm font-mono">
        {c.default_fee_percent != null
          ? c.default_fee_percent.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%"
          : "—"}
      </span>
    )},
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
        size="wide"
      >
        {editing ? (
          <Tabs defaultValue="dados" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="dados">{t("cl_section_data")}</TabsTrigger>
              <TabsTrigger value="cobranca">{t("br_tab_billing")}</TabsTrigger>
            </TabsList>
            <TabsContent value="dados">
              <ClientFormFields form={form} setForm={setForm} editing={editing} logoPreview={logoPreview} logoFile={logoFile} fileInputRef={fileInputRef} handleLogoSelect={handleLogoSelect} removeLogo={removeLogo} t={t} />
            </TabsContent>
            <TabsContent value="cobranca">
              <ClientBillingRules clientId={editing.id} />
            </TabsContent>
          </Tabs>
        ) : (
          <ClientFormFields form={form} setForm={setForm} editing={editing} logoPreview={logoPreview} logoFile={logoFile} fileInputRef={fileInputRef} handleLogoSelect={handleLogoSelect} removeLogo={removeLogo} t={t} />
        )}
      </ModalForm>
    </div>
  );
}

function ClientFormFields({ form, setForm, editing, logoPreview, logoFile, fileInputRef, handleLogoSelect, removeLogo, t }: {
  form: FormState;
  setForm: (f: FormState) => void;
  editing: Client | null;
  logoPreview: string | null;
  logoFile: File | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleLogoSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeLogo: () => void;
  t: (key: any) => string;
}) {
  return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-5">
            {/* Section: Client Data */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">{t("cl_section_data")}</h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>{t("name")} *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("slug")}</Label>
                  <Input
                    value={editing ? form.slug : ""}
                    readOnly
                    className="bg-muted/50 font-mono text-xs"
                    placeholder={t("cl_slug_auto")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("document")}</Label>
                  <Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} placeholder="CNPJ ou CPF" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{t("email")}</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("phone")}</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("address")}</Label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("status")}</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ENTITY_STATUS.ACTIVE}>{t("active")}</SelectItem>
                      <SelectItem value={ENTITY_STATUS.INACTIVE}>{t("inactive")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Section: Owner */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">{t("cl_section_owner")}</h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>{t("cl_owner_name")}</Label>
                  <Input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{t("cl_owner_cpf")}</Label>
                    <Input value={form.owner_cpf} onChange={(e) => setForm({ ...form, owner_cpf: e.target.value })} placeholder="000.000.000-00" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("cl_owner_phone")}</Label>
                    <Input value={form.owner_phone} onChange={(e) => setForm({ ...form, owner_phone: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Section: Contact */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">{t("cl_section_contact")}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("cl_contact_name")}</Label>
                  <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("cl_contact_phone")}</Label>
                  <Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
                </div>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Section: Logo */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">{t("cl_section_logo")}</h3>
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png"
                  className="hidden"
                  onChange={handleLogoSelect}
                />
                {logoPreview ? (
                  <div className="relative w-full aspect-video rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="max-w-full max-h-full object-contain p-4"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7"
                      onClick={removeLogo}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full aspect-video rounded-lg border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 hover:bg-muted/30 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <ImageIcon className="h-10 w-10" />
                    <span className="text-sm">{t("cl_logo_upload")}</span>
                  </button>
                )}
                {logoPreview && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {t("cl_logo_upload")}
                  </Button>
                )}
              </div>
            </div>

            <Separator />

            {/* Section: Fee */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">{t("cl_section_fee")}</h3>
              <div className="space-y-1.5">
                <Label>{t("cl_default_fee")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.default_fee_percent}
                  onChange={(e) => setForm({ ...form, default_fee_percent: e.target.value })}
                  placeholder="10.00"
                />
                <p className="text-xs text-muted-foreground">{t("cl_default_fee_help")}</p>
              </div>
            </div>
          </div>
        </div>
  );
}
