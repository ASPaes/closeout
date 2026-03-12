import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Search, Pencil, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import { format } from "date-fns";
import { EVENT_STATUS, ENTITY_STATUS } from "@/config";
import { logAudit } from "@/lib/audit";

type Event = {
  id: string; venue_id: string; client_id: string | null; name: string;
  description: string | null; start_at: string | null; end_at: string | null;
  status: string; geo_radius_meters: number | null; max_order_value: number | null;
  unretrieved_order_alert_minutes: number | null; stock_control_enabled: boolean;
  venues?: { name: string; clients?: { name: string } };
};
type Venue = { id: string; name: string; client_id: string };
type Client = { id: string; name: string };

const statusColors: Record<string, string> = {
  [EVENT_STATUS.DRAFT]: "secondary",
  [EVENT_STATUS.ACTIVE]: "default",
  [EVENT_STATUS.COMPLETED]: "outline",
  [EVENT_STATUS.CANCELLED]: "destructive",
};

export default function Events() {
  const { isSuperAdmin, hasRole } = useAuth();
  const { t } = useTranslation();
  const canManage = isSuperAdmin || hasRole("client_admin") || hasRole("venue_manager");
  const [events, setEvents] = useState<Event[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [filterVenue, setFilterVenue] = useState<string>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [form, setForm] = useState({
    name: "", client_id: "", venue_id: "", description: "", start_at: "", end_at: "",
    status: EVENT_STATUS.DRAFT as string, geo_radius_meters: "", max_order_value: "",
    unretrieved_order_alert_minutes: "", stock_control_enabled: true,
  });

  const fetchData = async () => {
    const [e, v, c] = await Promise.all([
      supabase.from("events").select("*, venues(name, clients(name))").order("start_at", { ascending: false }),
      supabase.from("venues").select("id, name, client_id").eq("status", ENTITY_STATUS.ACTIVE),
      supabase.from("clients").select("id, name").eq("status", ENTITY_STATUS.ACTIVE),
    ]);
    if (e.data) setEvents(e.data as Event[]);
    if (v.data) setVenues(v.data as Venue[]);
    if (c.data) setClients(c.data as Client[]);
  };

  useEffect(() => { fetchData(); }, []);

  const filteredVenuesByClient = useMemo(() => {
    if (!form.client_id) return [];
    return venues.filter((v) => v.client_id === form.client_id);
  }, [form.client_id, venues]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "", client_id: "", venue_id: "", description: "", start_at: "", end_at: "",
      status: EVENT_STATUS.DRAFT as string, geo_radius_meters: "", max_order_value: "",
      unretrieved_order_alert_minutes: "", stock_control_enabled: true,
    });
    setSheetOpen(true);
  };

  const openEdit = (event: Event) => {
    setEditing(event);
    const clientId = event.client_id || venues.find((v) => v.id === event.venue_id)?.client_id || "";
    setForm({
      name: event.name, client_id: clientId, venue_id: event.venue_id,
      description: event.description || "",
      start_at: event.start_at ? event.start_at.slice(0, 16) : "",
      end_at: event.end_at ? event.end_at.slice(0, 16) : "",
      status: event.status,
      geo_radius_meters: event.geo_radius_meters?.toString() || "",
      max_order_value: event.max_order_value?.toString() || "",
      unretrieved_order_alert_minutes: event.unretrieved_order_alert_minutes?.toString() || "",
      stock_control_enabled: event.stock_control_enabled,
    });
    setSheetOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name, venue_id: form.venue_id, client_id: form.client_id || null,
      description: form.description || null,
      start_at: form.start_at || null, end_at: form.end_at || null,
      status: form.status,
      geo_radius_meters: form.geo_radius_meters ? parseInt(form.geo_radius_meters) : null,
      max_order_value: form.max_order_value ? parseFloat(form.max_order_value) : null,
      unretrieved_order_alert_minutes: form.unretrieved_order_alert_minutes ? parseInt(form.unretrieved_order_alert_minutes) : null,
      stock_control_enabled: form.stock_control_enabled,
    };
    if (editing) {
      const { error } = await supabase.from("events").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      await logAudit({ action: "event.updated", entityType: "event", entityId: editing.id, metadata: { name: payload.name, client_id: payload.client_id, venue_id: payload.venue_id, previous_status: editing.status, new_status: payload.status }, oldData: { name: editing.name, status: editing.status }, newData: payload });
      toast.success(t("event_updated"));
    } else {
      const { data, error } = await supabase.from("events").insert(payload).select("id").single();
      if (error) { toast.error(error.message); return; }
      if (data) await logAudit({ action: "event.created", entityType: "event", entityId: data.id, metadata: { name: payload.name, client_id: payload.client_id, venue_id: payload.venue_id }, newData: payload });
      toast.success(t("event_created"));
    }
    setSheetOpen(false); fetchData();
  };

  const completeEvent = async (event: Event) => {
    const { error } = await supabase.from("events").update({ status: EVENT_STATUS.COMPLETED }).eq("id", event.id);
    if (error) { toast.error(error.message); return; }
    await logAudit({ action: "event.updated", entityType: "event", entityId: event.id, oldData: { status: event.status }, newData: { status: EVENT_STATUS.COMPLETED } });
    toast.success(t("event_completed"));
    fetchData();
  };

  const filtered = events.filter((e) => filterVenue === "all" || e.venue_id === filterVenue).filter((e) => e.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("events")}</h1>
          <p className="text-sm text-muted-foreground">{t("manage_events")}</p>
        </div>
        {canManage && <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />{t("add_event")}</Button>}
      </div>

      <div className="flex gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t("search_events")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterVenue} onValueChange={setFilterVenue}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all_venues")}</SelectItem>
            {venues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border bg-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("venue")}</TableHead>
                <TableHead>{t("client")}</TableHead>
                <TableHead>{t("start")}</TableHead>
                <TableHead>{t("end")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                {canManage && <TableHead className="w-24">{t("actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="font-medium">{event.name}</TableCell>
                  <TableCell className="text-muted-foreground">{event.venues?.name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{event.venues?.clients?.name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{event.start_at ? format(new Date(event.start_at), "MMM dd, yyyy HH:mm") : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{event.end_at ? format(new Date(event.end_at), "MMM dd, yyyy HH:mm") : "—"}</TableCell>
                  <TableCell><Badge variant={statusColors[event.status] as any} className="capitalize">{t(event.status as any)}</Badge></TableCell>
                  {canManage && (
                    <TableCell className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(event)}><Pencil className="h-4 w-4" /></Button>
                      {event.status === EVENT_STATUS.ACTIVE && (
                        <Button variant="ghost" size="icon" onClick={() => completeEvent(event)} title={t("complete_event")}>
                          <CheckCircle className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t("no_events_found")}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>{editing ? t("edit_event") : t("new_event")}</SheetTitle></SheetHeader>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>{t("client")}</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v, venue_id: "" })}>
                <SelectTrigger><SelectValue placeholder={t("select_client")} /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("venue")}</Label>
              <Select value={form.venue_id} onValueChange={(v) => setForm({ ...form, venue_id: v })} disabled={!form.client_id}>
                <SelectTrigger><SelectValue placeholder={form.client_id ? t("select_venue") : t("select_client_first")} /></SelectTrigger>
                <SelectContent>{filteredVenuesByClient.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>{t("name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="space-y-2"><Label>{t("description")}</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{t("start")}</Label><Input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} required /></div>
              <div className="space-y-2"><Label>{t("end")}</Label><Input type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} /></div>
            </div>
            <div className="space-y-2">
              <Label>{t("status")}</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={EVENT_STATUS.DRAFT}>{t("draft")}</SelectItem>
                  <SelectItem value={EVENT_STATUS.ACTIVE}>{t("active")}</SelectItem>
                  <SelectItem value={EVENT_STATUS.COMPLETED}>{t("completed")}</SelectItem>
                  <SelectItem value={EVENT_STATUS.CANCELLED}>{t("cancelled")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>{t("geo_radius_meters")}</Label><Input type="number" value={form.geo_radius_meters} onChange={(e) => setForm({ ...form, geo_radius_meters: e.target.value })} placeholder="500" /></div>
            <div className="space-y-2"><Label>{t("max_order_value")}</Label><Input type="number" step="0.01" value={form.max_order_value} onChange={(e) => setForm({ ...form, max_order_value: e.target.value })} placeholder="100.00" /></div>
            <div className="space-y-2"><Label>{t("unretrieved_order_alert")}</Label><Input type="number" value={form.unretrieved_order_alert_minutes} onChange={(e) => setForm({ ...form, unretrieved_order_alert_minutes: e.target.value })} placeholder="15" /></div>
            <div className="flex items-center justify-between">
              <Label>{t("stock_control")}</Label>
              <Switch checked={form.stock_control_enabled} onCheckedChange={(v) => setForm({ ...form, stock_control_enabled: v })} />
            </div>
            <Button type="submit" className="w-full">{editing ? t("update") : t("create")}</Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
