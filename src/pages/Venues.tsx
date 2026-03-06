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

type Venue = {
  id: string;
  client_id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  capacity: number | null;
  is_active: boolean;
  clients?: { name: string };
};

type Client = { id: string; name: string };

export default function Venues() {
  const { isSuperAdmin, hasRole } = useAuth();
  const canManage = isSuperAdmin || hasRole("client_admin");
  const [venues, setVenues] = useState<Venue[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState<string>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Venue | null>(null);
  const [form, setForm] = useState({ name: "", client_id: "", address: "", city: "", state: "", capacity: "" });

  const fetchData = async () => {
    const [v, c] = await Promise.all([
      supabase.from("venues").select("*, clients(name)").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, name").eq("is_active", true),
    ]);
    if (v.data) setVenues(v.data as Venue[]);
    if (c.data) setClients(c.data as Client[]);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", client_id: clients[0]?.id || "", address: "", city: "", state: "", capacity: "" });
    setSheetOpen(true);
  };

  const openEdit = (venue: Venue) => {
    setEditing(venue);
    setForm({ name: venue.name, client_id: venue.client_id, address: venue.address || "", city: venue.city || "", state: venue.state || "", capacity: venue.capacity?.toString() || "" });
    setSheetOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, capacity: form.capacity ? parseInt(form.capacity) : null };
    if (editing) {
      const { error } = await supabase.from("venues").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Venue updated");
    } else {
      const { error } = await supabase.from("venues").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Venue created");
    }
    setSheetOpen(false);
    fetchData();
  };

  const filtered = venues
    .filter((v) => filterClient === "all" || v.client_id === filterClient)
    .filter((v) => v.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Venues</h1>
          <p className="text-sm text-muted-foreground">Manage physical locations</p>
        </div>
        {canManage && (
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add Venue</Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-md">
              <SheetHeader><SheetTitle>{editing ? "Edit Venue" : "New Venue"}</SheetTitle></SheetHeader>
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label>Client</Label>
                  <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                  <div className="space-y-2"><Label>State</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label>Capacity</Label><Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
                <Button type="submit" className="w-full">{editing ? "Update" : "Create"}</Button>
              </form>
            </SheetContent>
          </Sheet>
        )}
      </div>

      <div className="flex gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search venues..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border bg-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="w-20">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((venue) => (
                <TableRow key={venue.id}>
                  <TableCell className="font-medium">{venue.name}</TableCell>
                  <TableCell className="text-muted-foreground">{(venue as any).clients?.name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{venue.city || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{venue.capacity || "—"}</TableCell>
                  <TableCell><Badge variant={venue.is_active ? "default" : "secondary"}>{venue.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  {canManage && (
                    <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(venue)}><Pencil className="h-4 w-4" /></Button></TableCell>
                  )}
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No venues found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
