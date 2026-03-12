import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, Pencil } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import { ENTITY_STATUS } from "@/config";
import { logAudit } from "@/lib/audit";

type Venue = { id: string; client_id: string; name: string; address: string | null; city: string | null; state: string | null; latitude: number | null; longitude: number | null; status: string; clients?: { name: string } };
type Client = { id: string; name: string };

export default function Venues() {
  const { isSuperAdmin, hasRole } = useAuth();
  const { t } = useTranslation();
  const canManage = isSuperAdmin || hasRole("client_admin");
  const [venues, setVenues] = useState<Venue[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState<string>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Venue | null>(null);
  const [form, setForm] = useState({ name: "", client_id: "", address: "", city: "", state: "", latitude: "", longitude: "", status: ENTITY_STATUS.ACTIVE as string });

  const fetchData = async () => {
    const [v, c] = await Promise.all([
      supabase.from("venues").select("*, clients(name)").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, name").eq("status", ENTITY_STATUS.ACTIVE),
    ]);
    if (v.data) setVenues(v.data as Venue[]);
    if (c.data) setClients(c.data as Client[]);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => { setEditing(null); setForm({ name: "", client_id: clients[0]?.id || "", address: "", city: "", state: "", latitude: "", longitude: "", status: ENTITY_STATUS.ACTIVE as string }); setSheetOpen(true); };
  const openEdit = (venue: Venue) => {
    setEditing(venue);
    setForm({ name: venue.name, client_id: venue.client_id, address: venue.address || "", city: venue.city || "", state: venue.state || "", latitude: venue.latitude?.toString() || "", longitude: venue.longitude?.toString() || "", status: venue.status });
    setSheetOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name, client_id: form.client_id, address: form.address || null,
      city: form.city || null, state: form.state || null,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      status: form.status,
    };
    if (editing) {
      const { error } = await supabase.from("venues").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      await logAudit({ action: "venue.updated", entityType: "venue", entityId: editing.id, metadata: { name: payload.name, client_id: payload.client_id, previous_status: editing.status, new_status: payload.status }, oldData: { name: editing.name, status: editing.status }, newData: payload });
      toast.success(t("venue_updated"));
    } else {
      const { data, error } = await supabase.from("venues").insert(payload).select("id").single();
      if (error) { toast.error(error.message); return; }
      if (data) await logAudit({ action: "venue.created", entityType: "venue", entityId: data.id, newData: payload });
      toast.success(t("venue_created"));
    }
    setSheetOpen(false); fetchData();
  };

  const toggleStatus = async (venue: Venue) => {
    const newStatus = venue.status === ENTITY_STATUS.ACTIVE ? ENTITY_STATUS.INACTIVE : ENTITY_STATUS.ACTIVE;
    const { error } = await supabase.from("venues").update({ status: newStatus }).eq("id", venue.id);
    if (error) { toast.error(error.message); return; }
    await logAudit({ action: "venue.updated", entityType: "venue", entityId: venue.id, oldData: { status: venue.status }, newData: { status: newStatus } });
    toast.success(newStatus === ENTITY_STATUS.ACTIVE ? t("venue_activated") : t("venue_deactivated"));
    fetchData();
  };

  const filtered = venues.filter((v) => filterClient === "all" || v.client_id === filterClient).filter((v) => v.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("venues")}</h1>
          <p className="text-sm text-muted-foreground">{t("manage_venues")}</p>
        </div>
        {canManage && <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />{t("add_venue")}</Button>}
      </div>

      <div className="flex gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t("search_venues")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all_clients")}</SelectItem>
            {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border bg-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("client")}</TableHead>
                <TableHead>{t("city")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                {canManage && <TableHead className="w-24">{t("actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((venue) => (
                <TableRow key={venue.id}>
                  <TableCell className="font-medium">{venue.name}</TableCell>
                  <TableCell className="text-muted-foreground">{venue.clients?.name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{venue.city || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={venue.status === ENTITY_STATUS.ACTIVE ? "default" : "secondary"}
                      className={`cursor-pointer ${venue.status === ENTITY_STATUS.ACTIVE ? "bg-primary/15 text-primary hover:bg-primary/25" : ""}`}
                      onClick={() => canManage && toggleStatus(venue)}>
                      {venue.status === ENTITY_STATUS.ACTIVE ? t("active") : t("inactive")}
                    </Badge>
                  </TableCell>
                  {canManage && <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(venue)}><Pencil className="h-4 w-4" /></Button></TableCell>}
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t("no_venues_found")}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>{editing ? t("edit_venue") : t("new_venue")}</SheetTitle></SheetHeader>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>{t("client")}</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("select_client")} /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>{t("name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="space-y-2"><Label>{t("address")}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{t("city")}</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div className="space-y-2"><Label>{t("state")}</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{t("latitude")}</Label><Input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="-23.5505" /></div>
              <div className="space-y-2"><Label>{t("longitude")}</Label><Input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="-46.6333" /></div>
            </div>
            <div className="space-y-2">
              <Label>{t("status")}</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ENTITY_STATUS.ACTIVE}>{t("active")}</SelectItem>
                  <SelectItem value={ENTITY_STATUS.INACTIVE}>{t("inactive")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full">{editing ? t("update") : t("create")}</Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
