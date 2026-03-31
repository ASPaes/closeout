import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/i18n/use-translation";
import { useGestor } from "@/contexts/GestorContext";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link2, Users, Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import InviteLinkDialog from "@/components/InviteLinkDialog";
import { GestorClientGuard } from "@/components/GestorClientGuard";
import { DataTable } from "@/components/DataTable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import type { TranslationKey } from "@/i18n/translations/pt-BR";

type Venue = { id: string; name: string; client_id: string };
type Event = { id: string; name: string; venue_id: string };

type UserRow = {
  user_id: string;
  profile_name: string;
  profile_status: string;
  roles: { id: string; role: string; venue_id: string | null; event_id: string | null }[];
};

const ALLOWED_ROLES = ["cashier", "bar_staff", "waiter", "staff", "venue_manager", "event_manager"];

export default function GestorUsuarios() {
  const { t } = useTranslation();
  const { effectiveClientId, clientName } = useGestor();
  const { hasRole } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Edit roles dialog
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [addingRole, setAddingRole] = useState(false);
  const [assignRole, setAssignRole] = useState("staff");
  const [assignVenueId, setAssignVenueId] = useState("");
  const [assignEventId, setAssignEventId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);

  // Revoke confirmation
  const [revokeTarget, setRevokeTarget] = useState<{ roleId: string; userName: string; roleName: string } | null>(null);

  const canManage = hasRole("client_manager") || hasRole("super_admin") || hasRole("client_admin");

  const fetchUsers = useCallback(async () => {
    if (!effectiveClientId) return;
    setLoading(true);
    try {
      const { data: roleRows, error } = await supabase
        .from("user_roles")
        .select("id, user_id, role, venue_id, event_id")
        .eq("client_id", effectiveClientId);

      if (error) throw error;
      if (!roleRows?.length) { setUsers([]); setLoading(false); return; }

      const userIds = [...new Set(roleRows.map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, status")
        .in("id", userIds);

      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

      const grouped: Record<string, UserRow> = {};
      for (const r of roleRows) {
        if (!grouped[r.user_id]) {
          const prof = profileMap.get(r.user_id);
          grouped[r.user_id] = {
            user_id: r.user_id,
            profile_name: prof?.name ?? "—",
            profile_status: prof?.status ?? "active",
            roles: [],
          };
        }
        grouped[r.user_id].roles.push({ id: r.id, role: r.role, venue_id: r.venue_id, event_id: r.event_id });
      }
      const result = Object.values(grouped);
      setUsers(result);
      // Update editUser if open
      if (editUser) {
        const updated = result.find((u) => u.user_id === editUser.user_id);
        if (updated) setEditUser(updated);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [effectiveClientId, editUser]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (!effectiveClientId) return;
    supabase.from("venues").select("id, name, client_id").eq("client_id", effectiveClientId).eq("status", "active").order("name").then(({ data }) => setVenues(data ?? []));
    supabase.from("events").select("id, name, venue_id").order("name").then(({ data }) => setEvents(data ?? []));
  }, [effectiveClientId]);

  const roleLabel = (r: string) => {
    const key = `role_${r}` as TranslationKey;
    return t(key) || r;
  };

  const venueMap = new Map(venues.map((v) => [v.id, v.name]));
  const eventMap = new Map(events.map((e) => [e.id, e.name]));

  const roleScopeLabel = (r: { role: string; venue_id: string | null; event_id: string | null }) => {
    let label = roleLabel(r.role);
    if (r.venue_id) label += ` · ${venueMap.get(r.venue_id) ?? "—"}`;
    if (r.event_id) label += ` · ${eventMap.get(r.event_id) ?? "—"}`;
    return label;
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    const { error } = await supabase.from("user_roles").delete().eq("id", revokeTarget.roleId);
    if (error) {
      toast.error(t("gusr_revoke_error"));
    } else {
      toast.success(t("role_removed"));
      fetchUsers();
    }
    setRevokeTarget(null);
  };

  const handleAssign = async () => {
    if (!effectiveClientId || !editUser) return;
    setAssignLoading(true);
    const payload: Record<string, unknown> = {
      user_id: editUser.user_id,
      role: assignRole,
      client_id: effectiveClientId,
    };
    if (assignVenueId) payload.venue_id = assignVenueId;
    if (assignEventId) payload.event_id = assignEventId;

    const { error } = await supabase.from("user_roles").insert(payload as any);
    if (error) {
      toast.error(t("gusr_assign_error"));
    } else {
      toast.success(t("role_assigned"));
      fetchUsers();
    }
    setAssignLoading(false);
    setAddingRole(false);
    setAssignRole("staff");
    setAssignVenueId("");
    setAssignEventId("");
  };

  const filteredEvents = assignVenueId ? events.filter((e) => e.venue_id === assignVenueId) : [];

  const filteredUsers = users.filter((u) =>
    !search || u.profile_name.toLowerCase().includes(search.toLowerCase()) ||
    u.roles.some((r) => roleLabel(r.role).toLowerCase().includes(search.toLowerCase()))
  );

  const columns = [
    {
      key: "profile_name",
      header: t("name"),
      render: (row: UserRow) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.profile_name}</span>
          {row.profile_status === "inactive" && (
            <Badge variant="secondary" className="text-[10px]">{t("inactive")}</Badge>
          )}
        </div>
      ),
    },
    {
      key: "roles",
      header: t("role"),
      render: (row: UserRow) => (
        <div className="flex flex-wrap gap-1">
          {row.roles.map((r) => (
            <Badge key={r.id} variant="outline" className="text-[10px]">
              {roleScopeLabel(r)}
            </Badge>
          ))}
        </div>
      ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: t("actions"),
            render: (row: UserRow) => (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditUser(row);
                  setAddingRole(false);
                }}
                title={t("gusr_edit_roles")}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <GestorClientGuard>
      <div className="space-y-6">
        <PageHeader
          title={t("gusr_title")}
          subtitle={t("gusr_subtitle")}
          icon={Users}
          actions={
            canManage ? (
              <Button onClick={() => setInviteOpen(true)}>
                <Link2 className="mr-2 h-4 w-4" />
                {t("gusr_invite")}
              </Button>
            ) : null
          }
        />

        <DataTable
          data={filteredUsers}
          columns={columns}
          keyExtractor={(row) => row.user_id}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t("gusr_search")}
          emptyMessage={t("gusr_empty")}
          emptyHint={t("gusr_empty_hint")}
          loading={loading}
        />

        {/* Invite dialog */}
        {canManage && effectiveClientId && clientName && (
          <InviteLinkDialog
            open={inviteOpen}
            onOpenChange={setInviteOpen}
            clients={[]}
            venues={venues}
            events={events}
            clientManagerMode={{
              clientId: effectiveClientId,
              clientName: clientName,
            }}
          />
        )}

        {/* Edit roles dialog */}
        <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) { setEditUser(null); setAddingRole(false); } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("gusr_edit_roles")} — {editUser?.profile_name}</DialogTitle>
            </DialogHeader>

            {/* Current roles list */}
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">{t("gusr_current_roles")}</Label>
              {editUser?.roles.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("gusr_no_roles")}</p>
              )}
              {editUser?.roles.map((r) => {
                const isAllowed = ALLOWED_ROLES.includes(r.role);
                return (
                  <div key={r.id} className="flex items-center justify-between rounded-md border border-border/60 bg-secondary/50 px-3 py-2">
                    <span className="text-sm">{roleScopeLabel(r)}</span>
                    {isAllowed && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() =>
                          setRevokeTarget({
                            roleId: r.id,
                            userName: editUser?.profile_name ?? "",
                            roleName: roleLabel(r.role),
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            <Separator />

            {/* Add role section */}
            {!addingRole ? (
              <Button variant="outline" className="w-full" onClick={() => setAddingRole(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t("gusr_add_role")}
              </Button>
            ) : (
              <div className="space-y-3 rounded-md border border-border/60 bg-secondary/30 p-3">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("gusr_new_role")}</Label>
                <div className="space-y-2">
                  <Label>{t("role")}</Label>
                  <Select value={assignRole} onValueChange={setAssignRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ALLOWED_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("venue_optional_scope")}</Label>
                  <Select value={assignVenueId || "__none__"} onValueChange={(v) => { setAssignVenueId(v === "__none__" ? "" : v); setAssignEventId(""); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t("no_scope")}</SelectItem>
                      {venues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {assignVenueId && (
                  <div className="space-y-2">
                    <Label>{t("event_optional_scope")}</Label>
                    <Select value={assignEventId || "__none__"} onValueChange={(v) => setAssignEventId(v === "__none__" ? "" : v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t("no_scope")}</SelectItem>
                        {filteredEvents.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setAddingRole(false)} className="flex-1">{t("cancel")}</Button>
                  <Button size="sm" onClick={handleAssign} disabled={assignLoading} className="flex-1">
                    {assignLoading ? t("loading") : t("gusr_add_role")}
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => { setEditUser(null); setAddingRole(false); }}>{t("close")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Revoke confirmation */}
        <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("gusr_revoke_title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("gusr_revoke_desc")
                  .replace("{name}", revokeTarget?.userName ?? "")
                  .replace("{role}", revokeTarget?.roleName ?? "")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleRevoke} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {t("gusr_revoke")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </GestorClientGuard>
  );
}
