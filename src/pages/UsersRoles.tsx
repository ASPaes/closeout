import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPtBrErrorMessage } from "@/lib/error-messages";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, Trash2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import { APP_ROLE } from "@/config";
import { logAudit } from "@/lib/audit";

type UserRole = { id: string; user_id: string; role: string; client_id: string | null; venue_id: string | null; event_id: string | null; created_at: string };
type Profile = { id: string; name: string; status: string };
type Client = { id: string; name: string };
type Venue = { id: string; name: string; client_id: string };
type Event = { id: string; name: string; venue_id: string };

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
  const { isSuperAdmin, user } = useAuth();
  const { t } = useTranslation();
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState({ user_id: "", role: APP_ROLE.STAFF as string, client_id: "", venue_id: "", event_id: "" });
  const [hasSuperAdmin, setHasSuperAdmin] = useState(true);
  const [bootstrapping, setBootstrapping] = useState(false);

  const profileMap = useMemo(() => {
    const map = new Map<string, string>();
    profiles.forEach((p) => map.set(p.id, p.name || p.id.slice(0, 12)));
    return map;
  }, [profiles]);

  const filteredVenues = useMemo(() => {
    if (!form.client_id) return [];
    return venues.filter((v) => v.client_id === form.client_id);
  }, [form.client_id, venues]);

  const filteredEvents = useMemo(() => {
    if (!form.venue_id) return [];
    return events.filter((e) => e.venue_id === form.venue_id);
  }, [form.venue_id, events]);

  const fetchData = async () => {
    const [ur, p, c, v, ev] = await Promise.all([
      supabase.from("user_roles").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, name, status"),
      supabase.from("clients").select("id, name"),
      supabase.from("venues").select("id, name, client_id"),
      supabase.from("events").select("id, name, venue_id"),
    ]);
    if (ur.error) { toast.error(ur.error.message); console.error("user_roles fetch error:", ur.error); }
    if (ur.data) {
      setUserRoles(ur.data as UserRole[]);
      setHasSuperAdmin(ur.data.some((r: any) => r.role === "super_admin"));
    }
    if (p.data) setProfiles(p.data as Profile[]);
    if (c.data) setClients(c.data as Client[]);
    if (v.data) setVenues(v.data as Venue[]);
    if (ev.data) setEvents(ev.data as Event[]);
  };

  useEffect(() => { fetchData(); }, []);

  const handleBootstrap = async () => {
    setBootstrapping(true);
    const { data, error } = await supabase.rpc("bootstrap_super_admin");
    setBootstrapping(false);
    if (error) { toast.error(error.message); return; }
    if (data) {
      toast.success(t("role_assigned"));
      fetchData();
      // Force reload auth to pick up new role
      window.location.reload();
    } else {
      toast.error("Super admin already exists");
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { user_id: form.user_id, role: form.role };
    if (form.client_id) payload.client_id = form.client_id;
    if (form.venue_id) payload.venue_id = form.venue_id;
    if (form.event_id) payload.event_id = form.event_id;
    const { data, error } = await supabase.from("user_roles").insert(payload).select("id").single();
    if (error) { toast.error(error.message); return; }
    if (data) await logAudit({ action: "user.role_assigned", entityType: "user_role", entityId: data.id, metadata: { user_id: payload.user_id, role: payload.role, client_id: payload.client_id || null }, newData: payload });
    toast.success(t("role_assigned"));
    setSheetOpen(false); fetchData();
  };

  const handleRemove = async (ur: UserRole) => {
    const { error } = await supabase.from("user_roles").delete().eq("id", ur.id);
    if (error) { toast.error(error.message); return; }
    await logAudit({ action: "user.role_removed", entityType: "user_role", entityId: ur.id, metadata: { user_id: ur.user_id, role: ur.role, client_id: ur.client_id }, oldData: { user_id: ur.user_id, role: ur.role, client_id: ur.client_id } });
    toast.success(t("role_removed"));
    fetchData();
  };

  const filtered = userRoles.filter((ur) => {
    const userName = profileMap.get(ur.user_id) || ur.user_id;
    return ur.role.includes(search.toLowerCase()) || userName.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("users_roles")}</h1>
          <p className="text-sm text-muted-foreground">{t("manage_roles")}</p>
        </div>
        <div className="flex gap-2">
          {!hasSuperAdmin && user && (
            <Button variant="outline" onClick={handleBootstrap} disabled={bootstrapping}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              {t("bootstrap_super_admin")}
            </Button>
          )}
          {isSuperAdmin && (
            <Button onClick={() => { setForm({ user_id: "", role: APP_ROLE.STAFF as string, client_id: "", venue_id: "", event_id: "" }); setSheetOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />{t("assign_role")}
            </Button>
          )}
        </div>
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
                  <TableCell className="font-medium">{profileMap.get(ur.user_id) || ur.user_id.slice(0, 12) + "…"}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{roleKeys[ur.role] ? t(roleKeys[ur.role] as any) : ur.role}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {ur.client_id ? `${t("client")}: ${ur.client_id.slice(0, 8)}` : ""}
                    {ur.venue_id ? ` ${t("venue")}: ${ur.venue_id.slice(0, 8)}` : ""}
                    {ur.event_id ? ` ${t("event_label")}: ${ur.event_id.slice(0, 8)}` : ""}
                    {!ur.client_id && !ur.venue_id && !ur.event_id ? t("global") : ""}
                  </TableCell>
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
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>{t("assign_role")}</SheetTitle></SheetHeader>
          <form onSubmit={handleAssign} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>{t("user")}</Label>
              <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("select_user")} /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name || p.id.slice(0, 12)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Select value={form.client_id || "__none__"} onValueChange={(v) => setForm({ ...form, client_id: v === "__none__" ? "" : v, venue_id: "", event_id: "" })}>
                <SelectTrigger><SelectValue placeholder={t("global_no_scope")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("global")}</SelectItem>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.client_id && (
              <div className="space-y-2">
                <Label>{t("venue_optional_scope")}</Label>
                <Select value={form.venue_id || "__none__"} onValueChange={(v) => setForm({ ...form, venue_id: v === "__none__" ? "" : v, event_id: "" })}>
                  <SelectTrigger><SelectValue placeholder={t("no_scope")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t("no_scope")}</SelectItem>
                    {filteredVenues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.venue_id && (
              <div className="space-y-2">
                <Label>{t("event_optional_scope")}</Label>
                <Select value={form.event_id || "__none__"} onValueChange={(v) => setForm({ ...form, event_id: v === "__none__" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder={t("no_scope")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t("no_scope")}</SelectItem>
                    {filteredEvents.map((ev) => <SelectItem key={ev.id} value={ev.id}>{ev.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={!form.user_id}>{t("assign_role")}</Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
