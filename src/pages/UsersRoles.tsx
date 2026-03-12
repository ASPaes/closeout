import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import { APP_ROLE } from "@/config";
import { logAudit } from "@/lib/audit";

type UserRole = { id: string; user_id: string; role: string; client_id: string | null; venue_id: string | null; event_id: string | null; created_at: string };
type Client = { id: string; name: string };

const roleKeys: Record<string, string> = {
  [APP_ROLE.SUPER_ADMIN]: "role_super_admin",
  [APP_ROLE.CLIENT_ADMIN]: "role_client_admin",
  [APP_ROLE.VENUE_MANAGER]: "role_venue_manager",
  [APP_ROLE.EVENT_MANAGER]: "role_event_manager",
  [APP_ROLE.EVENT_ORGANIZER]: "role_event_organizer",
  [APP_ROLE.STAFF]: "role_staff",
  [APP_ROLE.WAITER]: "role_waiter",
  [APP_ROLE.CASHIER]: "role_cashier",
  [APP_ROLE.CONSUMER]: "role_consumer",
};

export default function UsersRoles() {
  const { isSuperAdmin } = useAuth();
  const { t } = useTranslation();
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState({ user_id: "", role: APP_ROLE.STAFF as string, client_id: "" });

  const fetchData = async () => {
    const [ur, c] = await Promise.all([
      supabase.from("user_roles").select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, name"),
    ]);
    if (ur.data) setUserRoles(ur.data as UserRole[]);
    if (c.data) setClients(c.data as Client[]);
  };

  useEffect(() => { fetchData(); }, []);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { user_id: form.user_id, role: form.role };
    if (form.client_id) payload.client_id = form.client_id;
    const { data, error } = await supabase.from("user_roles").insert(payload).select("id").single();
    if (error) { toast.error(error.message); return; }
    if (data) await logAudit({ action: "user.role_assigned", entityType: "user_role", entityId: data.id, metadata: { user_id: payload.user_id, role: payload.role, client_id: payload.client_id || null }, newData: payload });
    toast.success(t("role_assigned"));
    setSheetOpen(false); fetchData();
  };

  const handleRemove = async (ur: UserRole) => {
    const { error } = await supabase.from("user_roles").delete().eq("id", ur.id);
    if (error) { toast.error(error.message); return; }
    await logAudit({ action: "user.role_removed", entityType: "user_role", entityId: ur.id, oldData: { user_id: ur.user_id, role: ur.role, client_id: ur.client_id } });
    toast.success(t("role_removed"));
    fetchData();
  };

  const filtered = userRoles.filter((ur) => ur.role.includes(search.toLowerCase()) || ur.user_id.includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("users_roles")}</h1>
          <p className="text-sm text-muted-foreground">{t("manage_roles")}</p>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => { setForm({ user_id: "", role: APP_ROLE.STAFF as string, client_id: "" }); setSheetOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />{t("assign_role")}
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder={t("search_users_roles")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card className="border-border bg-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("user")}</TableHead>
                <TableHead>{t("role")}</TableHead>
                <TableHead>{t("scope")}</TableHead>
                {isSuperAdmin && <TableHead className="w-20">{t("actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((ur) => (
                <TableRow key={ur.id}>
                  <TableCell className="font-mono text-xs">{ur.user_id.slice(0, 12)}…</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{roleKeys[ur.role] ? t(roleKeys[ur.role] as any) : ur.role}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-xs font-mono">{ur.client_id ? `client: ${ur.client_id.slice(0, 8)}` : t("global")}</TableCell>
                  {isSuperAdmin && (
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleRemove(ur)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{t("no_roles_assigned")}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader><SheetTitle>{t("assign_role")}</SheetTitle></SheetHeader>
          <form onSubmit={handleAssign} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>{t("user_id")}</Label>
              <Input value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })} placeholder={t("paste_user_uuid")} required />
            </div>
            <div className="space-y-2">
              <Label>{t("role")}</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={APP_ROLE.SUPER_ADMIN}>{t("role_super_admin")}</SelectItem>
                  <SelectItem value={APP_ROLE.CLIENT_ADMIN}>{t("role_client_admin")}</SelectItem>
                  <SelectItem value={APP_ROLE.VENUE_MANAGER}>{t("role_venue_manager")}</SelectItem>
                  <SelectItem value={APP_ROLE.EVENT_MANAGER}>{t("role_event_manager")}</SelectItem>
                  <SelectItem value={APP_ROLE.EVENT_ORGANIZER}>{t("role_event_organizer")}</SelectItem>
                  <SelectItem value={APP_ROLE.STAFF}>{t("role_staff")}</SelectItem>
                  <SelectItem value={APP_ROLE.WAITER}>{t("role_waiter")}</SelectItem>
                  <SelectItem value={APP_ROLE.CASHIER}>{t("role_cashier")}</SelectItem>
                  <SelectItem value={APP_ROLE.CONSUMER}>{t("role_consumer")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("client_optional_scope")}</Label>
              <Select value={form.client_id || "__global__"} onValueChange={(v) => setForm({ ...form, client_id: v === "__global__" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder={t("global_no_scope")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__global__">{t("global")}</SelectItem>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full">{t("assign_role")}</Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
