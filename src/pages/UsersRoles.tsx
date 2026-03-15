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
import { Plus, Search, Trash2, ShieldCheck, Link2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import { APP_ROLE } from "@/config";
import { logAudit } from "@/lib/audit";
import InviteLinkDialog from "@/components/InviteLinkDialog";

type UserRole = { id: string; user_id: string; role: string; client_id: string | null; venue_id: string | null; event_id: string | null; created_at: string };
type Profile = { id: string; name: string; status: string; created_at: string };
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
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  // Group roles by user_id for quick lookup
  const rolesByUser = useMemo(() => {
    const map = new Map<string, UserRole[]>();
    userRoles.forEach((ur) => {
      const list = map.get(ur.user_id) || [];
      list.push(ur);
      map.set(ur.user_id, list);
    });
    return map;
  }, [userRoles]);

  const filteredVenues = useMemo(() => {
    if (!form.client_id) return [];
    return venues.filter((v) => v.client_id === form.client_id);
  }, [form.client_id, venues]);

  const filteredEvents = useMemo(() => {
    if (!form.venue_id) return [];
    return events.filter((e) => e.venue_id === form.venue_id);
  }, [form.venue_id, events]);

  const fetchData = async () => {
    const [p, ur, c, v, ev] = await Promise.all([
      supabase.from("profiles").select("id, name, status, created_at").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, name"),
      supabase.from("venues").select("id, name, client_id"),
      supabase.from("events").select("id, name, venue_id"),
    ]);
    if (ur.error) toast.error(getPtBrErrorMessage(ur.error));
    if (p.error) toast.error(getPtBrErrorMessage(p.error));
    if (p.data) setProfiles(p.data as Profile[]);
    if (ur.data) {
      setUserRoles(ur.data as UserRole[]);
      setHasSuperAdmin(ur.data.some((r: any) => r.role === "super_admin"));
    }
    if (c.data) setClients(c.data as Client[]);
    if (v.data) setVenues(v.data as Venue[]);
    if (ev.data) setEvents(ev.data as Event[]);
  };

  useEffect(() => { fetchData(); }, []);

  const handleBootstrap = async () => {
    setBootstrapping(true);
    const { data, error } = await supabase.rpc("bootstrap_super_admin");
    setBootstrapping(false);
    if (error) { toast.error(getPtBrErrorMessage(error)); return; }
    if (data) {
      toast.success(t("role_assigned"));
      fetchData();
      window.location.reload();
    } else {
      toast.error("Super admin já existe no sistema.");
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { user_id: form.user_id, role: form.role };
    if (form.client_id) payload.client_id = form.client_id;
    if (form.venue_id) payload.venue_id = form.venue_id;
    if (form.event_id) payload.event_id = form.event_id;
    const { data, error } = await supabase.from("user_roles").insert(payload).select("id").single();
    if (error) { toast.error(getPtBrErrorMessage(error)); return; }
    if (data) await logAudit({ action: "user.role_assigned", entityType: "user_role", entityId: data.id, metadata: { user_id: payload.user_id, role: payload.role, client_id: payload.client_id || null }, newData: payload });
    toast.success(t("role_assigned"));
    setSheetOpen(false); fetchData();
  };

  const handleRemove = async (ur: UserRole) => {
    const { error } = await supabase.from("user_roles").delete().eq("id", ur.id);
    if (error) { toast.error(getPtBrErrorMessage(error)); return; }
    await logAudit({ action: "user.role_removed", entityType: "user_role", entityId: ur.id, metadata: { user_id: ur.user_id, role: ur.role, client_id: ur.client_id }, oldData: { user_id: ur.user_id, role: ur.role, client_id: ur.client_id } });
    toast.success(t("role_removed"));
    fetchData();
  };

  const renderScope = (ur: UserRole) => {
    const parts: string[] = [];
    if (ur.client_id) parts.push(`${t("client")}: ${ur.client_id.slice(0, 8)}`);
    if (ur.venue_id) parts.push(`${t("venue")}: ${ur.venue_id.slice(0, 8)}`);
    if (ur.event_id) parts.push(`${t("event_label")}: ${ur.event_id.slice(0, 8)}`);
    return parts.length > 0 ? parts.join(" · ") : t("global");
  };

  // Filter profiles by search (name or role)
  const filtered = profiles.filter((p) => {
    const q = search.toLowerCase();
    if (!q) return true;
    if (p.name?.toLowerCase().includes(q)) return true;
    const roles = rolesByUser.get(p.id) || [];
    return roles.some((r) => r.role.includes(q));
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
            <>
              <Button variant="outline" onClick={() => setInviteDialogOpen(true)}>
                <Link2 className="mr-2 h-4 w-4" />{t("invite_by_link")}
              </Button>
              <Button onClick={() => { setForm({ user_id: "", role: APP_ROLE.STAFF as string, client_id: "", venue_id: "", event_id: "" }); setSheetOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />{t("assign_role")}
              </Button>
            </>
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
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("role")}</TableHead>
                <TableHead>{t("scope")}</TableHead>
                {isSuperAdmin && <TableHead className="w-20">{t("actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((profile) => {
                const roles = rolesByUser.get(profile.id) || [];
                const hasRoles = roles.length > 0;

                if (!hasRoles) {
                  // Single row: user with no roles
                  return (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">{profile.name || profile.id.slice(0, 12) + "…"}</TableCell>
                      <TableCell>
                        <Badge variant={profile.status === "active" ? "default" : "secondary"} className="capitalize">
                          {profile.status === "active" ? t("active") : t("inactive")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-muted-foreground">{t("no_role")}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">—</TableCell>
                      {isSuperAdmin && <TableCell />}
                    </TableRow>
                  );
                }

                // One row per role for users with roles
                return roles.map((ur, idx) => (
                  <TableRow key={ur.id}>
                    {idx === 0 ? (
                      <>
                        <TableCell className="font-medium" rowSpan={roles.length}>
                          {profile.name || profile.id.slice(0, 12) + "…"}
                        </TableCell>
                        <TableCell rowSpan={roles.length}>
                          <Badge variant={profile.status === "active" ? "default" : "secondary"} className="capitalize">
                            {profile.status === "active" ? t("active") : t("inactive")}
                          </Badge>
                        </TableCell>
                      </>
                    ) : null}
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {roleKeys[ur.role] ? t(roleKeys[ur.role] as any) : ur.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{renderScope(ur)}</TableCell>
                    {isSuperAdmin && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleRemove(ur)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ));
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t("no_roles_assigned")}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Assign Role Sheet */}
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

      <InviteLinkDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        clients={clients}
        venues={venues}
        events={events}
      />
    </div>
  );
}
