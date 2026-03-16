import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/i18n/use-translation";
import { useGestor } from "@/contexts/GestorContext";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Link2, UserPlus } from "lucide-react";
import InviteLinkDialog from "@/components/InviteLinkDialog";
import { GestorClientGuard } from "@/components/GestorClientGuard";

type Venue = { id: string; name: string; client_id: string };
type Event = { id: string; name: string; venue_id: string };

export default function GestorEquipe() {
  const { t } = useTranslation();
  const { effectiveClientId, clientName } = useGestor();
  const { hasRole } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  const canInvite = hasRole("client_manager") || hasRole("super_admin") || hasRole("client_admin");

  useEffect(() => {
    if (!effectiveClientId) return;
    supabase.from("venues").select("id, name, client_id").eq("client_id", effectiveClientId).eq("status", "active").order("name").then(({ data }) => setVenues(data ?? []));
    supabase.from("events").select("id, name, venue_id").order("name").then(({ data }) => setEvents(data ?? []));
  }, [effectiveClientId]);

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

        <div className="rounded-lg border border-border/60 bg-card/50 p-8 text-center">
          <UserPlus className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-sm text-muted-foreground">
            {t("gestor_invite_team_help")}
          </p>
        </div>

        {canInvite && effectiveClientId && clientName && (
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
      </div>
    </GestorClientGuard>
  );
}
