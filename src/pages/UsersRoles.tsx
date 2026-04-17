import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPtBrErrorMessage } from "@/lib/error-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, ShieldCheck, Link2, Users, CheckCircle2, ChevronRight, ArrowLeft, Radio, User as UserIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import { APP_ROLE } from "@/config";
import { logAudit } from "@/lib/audit";
import { maskPhone, unmask } from "@/lib/masks";
import InviteLinkDialog from "@/components/InviteLinkDialog";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { ModalForm } from "@/components/ModalForm";

type UserRole = { id: string; user_id: string; role: string; client_id: string | null; venue_id: string | null; event_id: string | null; created_at: string };
type Profile = { id: string; name: string; status: string; created_at: string };
type Client = { id: string; name: string };
type Venue = { id: string; name: string; client_id: string };
type Event = { id: string; name: string; venue_id: string };

type FlatRow = { rowKey: string; profile: Profile; userRole: UserRole | null; isFirstOfUser: boolean; userRoleCount: number };

const roleKeys: Record<string, string> = {
  [APP_ROLE.OWNER]: "role_owner",
  [APP_ROLE.SUPER_ADMIN]: "role_super_admin",
  [APP_ROLE.CLIENT_ADMIN]: "role_client_admin",
  [APP_ROLE.CLIENT_MANAGER]: "role_client_manager",
  [APP_ROLE.VENUE_MANAGER]: "role_venue_manager",
  [APP_ROLE.EVENT_MANAGER]: "role_event_manager",
  [APP_ROLE.EVENT_ORGANIZER]: "role_event_organizer",
  [APP_ROLE.STAFF]: "role_staff",
  [APP_ROLE.BAR_STAFF]: "role_bar_staff",
  [APP_ROLE.WAITER]: "role_waiter",
  [APP_ROLE.CASHIER]: "role_cashier",
  [APP_ROLE.CONSUMER]: "role_consumer",
};

const ROLE_GROUPS: Record<"gestao" | "caixas" | "garcons" | "bar", string[]> = {
  gestao: ["client_manager", "venue_manager", "event_manager", "event_organizer"],
  caixas: ["cashier"],
  garcons: ["waiter"],
  bar: ["bar_staff", "staff"],
};

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let pass = "";
  for (let i = 0; i < 8; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  return pass;
}

export default function UsersRoles() {
  const { isSuperAdmin, isOwner, user } = useAuth();
  const { t } = useTranslation();
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ user_id: "", role: APP_ROLE.STAFF as string, client_id: "", venue_id: "", event_id: "" });
  const [hasSuperAdmin, setHasSuperAdmin] = useState(true);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  // Tabs / drill-down state
  const [activeTab, setActiveTab] = useState<"staff" | "consumers">("staff");
  const [selectedClientAdmin, setSelectedClientAdmin] = useState<{ userId: string; clientId: string; userName: string; clientName: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [drilldownTab, setDrilldownTab] = useState<"gestao" | "caixas" | "garcons" | "bar">("gestao");

  // Super Admin creation (owner only)
  const [superAdminOpen, setSuperAdminOpen] = useState(false);
  const [saName, setSaName] = useState("");
  const [saEmail, setSaEmail] = useState("");
  const [saPassword, setSaPassword] = useState(() => generatePassword());
  const [saPhone, setSaPhone] = useState("");
  const [saSaving, setSaSaving] = useState(false);
  const [saSuccessData, setSaSuccessData] = useState<{ name: string; email: string; password: string } | null>(null);
  const [saSuccessOpen, setSaSuccessOpen] = useState(false);

  const rolesByUser = useMemo(() => {
    const map = new Map<string, UserRole[]>();
    userRoles.forEach((ur) => {
      const list = map.get(ur.user_id) || [];
      list.push(ur);
      map.set(ur.user_id, list);
    });
    return map;
  }, [userRoles]);

  const filteredVenues = useMemo(() => form.client_id ? venues.filter((v) => v.client_id === form.client_id) : [], [form.client_id, venues]);
  const filteredEvents = useMemo(() => form.venue_id ? events.filter((e) => e.venue_id === form.venue_id) : [], [form.venue_id, events]);

  const fetchData = async () => {
    setLoading(true);
    const [p, ur, c, v, ev] = await Promise.all([
      supabase.from("profiles").select("id, name, status, created_at").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, name"),
      supabase.from("venues").select("id, name, client_id"),
      supabase.from("events").select("id, name, venue_id"),
    ]);
    if (ur.error) toast.error(getPtBrErrorMessage(ur.error));
    if (p.data) setProfiles(p.data as Profile[]);
    if (ur.data) { setUserRoles(ur.data as UserRole[]); setHasSuperAdmin(ur.data.some((r: any) => r.role === "super_admin")); }
    if (c.data) setClients(c.data as Client[]);
    if (v.data) setVenues(v.data as Venue[]);
    if (ev.data) setEvents(ev.data as Event[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleBootstrap = async () => {
    setBootstrapping(true);
    const { data, error } = await supabase.rpc("bootstrap_super_admin");
    setBootstrapping(false);
    if (error) { toast.error(getPtBrErrorMessage(error)); return; }
    if (data) { toast.success(t("role_assigned")); fetchData(); window.location.reload(); }
    else toast.error("Super admin já existe no sistema.");
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload: any = { user_id: form.user_id, role: form.role };
    if (form.client_id) payload.client_id = form.client_id;
    if (form.venue_id) payload.venue_id = form.venue_id;
    if (form.event_id) payload.event_id = form.event_id;
    const { data, error } = await supabase.from("user_roles").insert(payload).select("id").single();
    if (error) { toast.error(getPtBrErrorMessage(error)); setSaving(false); return; }
    if (data) await logAudit({ action: "user.role_assigned", entityType: "user_role", entityId: data.id, metadata: { user_id: payload.user_id, role: payload.role, client_id: payload.client_id || null }, newData: payload });
    toast.success(t("role_assigned"));
    setSaving(false);
    setSheetOpen(false); fetchData();
  };

  const handleRemove = async (ur: UserRole) => {
    const { error } = await supabase.from("user_roles").delete().eq("id", ur.id);
    if (error) { toast.error(getPtBrErrorMessage(error)); return; }
    await logAudit({ action: "user.role_removed", entityType: "user_role", entityId: ur.id, metadata: { user_id: ur.user_id, role: ur.role, client_id: ur.client_id }, oldData: { user_id: ur.user_id, role: ur.role, client_id: ur.client_id } });
    toast.success(t("role_removed"));
    fetchData();
  };

  const handleCreateSuperAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaSaving(true);
    const { data, error } = await supabase.functions.invoke("create-super-admin", {
      body: { email: saEmail, password: saPassword, name: saName, phone: saPhone || undefined },
    });

    if (error) {
      let detail = "Erro ao criar super admin";
      try {
        if (error?.context?.body) {
          const bodyText = await error.context.body.text?.();
          if (bodyText) {
            const parsed = JSON.parse(bodyText);
            detail = parsed.detail || detail;
          }
        }
      } catch { /* ignore */ }
      toast.error(detail);
      setSaSaving(false);
      return;
    }

    setSaSuccessData({ name: saName, email: saEmail, password: saPassword });
    setSaSuccessOpen(true);
    setSuperAdminOpen(false);
    setSaSaving(false);
    fetchData();
  };

  const renderScope = (ur: UserRole) => {
    const parts: string[] = [];
    if (ur.client_id) parts.push(`${t("client")}: ${ur.client_id.slice(0, 8)}`);
    if (ur.venue_id) parts.push(`${t("venue")}: ${ur.venue_id.slice(0, 8)}`);
    if (ur.event_id) parts.push(`${t("event_label")}: ${ur.event_id.slice(0, 8)}`);
    return parts.length > 0 ? parts.join(" · ") : t("global");
  };

  const filteredProfiles = profiles.filter((p) => {
    const q = search.toLowerCase();
    if (!q) return true;
    if (p.name?.toLowerCase().includes(q)) return true;
    const roles = rolesByUser.get(p.id) || [];
    return roles.some((r) => r.role.includes(q));
  });

  const flatRows: FlatRow[] = useMemo(() => {
    const rows: FlatRow[] = [];
    filteredProfiles.forEach((profile) => {
      const roles = rolesByUser.get(profile.id) || [];
      if (roles.length === 0) {
        rows.push({ rowKey: profile.id, profile, userRole: null, isFirstOfUser: true, userRoleCount: 0 });
      } else {
        roles.forEach((ur, idx) => {
          rows.push({ rowKey: ur.id, profile, userRole: ur, isFirstOfUser: idx === 0, userRoleCount: roles.length });
        });
      }
    });
    return rows;
  }, [filteredProfiles, rolesByUser]);

  const columns: DataTableColumn<FlatRow>[] = [
    { key: "user", header: t("user"), render: (r) => r.isFirstOfUser ? <span className="font-medium">{r.profile.name || r.profile.id.slice(0, 12) + "…"}</span> : null },
    { key: "status", header: t("status"), render: (r) => r.isFirstOfUser ? <StatusBadge status={r.profile.status === "active" ? "active" : "inactive"} label={r.profile.status === "active" ? t("active") : t("inactive")} /> : null },
    { key: "role", header: t("role"), render: (r) => r.userRole ? (
      <Badge variant="outline" className="capitalize">{roleKeys[r.userRole.role] ? t(roleKeys[r.userRole.role] as any) : r.userRole.role}</Badge>
    ) : <Badge variant="outline" className="text-muted-foreground">{t("no_role")}</Badge> },
    { key: "scope", header: t("scope"), render: (r) => <span className="text-muted-foreground text-xs">{r.userRole ? renderScope(r.userRole) : "—"}</span> },
    ...((isSuperAdmin || isOwner) ? [{ key: "actions", header: t("actions"), className: "w-20", render: (r: FlatRow) => r.userRole ? (
      <Button variant="ghost" size="icon" onClick={() => handleRemove(r.userRole!)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
        <Trash2 className="h-4 w-4" />
      </Button>
    ) : null }] : []),
  ];

  const headerActions = (
    <div className="flex gap-2">
      {!hasSuperAdmin && user && (
        <Button variant="outline" onClick={handleBootstrap} disabled={bootstrapping}>
          <ShieldCheck className="mr-2 h-4 w-4" />{t("bootstrap_super_admin")}
        </Button>
      )}
      {isOwner && (
        <Button variant="outline" onClick={() => {
          setSaName(""); setSaEmail(""); setSaPassword(generatePassword()); setSaPhone("");
          setSuperAdminOpen(true);
        }}>
          <ShieldCheck className="mr-2 h-4 w-4" />{t("create_super_admin")}
        </Button>
      )}
      {(isSuperAdmin || isOwner) && (
        <>
          <Button variant="outline" onClick={() => setInviteDialogOpen(true)}>
            <Link2 className="mr-2 h-4 w-4" />{t("invite_by_link")}
          </Button>
          <Button onClick={() => { setForm({ user_id: "", role: APP_ROLE.STAFF as string, client_id: "", venue_id: "", event_id: "" }); setSheetOpen(true); }} className="glow-hover">
            <Plus className="mr-2 h-4 w-4" />{t("assign_role")}
          </Button>
        </>
      )}
    </div>
  );

  // Helpers para abas
  const getClientAdminInfo = (userId: string) => {
    const roles = rolesByUser.get(userId) || [];
    const adminRole = roles.find((r) => r.role === "client_admin");
    if (!adminRole || !adminRole.client_id) return { clientId: null as string | null, clientName: "—" };
    const cName = clients.find((c) => c.id === adminRole.client_id)?.name ?? "—";
    return { clientId: adminRole.client_id, clientName: cName };
  };

  const matchesStatus = (p: Profile) => statusFilter === "all" || p.status === statusFilter;
  const matchesSearch = (p: Profile) => !search || (p.name?.toLowerCase().includes(search.toLowerCase()) ?? false);

  const clientAdmins = profiles.filter((p) => {
    const roles = rolesByUser.get(p.id) || [];
    return roles.some((r) => r.role === "client_admin") && matchesStatus(p) && matchesSearch(p);
  });

  const consumers = profiles.filter((p) => {
    const roles = rolesByUser.get(p.id) || [];
    return roles.some((r) => r.role === "consumer") && matchesStatus(p) && matchesSearch(p);
  });

  type AdminRow = Profile & { _clientId: string | null; _clientName: string };
  const clientAdminRows: AdminRow[] = clientAdmins.map((p) => {
    const info = getClientAdminInfo(p.id);
    return { ...p, _clientId: info.clientId, _clientName: info.clientName };
  });

  const adminColumns: DataTableColumn<AdminRow>[] = [
    {
      key: "admin",
      header: "Admin",
      render: (r) => (
        <div
          onClick={() => handleRowClick(r)}
          className={`font-medium transition-colors ${r._clientId ? "cursor-pointer hover:text-primary" : "cursor-not-allowed text-muted-foreground"}`}
        >
          {r.name || r.id.slice(0, 12) + "…"}
        </div>
      ),
    },
    {
      key: "status",
      header: t("status"),
      render: (r) => (
        <div onClick={() => handleRowClick(r)} className={r._clientId ? "cursor-pointer" : "cursor-not-allowed"}>
          <StatusBadge status={r.status === "active" ? "active" : "inactive"} label={r.status === "active" ? t("active") : t("inactive")} />
        </div>
      ),
    },
    {
      key: "client",
      header: t("client"),
      render: (r) => (
        <div onClick={() => handleRowClick(r)} className={`text-sm ${r._clientId ? "cursor-pointer" : "cursor-not-allowed"}`}>
          {r._clientName}
        </div>
      ),
    },
    {
      key: "chevron",
      header: "",
      className: "w-10",
      render: (r) => (
        <div onClick={() => handleRowClick(r)} className={r._clientId ? "cursor-pointer" : "cursor-not-allowed"}>
          <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
        </div>
      ),
    },
  ];

  const consumerColumns: DataTableColumn<Profile>[] = [
    { key: "consumer", header: "Consumidor", render: (p) => <span className="font-medium">{p.name || p.id.slice(0, 12) + "…"}</span> },
    {
      key: "status",
      header: t("status"),
      render: (p) => (
        <StatusBadge status={p.status === "active" ? "active" : "inactive"} label={p.status === "active" ? t("active") : t("inactive")} />
      ),
    },
    ...((isSuperAdmin || isOwner)
      ? [{
          key: "actions",
          header: t("actions"),
          className: "w-20",
          render: (p: Profile) => {
            const consumerRole = (rolesByUser.get(p.id) || []).find((r) => r.role === "consumer");
            return consumerRole ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(consumerRole)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null;
          },
        }]
      : []),
  ];

  const handleRowClick = (r: AdminRow) => {
    if (!r._clientId) return;
    setSelectedClientAdmin({ userId: r.id, clientId: r._clientId, userName: r.name || r.id.slice(0, 12), clientName: r._clientName });
    setSearch("");
    setStatusFilter("all");
  };

  const statusFilterSelect = (
    <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | "active" | "inactive")}>
      <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos status</SelectItem>
        <SelectItem value="active">Ativos</SelectItem>
        <SelectItem value="inactive">Inativos</SelectItem>
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-6">
      {selectedClientAdmin === null ? (
        <>
          <PageHeader title={t("users_roles")} subtitle={t("manage_roles")} icon={Users} actions={headerActions} />

          <Tabs
            value={activeTab}
            onValueChange={(v) => { setActiveTab(v as "staff" | "consumers"); setStatusFilter("all"); setSearch(""); }}
          >
            <TabsList>
              <TabsTrigger value="staff">Staff</TabsTrigger>
              <TabsTrigger value="consumers">Consumidores</TabsTrigger>
            </TabsList>

            <TabsContent value="staff" className="space-y-4">
              <DataTable
                columns={adminColumns}
                data={clientAdminRows}
                keyExtractor={(r) => r.id}
                loading={loading}
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Buscar admin..."
                emptyMessage="Nenhum admin encontrado"
                filters={statusFilterSelect}
              />
            </TabsContent>

            <TabsContent value="consumers" className="space-y-4">
              <DataTable
                columns={consumerColumns}
                data={consumers}
                keyExtractor={(p) => p.id}
                loading={loading}
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Buscar consumidor..."
                emptyMessage="Nenhum consumidor encontrado"
                filters={statusFilterSelect}
              />
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <Button
                variant="outline"
                onClick={() => { setSelectedClientAdmin(null); setSearch(""); setStatusFilter("all"); }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{selectedClientAdmin.userName}</h1>
                <p className="text-sm text-muted-foreground">{selectedClientAdmin.clientName}</p>
              </div>
            </div>
            {headerActions}
          </div>

          {(() => {
            const profileById = new Map(profiles.map((p) => [p.id, p]));
            const allowedRoles = ROLE_GROUPS[drilldownTab];
            const q = search.toLowerCase();
            const rows = userRoles.filter((ur) => {
              if (ur.client_id !== selectedClientAdmin.clientId) return false;
              if (!allowedRoles.includes(ur.role)) return false;
              const prof = profileById.get(ur.user_id);
              if (!prof) return false;
              if (statusFilter !== "all" && prof.status !== statusFilter) return false;
              if (!q) return true;
              const nameMatch = prof.name?.toLowerCase().includes(q) ?? false;
              const roleMatch = ur.role.toLowerCase().includes(q);
              return nameMatch || roleMatch;
            });

            type DrillRow = { ur: UserRole; profile: Profile };
            const drillRows: DrillRow[] = rows
              .map((ur) => ({ ur, profile: profileById.get(ur.user_id)! }))
              .filter((r) => !!r.profile);

            const drillColumns: DataTableColumn<DrillRow>[] = [
              { key: "user", header: t("user"), render: (r) => <span className="font-medium">{r.profile.name || r.profile.id.slice(0, 12) + "…"}</span> },
              { key: "status", header: t("status"), render: (r) => <StatusBadge status={r.profile.status === "active" ? "active" : "inactive"} label={r.profile.status === "active" ? t("active") : t("inactive")} /> },
              { key: "role", header: t("role"), render: (r) => <Badge variant="outline" className="capitalize">{roleKeys[r.ur.role] ? t(roleKeys[r.ur.role] as any) : r.ur.role}</Badge> },
              { key: "scope", header: t("scope"), render: (r) => <span className="text-muted-foreground text-xs">{renderScope(r.ur)}</span> },
              ...((isSuperAdmin || isOwner) ? [{
                key: "actions", header: t("actions"), className: "w-20",
                render: (r: DrillRow) => (
                  <Button variant="ghost" size="icon" onClick={() => handleRemove(r.ur)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ),
              }] : []),
            ];

            return (
              <Tabs value={drilldownTab} onValueChange={(v) => { setDrilldownTab(v as "gestao" | "caixas" | "garcons" | "bar"); setSearch(""); }}>
                <TabsList>
                  <TabsTrigger value="gestao">Gestão</TabsTrigger>
                  <TabsTrigger value="caixas">Caixas</TabsTrigger>
                  <TabsTrigger value="garcons">Garçons</TabsTrigger>
                  <TabsTrigger value="bar">Bar</TabsTrigger>
                </TabsList>

                <TabsContent value={drilldownTab} className="space-y-4">
                  <DataTable
                    columns={drillColumns}
                    data={drillRows}
                    keyExtractor={(r) => r.ur.id}
                    loading={loading}
                    search={search}
                    onSearchChange={setSearch}
                    searchPlaceholder="Buscar..."
                    emptyMessage="Nenhum usuário nesta categoria"
                    filters={statusFilterSelect}
                  />
                </TabsContent>
              </Tabs>
            );
          })()}
        </>
      )}
      <ModalForm open={sheetOpen} onOpenChange={setSheetOpen} title={t("assign_role")}
        onSubmit={handleAssign} saving={saving} submitLabel={t("assign_role")} disabled={!form.user_id}>
        <div className="space-y-2">
          <Label>{t("user")}</Label>
          <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
            <SelectTrigger><SelectValue placeholder={t("select_user")} /></SelectTrigger>
            <SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.name || p.id.slice(0, 12)}</SelectItem>)}</SelectContent>
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
      </ModalForm>

      {/* Create Super Admin Modal (owner only) */}
      <ModalForm open={superAdminOpen} onOpenChange={setSuperAdminOpen} title={t("create_super_admin")}
        onSubmit={handleCreateSuperAdmin} saving={saSaving} submitLabel={t("create_super_admin")}>
        <div className="space-y-1.5">
          <Label>{t("name")} *</Label>
          <Input value={saName} onChange={(e) => setSaName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>{t("email")} *</Label>
          <Input type="email" value={saEmail} onChange={(e) => setSaEmail(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>{t("manager_password_label")}</Label>
          <div className="flex gap-2">
            <Input type="text" value={saPassword} onChange={(e) => setSaPassword(e.target.value)} className="font-mono" />
            <Button type="button" variant="outline" size="sm" onClick={() => setSaPassword(generatePassword())}>
              {t("generate_password")}
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{t("phone")}</Label>
          <Input value={maskPhone(saPhone)} onChange={(e) => setSaPhone(unmask(e.target.value))} placeholder="(00) 00000-0000" />
        </div>
      </ModalForm>

      {/* Super Admin Success Dialog */}
      <Dialog open={saSuccessOpen} onOpenChange={setSaSuccessOpen}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center gap-4 py-4">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <h3 className="text-lg font-semibold">{t("super_admin_created")}</h3>
            <div className="w-full space-y-2 rounded-lg border border-border bg-muted/30 p-4 text-sm">
              <p><span className="text-muted-foreground">{t("name")}:</span> {saSuccessData?.name}</p>
              <p><span className="text-muted-foreground">{t("email")}:</span> {saSuccessData?.email}</p>
              <p><span className="text-muted-foreground">{t("password")}:</span> <span className="font-mono">{saSuccessData?.password}</span></p>
              <p><span className="text-muted-foreground">{t("activation_access_url")}:</span> https://closeout.lovable.app/admin</p>
            </div>
            <Button onClick={() => {
              navigator.clipboard.writeText(
                `Close Out — Dados de Acesso\nNome: ${saSuccessData?.name}\nEmail: ${saSuccessData?.email}\nSenha: ${saSuccessData?.password}\nAcesso: https://closeout.lovable.app/admin`
              );
              toast.success(t("access_data_copied"));
            }} className="w-full">
              {t("copy_access_data")}
            </Button>
            <Button variant="outline" onClick={() => setSaSuccessOpen(false)} className="w-full">
              {t("close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <InviteLinkDialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen} clients={clients} venues={venues} events={events} />
    </div>
  );
}
