import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, Pencil } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import { format } from "date-fns";

type Event = {
  id: string; venue_id: string; client_id: string | null; name: string;
  description: string | null; start_at: string | null; end_at: string | null;
  status: string; geo_radius_meters: number | null; max_order_value: number | null;
  unretrieved_order_alert_minutes: number | null; stock_control_enabled: boolean;
  venues?: { name: string; clients?: { name: string } };
};
type Venue = { id: string; name: string; client_id: string };

const statusColors: Record<string, string> = { draft: "secondary", active: "default", closed: "outline" };

export default function Events() {
  const { isSuperAdmin, hasRole } = useAuth();
  const { t } = useTranslation();
  const canManage = isSuperAdmin || hasRole("client_admin") || hasRole("venue_manager");
  const [events, setEvents] = useState<Event[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [search, setSearch] = useState("");
  const [filterVenue, setFilterVenue] = useState<string>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [form, setForm] = useState({ name: "", venue_id: "", description: "", start_at: "", end_at: "", status: "draft" });

  const fetchData = async () => {
    const [e, v] = await Promise.all([
      supabase.from("events").select("*, venues(name, clients(name))").order("start_at", { ascending: false }),
      supabase.from("venues").select("id, name, client_id").eq("status", "active"),
    ]);
    if (e.data) setEvents(e.data as Event[]);
    if (v.data) setVenues(v.data as Venue[]);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => { setEditing(null); setForm({ name: "", venue_id: venues[0]?.id || "", description: "", start_at: "", end_at: "", status: "draft" }); setSheetOpen(true); };
  const openEdit = (event: Event) => {
    setEditing(event);
    setForm({ name: event.name, venue_id: event.venue_id, description: event.description || "", start_at: event.start_at ? event.start_at.slice(0, 16) : "", end_at: event.end_at ? event.end_at.slice(0, 16) : "", status: event.status });
    setSheetOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name: form.name, venue_id: form.venue_id, description: form.description || null, start_at: form.start_at || null, end_at: form.end_at || null, status: form.status };
    if (editing) {
      const { error } = await supabase.from("events").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success(t("event_updated"));
    } else {
      const { error } = await supabase.from("events").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success(t("event_created"));
    }
    setSheetOpen(false); fetchData();
  };

  const filtered = events.filter((e) => filterVenue === "all" || e.venue_id === filterVenue).filter((e) => e.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("events")}</h1>
          <p className="text-sm text-muted-foreground">{t("manage_events")}</p>
        </div>
        {canManage && (
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />{t("add_event")}</Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-md">
              <SheetHeader><SheetTitle>{editing ? t("edit_event") : t("new_event")}</SheetTitle></SheetHeader>
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label>{t("venue")}</Label>
                  <Select value={form.venue_id} onValueChange={(v) => setForm({ ...form, venue_id: v })}>
                    <SelectTrigger><SelectValue placeholder={t("select_venue")} /></SelectTrigger>
                    <SelectContent>{venues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>{t("name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                <div className="space-y-2"><Label>{t("description")}</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>{t("start")}</Label><Input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} /></div>
                  <div className="space-y-2"><Label>{t("end")}</Label><Input type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} /></div>
                </div>
                <div className="space-y-2">
                  <Label>{t("status")}</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">{t("draft")}</SelectItem>
                      <SelectItem value="active">{t("active")}</SelectItem>
                      <SelectItem value="closed">{t("closed")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">{editing ? t("update") : t("create")}</Button>
              </form>
            </SheetContent>
          </Sheet>
        )}
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
                <TableHead>{t("start")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                {canManage && <TableHead className="w-20">{t("actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="font-medium">{event.name}</TableCell>
                  <TableCell className="text-muted-foreground">{event.venues?.name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{event.start_at ? format(new Date(event.start_at), "MMM dd, yyyy HH:mm") : "—"}</TableCell>
                  <TableCell><Badge variant={statusColors[event.status] as any} className="capitalize">{event.status}</Badge></TableCell>
                  {canManage && <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(event)}><Pencil className="h-4 w-4" /></Button></TableCell>}
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t("no_events_found")}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
