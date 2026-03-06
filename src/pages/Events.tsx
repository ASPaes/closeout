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
import { format } from "date-fns";

type Event = {
  id: string;
  venue_id: string;
  name: string;
  description: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
  venues?: { name: string; clients?: { name: string } };
};

type Venue = { id: string; name: string; client_id: string };

const statusColors: Record<string, string> = {
  draft: "secondary",
  active: "default",
  completed: "outline",
  cancelled: "destructive",
};

export default function Events() {
  const { isSuperAdmin, hasRole } = useAuth();
  const canManage = isSuperAdmin || hasRole("client_admin") || hasRole("venue_manager");
  const [events, setEvents] = useState<Event[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [search, setSearch] = useState("");
  const [filterVenue, setFilterVenue] = useState<string>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [form, setForm] = useState({ name: "", venue_id: "", description: "", date: "", start_time: "", end_time: "", status: "draft" as "draft" | "active" | "completed" | "cancelled" });

  const fetchData = async () => {
    const [e, v] = await Promise.all([
      supabase.from("events").select("*, venues(name, clients(name))").order("date", { ascending: false }),
      supabase.from("venues").select("id, name, client_id").eq("is_active", true),
    ]);
    if (e.data) setEvents(e.data as Event[]);
    if (v.data) setVenues(v.data as Venue[]);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", venue_id: venues[0]?.id || "", description: "", date: "", start_time: "", end_time: "", status: "draft" });
    setSheetOpen(true);
  };

  const openEdit = (event: Event) => {
    setEditing(event);
    setForm({ name: event.name, venue_id: event.venue_id, description: event.description || "", date: event.date, start_time: event.start_time || "", end_time: event.end_time || "", status: event.status as "draft" | "active" | "completed" | "cancelled" });
    setSheetOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
    };
    if (editing) {
      const { error } = await supabase.from("events").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Event updated");
    } else {
      const { error } = await supabase.from("events").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Event created");
    }
    setSheetOpen(false);
    fetchData();
  };

  const filtered = events
    .filter((e) => filterVenue === "all" || e.venue_id === filterVenue)
    .filter((e) => e.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Events</h1>
          <p className="text-sm text-muted-foreground">Manage events across venues</p>
        </div>
        {canManage && (
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add Event</Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-md">
              <SheetHeader><SheetTitle>{editing ? "Edit Event" : "New Event"}</SheetTitle></SheetHeader>
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label>Venue</Label>
                  <Select value={form.venue_id} onValueChange={(v) => setForm({ ...form, venue_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select venue" /></SelectTrigger>
                    <SelectContent>{venues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Start Time</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
                  <div className="space-y-2"><Label>End Time</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as "draft" | "active" | "completed" | "cancelled" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">{editing ? "Update" : "Create"}</Button>
              </form>
            </SheetContent>
          </Sheet>
        )}
      </div>

      <div className="flex gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterVenue} onValueChange={setFilterVenue}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Venues</SelectItem>
            {venues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border bg-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Venue</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="w-20">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="font-medium">{event.name}</TableCell>
                  <TableCell className="text-muted-foreground">{(event as any).venues?.name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{format(new Date(event.date), "MMM dd, yyyy")}</TableCell>
                  <TableCell>
                    <Badge variant={statusColors[event.status] as any} className="capitalize">{event.status}</Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(event)}><Pencil className="h-4 w-4" /></Button></TableCell>
                  )}
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No events found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
