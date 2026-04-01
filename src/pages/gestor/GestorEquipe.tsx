import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/i18n/use-translation";
import { useGestor } from "@/contexts/GestorContext";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link2, UserPlus, Trash2, Users, CheckCircle, Clock } from "lucide-react";
import InviteLinkDialog from "@/components/InviteLinkDialog";
import { GestorClientGuard } from "@/components/GestorClientGuard";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { format } from "date-fns";

type Venue = { id: string; name: string; client_id: string };
type Event = { id: string; name: string; venue_id: string };

type InviteRow = {
  id: string;
  email: string | null;
  role: string;
  client_id: string | null;
  venue_id: string | null;
  event_id: string | null;
  created_at: string;
  expires_at: string | null;
  used_at: string | null;
  used_by: string | null;
  created_by: string;
};

type ProfileInfo = { id: string; name: string; status: string };

type EnrichedInvite = InviteRow & {
  usedByName: string | null;
  usedByStatus: string | null;
  createdByName: string | null;
  venueName: string | null;
  eventName: string | null;
  inviteStatus: "accepted" | "expired" | "pending";
  activityStatus: "online" | "offline" | "disabled" | null;
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  client_admin: "Admin do Cliente",
  client_manager: "Gestor do Cliente",
  venue_manager: "Gerente de Local",
  event_manager: "Gerente de Evento",
  event_organizer: "Organizador de Evento",
  staff: "Equipe",
  bar_staff: "Equipe de Bar",
  waiter: "Garçom",
  cashier: "Caixa",
  consumer: "Consumidor",
};

function getInviteStatus(invite: InviteRow): "accepted" | "expired" | "pending" {
  if (invite.used_at) return "accepted";
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) return "expired";
  return "pending";
}

const inviteStatusMap: Record<string, { variant: "active" | "inactive" | "draft"; label: string }> = {
  accepted: { variant: "active", label: "Aceito" },
  expired: { variant: "inactive", label: "Expirado" },
  pending: { variant: "draft", label: "Pendente" },
};

type StatusFilter = "all" | "accepted" | "pending" | "expired";

function ActivityBadge({ status }: { status: "online" | "offline" | "disabled" | null }) {
  if (!status) return <span className="text-sm text-muted-foreground">—</span>;
  if (status === "online") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
        <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
        Online
      </span>
    );
  }
  if (status === "disabled") {
    return (
      <Badge variant="outline" className="text-xs bg-destructive/15 text-destructive border-destructive/25">
        Desativado
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border">
      Offline
    </Badge>
  );
}

export default function GestorEquipe() {
  const { t } = useTranslation();
  const { effectiveClientId, clientName } = useGestor();
  const { hasRole } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [invites, setInvites] = useState<EnrichedInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [revoking, setRevoking] = useState<string | null>(null);

  const canInvite =
    hasRole("client_manager") || hasRole("super_admin") ||
    hasRole("client_admin") || hasRole("venue_manager");

  const fetchInvites = async () => {
    if (!effectiveClientId) return;
    setLoading(true);

    const { data: rawInvites, error } = await supabase
      .from("user_invites")
      .select("id, email, role, client_id, venue_id, event_id, created_at, expires_at, used_at, used_by, created_by")
      .eq("client_id", effectiveClientId)
      .order("created_at", { ascending: false });

    if (error || !rawInvites) {
      toast.error("Erro ao carregar convites");
      setLoading(false);
      return;
    }

    // Collect unique IDs for batch queries
    const profileIds = new Set<string>();
    const venueIds = new Set<string>();
    const eventIds = new Set<string>();
    const waiterIds: string[] = [];
    const cashierIds: string[] = [];

    for (const inv of rawInvites) {
      if (inv.used_by) profileIds.add(inv.used_by);
      if (inv.created_by) profileIds.add(inv.created_by);
      if (inv.venue_id) venueIds.add(inv.venue_id);
      if (inv.event_id) eventIds.add(inv.event_id);
      if (inv.used_by && inv.role === "waiter") waiterIds.push(inv.used_by);
      if (inv.used_by && inv.role === "cashier") cashierIds.push(inv.used_by);
    }

    const [profilesRes, venuesRes, eventsRes, waiterSessionsRes, cashRegRes] = await Promise.all([
      profileIds.size > 0
        ? supabase.from("profiles").select("id, name, status").in("id", [...profileIds])
        : Promise.resolve({ data: [] as ProfileInfo[] }),
      venueIds.size > 0
        ? supabase.from("venues").select("id, name").in("id", [...venueIds])
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      eventIds.size > 0
        ? supabase.from("events").select("id, name").in("id", [...eventIds])
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      waiterIds.length > 0
        ? supabase.from("waiter_sessions").select("waiter_id").in("waiter_id", waiterIds).eq("status", "active")
        : Promise.resolve({ data: [] as { waiter_id: string }[] }),
      cashierIds.length > 0
        ? supabase.from("cash_registers").select("operator_id").in("operator_id", cashierIds).eq("status", "open")
        : Promise.resolve({ data: [] as { operator_id: string }[] }),
    ]);

    const profileMap = new Map((profilesRes.data ?? []).map((p: ProfileInfo) => [p.id, p]));
    const venueMap = new Map((venuesRes.data ?? []).map((v: { id: string; name: string }) => [v.id, v.name]));
    const eventMap = new Map((eventsRes.data ?? []).map((e: { id: string; name: string }) => [e.id, e.name]));
    const activeWaiters = new Set((waiterSessionsRes.data ?? []).map((s: { waiter_id: string }) => s.waiter_id));
    const activeCashiers = new Set((cashRegRes.data ?? []).map((s: { operator_id: string }) => s.operator_id));

    const enriched: EnrichedInvite[] = rawInvites.map((inv) => {
      const profile = inv.used_by ? profileMap.get(inv.used_by) : null;
      let activityStatus: EnrichedInvite["activityStatus"] = null;

      if (inv.used_by && profile) {
        if (profile.status === "inactive") {
          activityStatus = "disabled";
        } else if (inv.role === "waiter" && activeWaiters.has(inv.used_by)) {
          activityStatus = "online";
        } else if (inv.role === "cashier" && activeCashiers.has(inv.used_by)) {
          activityStatus = "online";
        } else {
          activityStatus = "offline";
        }
      }

      return {
        ...inv,
        usedByName: profile?.name ?? null,
        usedByStatus: profile?.status ?? null,
        createdByName: profileMap.get(inv.created_by)?.name ?? null,
        venueName: inv.venue_id ? venueMap.get(inv.venue_id) ?? null : null,
        eventName: inv.event_id ? eventMap.get(inv.event_id) ?? null : null,
        inviteStatus: getInviteStatus(inv),
        activityStatus,
      };
    });

    setInvites(enriched);
    setLoading(false);
  };

  useEffect(() => {
    if (!effectiveClientId) return;
    supabase.from("venues").select("id, name, client_id").eq("client_id", effectiveClientId).eq("status", "active").order("name").then(({ data }) => setVenues(data ?? []));
    supabase.from("events").select("id, name, venue_id").order("name").then(({ data }) => setEvents(data ?? []));
    fetchInvites();
  }, [effectiveClientId]);

  const handleRevoke = async (inviteId: string) => {
    setRevoking(inviteId);
    const { error } = await supabase
      .from("user_invites")
      .update({ expires_at: new Date().toISOString() })
      .eq("id", inviteId);
    if (error) {
      toast.error("Erro ao revogar convite");
    } else {
      toast.success("Convite revogado");
      fetchInvites();
    }
    setRevoking(null);
  };

  // Stats
  const totalCount = invites.length;
  const acceptedCount = invites.filter((i) => i.inviteStatus === "accepted").length;
  const pendingCount = invites.filter((i) => i.inviteStatus === "pending").length;

  // Filtered data
  const filteredInvites = useMemo(() => {
    let list = invites;

    if (statusFilter !== "all") {
      list = list.filter((i) => i.inviteStatus === statusFilter);
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          (i.email && i.email.toLowerCase().includes(q)) ||
          (i.usedByName && i.usedByName.toLowerCase().includes(q)) ||
          (ROLE_LABELS[i.role] ?? i.role).toLowerCase().includes(q)
      );
    }

    return list;
  }, [invites, search, statusFilter]);

  const filterPills: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "accepted", label: "Aceitos" },
    { key: "pending", label: "Pendentes" },
    { key: "expired", label: "Expirados" },
  ];

  const columns: DataTableColumn<EnrichedInvite>[] = [
    {
      key: "role",
      header: "Função",
      render: (row) => (
        <span className="text-sm font-medium">{ROLE_LABELS[row.role] ?? row.role}</span>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (row) => (
        <span className="text-sm text-muted-foreground">{row.email || "—"}</span>
      ),
    },
    {
      key: "scope",
      header: "Escopo",
      render: (row) => {
        if (row.eventName) return <span className="text-sm">Evento: {row.eventName}</span>;
        if (row.venueName) return <span className="text-sm">Local: {row.venueName}</span>;
        return <span className="text-sm text-muted-foreground">—</span>;
      },
    },
    {
      key: "inviteStatus",
      header: "Status",
      render: (row) => {
        const s = inviteStatusMap[row.inviteStatus];
        return <StatusBadge status={s.variant} label={s.label} />;
      },
    },
    {
      key: "usedBy",
      header: "Aceito por",
      render: (row) => (
        <span className="text-sm">{row.usedByName || "—"}</span>
      ),
    },
    {
      key: "activity",
      header: "Situação Atual",
      render: (row) => <ActivityBadge status={row.activityStatus} />,
    },
    {
      key: "createdAt",
      header: "Criado em",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(row.created_at), "dd/MM/yy HH:mm")}
        </span>
      ),
    },
    {
      key: "createdBy",
      header: "Criado por",
      render: (row) => (
        <span className="text-sm">{row.createdByName || "—"}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-[80px]",
      render: (row) => {
        if (row.inviteStatus !== "pending") return null;
        return (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            disabled={revoking === row.id}
            onClick={() => handleRevoke(row.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        );
      },
    },
  ];

  return (
    <GestorClientGuard>
      <div className="space-y-6">
        <PageHeader
          title={t("gestor_invite_team")}
          subtitle={t("gestor_invite_team_desc")}
          icon={UserPlus}
          actions={
            canInvite ? (
              <Button onClick={() => setInviteOpen(true)}>
                <Link2 className="mr-2 h-4 w-4" />
                {t("invite_generate_link")}
              </Button>
            ) : null
          }
        />

        {/* Metric cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold text-foreground">{totalCount}</p>
                <p className="text-xs text-muted-foreground">Total de Convites</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <CheckCircle className="h-8 w-8 text-success" />
              <div>
                <p className="text-2xl font-bold text-success">{acceptedCount}</p>
                <p className="text-xs text-muted-foreground">Aceitos</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <Clock className="h-8 w-8 text-warning" />
              <div>
                <p className="text-2xl font-bold text-warning">{pendingCount}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter pills + table */}
        <DataTable
          columns={columns}
          data={filteredInvites}
          keyExtractor={(row) => row.id}
          loading={loading}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar por email, nome ou função..."
          emptyMessage="Nenhum convite encontrado"
          emptyHint="Gere um link de convite para adicionar membros à equipe"
          filters={
            <div className="flex gap-1.5">
              {filterPills.map((pill) => (
                <Button
                  key={pill.key}
                  variant={statusFilter === pill.key ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setStatusFilter(pill.key)}
                >
                  {pill.label}
                </Button>
              ))}
            </div>
          }
        />

        {canInvite && effectiveClientId && clientName && (
          <InviteLinkDialog
            open={inviteOpen}
            onOpenChange={(open) => {
              setInviteOpen(open);
              if (!open) fetchInvites();
            }}
            clients={[]}
            venues={venues}
            events={events}
            clientManagerMode={{
              clientId: effectiveClientId,
              clientName: clientName,
            }}
          />
        )}
      </div>
    </GestorClientGuard>
  );
}
