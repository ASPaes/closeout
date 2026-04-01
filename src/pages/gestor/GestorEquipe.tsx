import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/i18n/use-translation";
import { useGestor } from "@/contexts/GestorContext";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

type EnrichedInvite = InviteRow & {
  usedByName: string | null;
  createdByName: string | null;
  venueName: string | null;
  eventName: string | null;
  status: "accepted" | "expired" | "pending";
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
  cashier: "Operador de Caixa",
  consumer: "Consumidor",
};

function getInviteStatus(invite: InviteRow): "accepted" | "expired" | "pending" {
  if (invite.used_at) return "accepted";
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) return "expired";
  return "pending";
}

const statusMap: Record<string, { variant: "active" | "inactive" | "draft"; label: string }> = {
  accepted: { variant: "active", label: "Aceito" },
  expired: { variant: "inactive", label: "Expirado" },
  pending: { variant: "draft", label: "Pendente" },
};

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

    for (const inv of rawInvites) {
      if (inv.used_by) profileIds.add(inv.used_by);
      if (inv.created_by) profileIds.add(inv.created_by);
      if (inv.venue_id) venueIds.add(inv.venue_id);
      if (inv.event_id) eventIds.add(inv.event_id);
    }

    const [profilesRes, venuesRes, eventsRes] = await Promise.all([
      profileIds.size > 0
        ? supabase.from("profiles").select("id, name").in("id", [...profileIds])
        : Promise.resolve({ data: [] }),
      venueIds.size > 0
        ? supabase.from("venues").select("id, name").in("id", [...venueIds])
        : Promise.resolve({ data: [] }),
      eventIds.size > 0
        ? supabase.from("events").select("id, name").in("id", [...eventIds])
        : Promise.resolve({ data: [] }),
    ]);

    const profileMap = new Map((profilesRes.data ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));
    const venueMap = new Map((venuesRes.data ?? []).map((v: { id: string; name: string }) => [v.id, v.name]));
    const eventMap = new Map((eventsRes.data ?? []).map((e: { id: string; name: string }) => [e.id, e.name]));

    const enriched: EnrichedInvite[] = rawInvites.map((inv) => ({
      ...inv,
      usedByName: inv.used_by ? profileMap.get(inv.used_by) ?? null : null,
      createdByName: profileMap.get(inv.created_by) ?? null,
      venueName: inv.venue_id ? venueMap.get(inv.venue_id) ?? null : null,
      eventName: inv.event_id ? eventMap.get(inv.event_id) ?? null : null,
      status: getInviteStatus(inv),
    }));

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
  const acceptedCount = invites.filter((i) => i.status === "accepted").length;
  const pendingCount = invites.filter((i) => i.status === "pending").length;

  // Filtered data
  const filteredInvites = useMemo(() => {
    if (!search) return invites;
    const q = search.toLowerCase();
    return invites.filter(
      (i) =>
        (i.email && i.email.toLowerCase().includes(q)) ||
        (ROLE_LABELS[i.role] ?? i.role).toLowerCase().includes(q)
    );
  }, [invites, search]);

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
      key: "status",
      header: "Status",
      render: (row) => {
        const s = statusMap[row.status];
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
        if (row.status !== "pending") return null;
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

        {/* Invites table */}
        <DataTable
          columns={columns}
          data={filteredInvites}
          keyExtractor={(row) => row.id}
          loading={loading}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar por email ou função..."
          emptyMessage="Nenhum convite encontrado"
          emptyHint="Gere um link de convite para adicionar membros à equipe"
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
