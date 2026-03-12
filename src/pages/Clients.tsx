import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPtBrErrorMessage } from "@/lib/error-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, Pencil } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import { ENTITY_STATUS } from "@/config";
import { logAudit } from "@/lib/audit";

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
  const [form, setForm] = useState({ name: "", slug: "", email: "", phone: "", document: "", address: "", status: ENTITY_STATUS.ACTIVE as string });

  const fetchClients = async () => {
    const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
    if (error) { toast.error(getPtBrErrorMessage(error)); return; }
    if (data) setClients(data as Client[]);
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
    if (editing) {
      const { error } = await supabase.from("clients").update(form).eq("id", editing.id);
      if (error) { toast.error(getPtBrErrorMessage(error)); return; }
      await logAudit({ action: "client.updated", entityType: "client", entityId: editing.id, metadata: { name: form.name, previous_status: editing.status, new_status: form.status }, oldData: { name: editing.name, status: editing.status }, newData: form });
      toast.success(t("client_updated"));
    } else {
      const { data, error } = await supabase.from("clients").insert(form).select("id").single();
      if (error) { toast.error(error.message); return; }
      if (data) await logAudit({ action: "client.created", entityType: "client", entityId: data.id, metadata: { name: form.name }, newData: form });
      toast.success(t("client_created"));
    }
    setSheetOpen(false); fetchClients();
  };

  const toggleStatus = async (client: Client) => {
    const newStatus = client.status === ENTITY_STATUS.ACTIVE ? ENTITY_STATUS.INACTIVE : ENTITY_STATUS.ACTIVE;
    const { error } = await supabase.from("clients").update({ status: newStatus }).eq("id", client.id);
    if (error) { toast.error(error.message); return; }
    await logAudit({ action: "client.updated", entityType: "client", entityId: client.id, metadata: { name: client.name, previous_status: client.status, new_status: newStatus }, oldData: { status: client.status }, newData: { status: newStatus } });
    toast.success(newStatus === ENTITY_STATUS.ACTIVE ? t("client_activated") : t("client_deactivated"));
    fetchClients();
  };

  const filtered = clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("clients")}</h1>
          <p className="text-sm text-muted-foreground">{t("manage_clients")}</p>
        </div>
        {canManage && <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />{t("add_client")}</Button>}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder={t("search_clients")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card className="border-border bg-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("slug")}</TableHead>
                <TableHead>{t("email")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                {canManage && <TableHead className="w-24">{t("actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{client.slug}</TableCell>
                  <TableCell className="text-muted-foreground">{client.email || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={client.status === ENTITY_STATUS.ACTIVE ? "default" : "secondary"}
                      className={`cursor-pointer ${client.status === ENTITY_STATUS.ACTIVE ? "bg-primary/15 text-primary hover:bg-primary/25" : ""}`}
                      onClick={() => canManage && toggleStatus(client)}>
                      {client.status === ENTITY_STATUS.ACTIVE ? t("active") : t("inactive")}
                    </Badge>
                  </TableCell>
                  {canManage && <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(client)}><Pencil className="h-4 w-4" /></Button></TableCell>}
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t("no_clients_found")}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>{editing ? t("edit_client") : t("new_client")}</SheetTitle></SheetHeader>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2"><Label>{t("name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="space-y-2"><Label>{t("slug")}</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required placeholder="unique-identifier" /></div>
            <div className="space-y-2"><Label>{t("document")}</Label><Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} placeholder="CNPJ or ID" /></div>
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
            <Button type="submit" className="w-full">{editing ? t("update") : t("create")}</Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
