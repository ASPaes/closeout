import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Check, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPtBrErrorMessage } from "@/lib/error-messages";
import { useTranslation } from "@/i18n/use-translation";
import { APP_ROLE } from "@/config";

type Client = { id: string; name: string };
type Venue = { id: string; name: string; client_id: string };
type Event = { id: string; name: string; venue_id: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  venues: Venue[];
  events: Event[];
  /** When set, locks the dialog to client_manager mode */
  clientManagerMode?: {
    clientId: string;
    clientName: string;
  };
}

/** Roles that a client_manager can invite */
const CLIENT_MANAGER_ALLOWED_ROLES = [
  APP_ROLE.VENUE_MANAGER,
  APP_ROLE.EVENT_MANAGER,
  APP_ROLE.STAFF,
  APP_ROLE.BAR_STAFF,
  APP_ROLE.WAITER,
  APP_ROLE.CASHIER,
];

export default function InviteLinkDialog({ open, onOpenChange, clients, venues, events, clientManagerMode }: Props) {
  const { t } = useTranslation();
  const [guestName, setGuestName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>(APP_ROLE.STAFF);
  const [clientId, setClientId] = useState("");
  const [venueId, setVenueId] = useState("");
  const [eventId, setEventId] = useState("");
  const [expiresInMinutes, setExpiresInMinutes] = useState("1440");
  const [loading, setLoading] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const isManagerMode = !!clientManagerMode;
  const effectiveClientId = isManagerMode ? clientManagerMode!.clientId : clientId;

  const filteredVenues = useMemo(() => {
    if (!effectiveClientId) return [];
    return venues.filter((v) => v.client_id === effectiveClientId);
  }, [effectiveClientId, venues]);

  const filteredEvents = useMemo(() => {
    if (!venueId) return [];
    return events.filter((e) => e.venue_id === venueId);
  }, [venueId, events]);

  const handleGenerate = async () => {
    setLoading(true);
    setGeneratedUrl("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error(t("invite_error_session"));
        return;
      }

      const payload: Record<string, unknown> = {
        roleName: role,
        expiresInMinutes: expiresInMinutes === "0" ? 0 : (parseInt(expiresInMinutes) || 1440),
      };
      if (email.trim()) payload.email = email.trim();
      if (effectiveClientId) payload.clientId = effectiveClientId;
      if (venueId) payload.venueId = venueId;
      if (eventId) payload.eventId = eventId;

      const { data, error } = await supabase.functions.invoke("create-invite-link", {
        body: payload,
      });

      if (error) {
        console.error("[InviteLinkDialog] error", error);
        toast.error(getPtBrErrorMessage(error));
        return;
      }

      if (data?.data?.inviteUrl) {
        setGeneratedUrl(data.data.inviteUrl);
        toast.success(t("invite_link_created"));
      } else {
        toast.error(t("invite_error_generic"));
      }
    } catch (err) {
      console.error("[InviteLinkDialog] error", err);
      toast.error(getPtBrErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    toast.success(t("invite_link_copied"));
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setGeneratedUrl("");
      setEmail("");
      setRole(APP_ROLE.STAFF);
      setClientId("");
      setVenueId("");
      setEventId("");
      setExpiresInMinutes("1440");
      setCopied(false);
    }
    onOpenChange(v);
  };

  const roleOptions = isManagerMode
    ? CLIENT_MANAGER_ALLOWED_ROLES
    : Object.values(APP_ROLE);

  const roleLabel = (r: string) => {
    const key = `role_${r}` as any;
    return t(key) || r;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {t("invite_by_link")}
          </DialogTitle>
        </DialogHeader>

        {generatedUrl ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("invite_link_ready")}</p>
            <div className="flex items-center gap-2">
              <Input readOnly value={generatedUrl} className="text-xs" />
              <Button type="button" size="icon" variant="outline" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button type="button" variant="outline" className="w-full" onClick={() => setGeneratedUrl("")}>
              {t("invite_generate_another")}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("email")} ({t("invite_optional")})</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@exemplo.com" />
            </div>

            <div className="space-y-2">
              <Label>{t("role")}</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isManagerMode ? (
              <div className="space-y-2">
                <Label>{t("client")}</Label>
                <Input readOnly value={clientManagerMode!.clientName} className="bg-muted/50" />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>{t("client_optional_scope")}</Label>
                <Select value={clientId || "__none__"} onValueChange={(v) => { setClientId(v === "__none__" ? "" : v); setVenueId(""); setEventId(""); }}>
                  <SelectTrigger><SelectValue placeholder={t("global_no_scope")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t("global")}</SelectItem>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {effectiveClientId && (
              <div className="space-y-2">
                <Label>{t("venue_optional_scope")}</Label>
                <Select value={venueId || "__none__"} onValueChange={(v) => { setVenueId(v === "__none__" ? "" : v); setEventId(""); }}>
                  <SelectTrigger><SelectValue placeholder={t("no_scope")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t("no_scope")}</SelectItem>
                    {filteredVenues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {venueId && (
              <div className="space-y-2">
                <Label>{t("event_optional_scope")}</Label>
                <Select value={eventId || "__none__"} onValueChange={(v) => setEventId(v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder={t("no_scope")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t("no_scope")}</SelectItem>
                    {filteredEvents.map((ev) => <SelectItem key={ev.id} value={ev.id}>{ev.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>{t("invite_expires_in")}</Label>
              <Select value={expiresInMinutes} onValueChange={setExpiresInMinutes}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">1 {t("invite_hour")}</SelectItem>
                  <SelectItem value="1440">24 {t("invite_hours")}</SelectItem>
                  <SelectItem value="4320">3 {t("invite_days")}</SelectItem>
                  <SelectItem value="10080">7 {t("invite_days")}</SelectItem>
                  <SelectItem value="43200">30 {t("invite_days")}</SelectItem>
                  <SelectItem value="0">{t("invite_lifetime")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="button" className="w-full" onClick={handleGenerate} disabled={loading}>
              {loading ? t("invite_generating") : t("invite_generate_link")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
