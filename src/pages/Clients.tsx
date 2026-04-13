import { useEffect, useState, useRef } from "react";
import { maskPhone, maskCPF, maskDocument, unmask } from "@/lib/masks";
import { supabase } from "@/integrations/supabase/client";
import { getPtBrErrorMessage } from "@/lib/error-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Building2, Upload, X, Image as ImageIcon, CheckCircle2 } from "lucide-react";
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
  pix_key: string | null; bank_code: string | null; bank_agency: string | null;
  bank_account: string | null; bank_account_type: string | null;
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

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let pass = "";
  for (let i = 0; i < 8; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  return pass;
}

export default function Clients() {
  const { isSuperAdmin, hasRole, isOwner } = useAuth();
  const canManage = isSuperAdmin || isOwner || hasRole("client_admin");
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

  // Manager state (for creation)
  const [managerName, setManagerName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [managerPassword, setManagerPassword] = useState(() => generatePassword());
  const [managerPhone, setManagerPhone] = useState("");
  const [successData, setSuccessData] = useState<{ name: string; email: string; password: string; asaasStatus?: string } | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);

  // Bank state (for creation & edit)
  const [bankPixKey, setBankPixKey] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [bankAgency, setBankAgency] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankAccountType, setBankAccountType] = useState("CONTA_CORRENTE");

  const BANK_OPTIONS = [
    { value: "001", label: "001 - Banco do Brasil" },
    { value: "033", label: "033 - Santander" },
    { value: "104", label: "104 - Caixa Econômica" },
    { value: "237", label: "237 - Bradesco" },
    { value: "341", label: "341 - Itaú" },
    { value: "260", label: "260 - Nubank" },
    { value: "077", label: "077 - Inter" },
    { value: "336", label: "336 - C6 Bank" },
    { value: "756", label: "756 - Sicoob" },
  ];

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
    setManagerName("");
    setManagerEmail("");
    setManagerPassword(generatePassword());
    setManagerPhone("");
    setBankPixKey("");
    setBankCode("");
    setBankAgency("");
    setBankAccount("");
    setBankAccountType("CONTA_CORRENTE");
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
    setBankPixKey(client.pix_key || "");
    setBankCode(client.bank_code || "");
    setBankAgency(client.bank_agency || "");
    setBankAccount(client.bank_account || "");
    setBankAccountType(client.bank_account_type || "CONTA_CORRENTE");
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
    if (file.type !== "image/png") { toast.error(t("cl_logo_png_only")); return; }
    if (file.size > 512 * 1024) { toast.error(t("cl_logo_too_large")); return; }
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
      upsert: true, contentType: "image/png",
    });
    if (error) { toast.error(t("cl_logo_upload_error") + ": " + error.message); return editing?.logo_path || null; }
    return path;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedClientName = form.name.trim();
    const trimmedManagerName = managerName.trim();
    const trimmedManagerEmail = managerEmail.trim().toLowerCase();
    const trimmedManagerPassword = managerPassword.trim();

    if (!editing) {
      if (!trimmedClientName) {
        toast.error("Nome do cliente é obrigatório.");
        return;
      }
      if (!trimmedManagerName || !trimmedManagerEmail || !trimmedManagerPassword) {
        toast.error("Preencha os dados obrigatórios do gestor.");
        return;
      }
    }

    setSaving(true);

    if (editing) {
      // UPDATE existing client
      const payload: Record<string, any> = {
        name: form.name, email: form.email || null, phone: form.phone || null,
        document: form.document || null, address: form.address || null, status: form.status,
        owner_name: form.owner_name || null, owner_cpf: form.owner_cpf || null,
        owner_phone: form.owner_phone || null,
        contact_name: form.contact_name || null, contact_phone: form.contact_phone || null,
        pix_key: bankPixKey || null, bank_code: bankCode || null,
        bank_agency: bankAgency || null, bank_account: bankAccount || null,
        bank_account_type: bankAccountType || "CONTA_CORRENTE",
      };
      const logoPath = await uploadLogo(editing.id);
      payload.logo_path = logoPath;
      const { error } = await supabase.from("clients").update(payload as any).eq("id", editing.id);
      if (error) { toast.error(getPtBrErrorMessage(error)); setSaving(false); return; }
      await logAudit({ action: "client.updated", entityType: "client", entityId: editing.id, metadata: { name: form.name, previous_status: editing.status, new_status: form.status }, oldData: { name: editing.name, status: editing.status }, newData: payload });

      // If bank data changed and client has document, try create/update Asaas subaccount
      if (bankPixKey || bankCode) {
        try {
          await supabase.functions.invoke("asaas-create-subaccount", {
            body: {
              client_id: editing.id,
              name: form.name,
              email: form.email || undefined,
              cpf_cnpj: form.document || form.owner_cpf || undefined,
              pix_key: bankPixKey || undefined,
              bank_code: bankCode || undefined,
              bank_agency: bankAgency || undefined,
              bank_account: bankAccount || undefined,
              bank_account_type: bankAccountType || undefined,
            },
          });
          toast.success(t("asaas_subaccount_created"));
        } catch {
          toast.warning(t("asaas_subaccount_warning"));
        }
      }

      toast.success(t("client_updated"));
      setSaving(false);
      setSheetOpen(false);
      fetchClients();
    } else {
      // CREATE via edge function
      const { data: createData, error } = await supabase.functions.invoke("create-client-with-manager", {
        body: {
          client_name: trimmedClientName,
          client_email: form.email.trim() || undefined,
          client_phone: form.phone || undefined,
          client_document: form.document || undefined,
          client_address: form.address.trim() || undefined,
          owner_name: form.owner_name.trim() || undefined,
          owner_cpf: form.owner_cpf || undefined,
          owner_phone: form.owner_phone || undefined,
          manager_email: trimmedManagerEmail,
          manager_password: trimmedManagerPassword,
          manager_name: trimmedManagerName,
          manager_phone: managerPhone || undefined,
          pix_key: bankPixKey || undefined,
          bank_code: bankCode || undefined,
          bank_agency: bankAgency || undefined,
          bank_account: bankAccount || undefined,
          bank_account_type: bankAccountType || undefined,
        },
      });

      if (error) {
        let detail = "Erro ao ativar cliente";
        try {
          if (error?.context?.body) {
            const bodyText = await error.context.body.text?.();
            if (bodyText) {
              const parsed = JSON.parse(bodyText);
              detail = parsed.detail || detail;
            }
          }
        } catch { /* ignore parse errors */ }
        toast.error(detail);
        setSaving(false);
        return;
      }

      // Step 2: Try creating Asaas subaccount
      let asaasStatus = "";
      const clientId = createData?.client_id;
      if (clientId && (form.document || form.owner_cpf)) {
        try {
          await supabase.functions.invoke("asaas-create-subaccount", {
            body: {
              client_id: clientId,
              name: trimmedClientName,
              email: form.email.trim() || trimmedManagerEmail,
              cpf_cnpj: form.document || form.owner_cpf || undefined,
              pix_key: bankPixKey || undefined,
              bank_code: bankCode || undefined,
              bank_agency: bankAgency || undefined,
              bank_account: bankAccount || undefined,
              bank_account_type: bankAccountType || undefined,
            },
          });
          asaasStatus = "✅ Criada";
        } catch {
          asaasStatus = "⚠️ Não criada";
          toast.warning(t("asaas_subaccount_warning"));
        }
      } else {
        asaasStatus = "⚠️ CPF/CNPJ não informado";
      }

      setSuccessData({ name: trimmedClientName, email: trimmedManagerEmail, password: trimmedManagerPassword, asaasStatus });
      setSuccessOpen(true);
      setSaving(false);
      setSheetOpen(false);
      fetchClients();
    }
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
        actions={canManage ? <Button onClick={openCreate} className="glow-hover"><Plus className="mr-2 h-4 w-4" />{t("activate_client")}</Button> : undefined}
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
        emptyActionLabel={canManage ? t("activate_client") : undefined}
        onEmptyAction={canManage ? openCreate : undefined}
      />

      <ModalForm
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={editing ? t("edit_client") : t("activate_client")}
        onSubmit={handleSubmit}
        saving={saving}
        submitLabel={editing ? t("update") : t("activate_client")}
      >
        {editing ? (
          <Tabs defaultValue="dados" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="dados">{t("cl_section_data")}</TabsTrigger>
              <TabsTrigger value="banco">{t("bank_tab")}</TabsTrigger>
              <TabsTrigger value="cobranca">{t("br_tab_billing")}</TabsTrigger>
            </TabsList>
            <TabsContent value="dados">
              <ClientFormFields form={form} setForm={setForm} editing={editing} logoPreview={logoPreview} logoFile={logoFile} fileInputRef={fileInputRef} handleLogoSelect={handleLogoSelect} removeLogo={removeLogo} t={t} />
            </TabsContent>
            <TabsContent value="banco">
              <BankFields bankPixKey={bankPixKey} setBankPixKey={setBankPixKey} bankCode={bankCode} setBankCode={setBankCode} bankAgency={bankAgency} setBankAgency={setBankAgency} bankAccount={bankAccount} setBankAccount={setBankAccount} bankAccountType={bankAccountType} setBankAccountType={setBankAccountType} bankOptions={BANK_OPTIONS} t={t} />
            </TabsContent>
            <TabsContent value="cobranca">
              <ClientBillingRules clientId={editing.id} />
            </TabsContent>
          </Tabs>
        ) : (
          <Tabs defaultValue="dados" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="dados">{t("cl_section_data")}</TabsTrigger>
              <TabsTrigger value="gestor">{t("manager_tab")}</TabsTrigger>
            </TabsList>
            <TabsContent value="dados">
              <ClientFormFields form={form} setForm={setForm} editing={editing} logoPreview={logoPreview} logoFile={logoFile} fileInputRef={fileInputRef} handleLogoSelect={handleLogoSelect} removeLogo={removeLogo} t={t} />
            </TabsContent>
            <TabsContent value="gestor">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>{t("manager_name_label")} *</Label>
                  <Input value={managerName} onChange={(e) => setManagerName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("manager_email_label")} *</Label>
                  <Input type="email" value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("manager_password_label")}</Label>
                  <div className="flex gap-2">
                    <Input type="text" value={managerPassword} onChange={(e) => setManagerPassword(e.target.value)} className="font-mono" />
                    <Button type="button" variant="outline" size="sm" onClick={() => setManagerPassword(generatePassword())}>
                      {t("generate_password")}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("manager_phone_label")}</Label>
                  <Input value={maskPhone(managerPhone)} onChange={(e) => setManagerPhone(unmask(e.target.value))} placeholder="(00) 00000-0000" />
                </div>

                <Separator className="my-4" />

                <BankFields bankPixKey={bankPixKey} setBankPixKey={setBankPixKey} bankCode={bankCode} setBankCode={setBankCode} bankAgency={bankAgency} setBankAgency={setBankAgency} bankAccount={bankAccount} setBankAccount={setBankAccount} bankAccountType={bankAccountType} setBankAccountType={setBankAccountType} bankOptions={BANK_OPTIONS} t={t} />
              </div>
            </TabsContent>
          </Tabs>
        )}
      </ModalForm>

      {/* Success Dialog */}
      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center gap-4 py-4">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <h3 className="text-lg font-semibold">{t("client_activated_success")}</h3>
            <div className="w-full space-y-2 rounded-lg border border-border bg-muted/30 p-4 text-sm">
              <p><span className="text-muted-foreground">{t("activation_establishment")}:</span> {successData?.name}</p>
              <p><span className="text-muted-foreground">{t("email")}:</span> {successData?.email}</p>
              <p><span className="text-muted-foreground">{t("password")}:</span> <span className="font-mono">{successData?.password}</span></p>
              <p><span className="text-muted-foreground">{t("activation_access_url")}:</span> https://closeout.lovable.app/gestor</p>
              {successData?.asaasStatus && (
                <p><span className="text-muted-foreground">{t("asaas_subaccount_status")}:</span> {successData.asaasStatus}</p>
              )}
            </div>
            <Button onClick={() => {
              navigator.clipboard.writeText(
                `Close Out — Dados de Acesso\nEstabelecimento: ${successData?.name}\nEmail: ${successData?.email}\nSenha: ${successData?.password}\nAcesso: https://closeout.lovable.app/gestor`
              );
              toast.success(t("access_data_copied"));
            }} className="w-full">
              {t("copy_access_data")}
            </Button>
            <Button variant="outline" onClick={() => setSuccessOpen(false)} className="w-full">
              {t("close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">{t("cl_section_data")}</h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>{t("name")} *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("slug")}</Label>
                  <Input value={editing ? form.slug : ""} readOnly className="bg-muted/50 font-mono text-xs" placeholder={t("cl_slug_auto")} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("document")}</Label>
                  <Input value={maskDocument(form.document)} onChange={(e) => setForm({ ...form, document: unmask(e.target.value) })} placeholder="00.000.000/0000-00" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{t("email")}</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("phone")}</Label>
                    <Input value={maskPhone(form.phone)} onChange={(e) => setForm({ ...form, phone: unmask(e.target.value) })} placeholder="(00) 00000-0000" />
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
                    <Input value={maskCPF(form.owner_cpf)} onChange={(e) => setForm({ ...form, owner_cpf: unmask(e.target.value) })} placeholder="000.000.000-00" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("cl_owner_phone")}</Label>
                    <Input value={maskPhone(form.owner_phone)} onChange={(e) => setForm({ ...form, owner_phone: unmask(e.target.value) })} placeholder="(00) 00000-0000" />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">{t("cl_section_contact")}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("cl_contact_name")}</Label>
                  <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("cl_contact_phone")}</Label>
                  <Input value={maskPhone(form.contact_phone)} onChange={(e) => setForm({ ...form, contact_phone: unmask(e.target.value) })} placeholder="(00) 00000-0000" />
                </div>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">{t("cl_section_logo")}</h3>
              <div className="space-y-3">
                <input ref={fileInputRef} type="file" accept="image/png" className="hidden" onChange={handleLogoSelect} />
                {logoPreview ? (
                  <div className="relative w-full aspect-video rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden">
                    <img src={logoPreview} alt="Logo preview" className="max-w-full max-h-full object-contain p-4" />
                    <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={removeLogo}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full aspect-video rounded-lg border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 hover:bg-muted/30 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground cursor-pointer">
                    <ImageIcon className="h-10 w-10" />
                    <span className="text-sm">{t("cl_logo_upload")}</span>
                  </button>
                )}
                {logoPreview && (
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="w-full">
                    <Upload className="mr-2 h-4 w-4" />
                    {t("cl_logo_upload")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
  );
}

function BankFields({ bankPixKey, setBankPixKey, bankCode, setBankCode, bankAgency, setBankAgency, bankAccount, setBankAccount, bankAccountType, setBankAccountType, bankOptions, t }: {
  bankPixKey: string; setBankPixKey: (v: string) => void;
  bankCode: string; setBankCode: (v: string) => void;
  bankAgency: string; setBankAgency: (v: string) => void;
  bankAccount: string; setBankAccount: (v: string) => void;
  bankAccountType: string; setBankAccountType: (v: string) => void;
  bankOptions: { value: string; label: string }[];
  t: (key: any) => string;
}) {
  const maskAgency = (v: string) => v.replace(/\D/g, "").slice(0, 4);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">{t("bank_section_title")}</h3>

      <div className="space-y-1.5">
        <Label>{t("bank_pix_key")}</Label>
        <Input value={bankPixKey} onChange={(e) => setBankPixKey(e.target.value)} placeholder={t("bank_pix_placeholder")} />
      </div>

      <div className="space-y-1.5">
        <Label>{t("bank_code")}</Label>
        <Select value={bankCode} onValueChange={setBankCode}>
          <SelectTrigger><SelectValue placeholder="Selecione o banco" /></SelectTrigger>
          <SelectContent>
            {bankOptions.map((b) => (
              <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{t("bank_agency")}</Label>
          <Input value={bankAgency} onChange={(e) => setBankAgency(maskAgency(e.target.value))} placeholder="0000" maxLength={4} />
        </div>
        <div className="space-y-1.5">
          <Label>{t("bank_account")}</Label>
          <Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="00000-0" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{t("bank_account_type")}</Label>
        <Select value={bankAccountType} onValueChange={setBankAccountType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="CONTA_CORRENTE">{t("bank_account_corrente")}</SelectItem>
            <SelectItem value="CONTA_POUPANCA">{t("bank_account_poupanca")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
