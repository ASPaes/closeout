import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { useTranslation } from "@/i18n/use-translation";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";

type AuditLog = { id: string; user_id: string | null; action: string; entity_type: string | null; entity_id: string | null; metadata: any; ip_address: string | null; created_at: string; old_data: any; new_data: any; user_role: string | null };

const actionColors: Record<string, string> = {
  "client.created": "bg-primary/15 text-primary",
  "client.updated": "bg-accent text-accent-foreground",
  "venue.created": "bg-primary/15 text-primary",
  "venue.updated": "bg-accent text-accent-foreground",
  "event.created": "bg-primary/15 text-primary",
  "event.updated": "bg-accent text-accent-foreground",
  "user.role_assigned": "bg-primary/15 text-primary",
  "user.role_removed": "bg-destructive/15 text-destructive",
};

export default function AuditLogs() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterEntity, setFilterEntity] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const fetchLogs = async () => {
      let query = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
      if (dateFrom) query = query.gte("created_at", new Date(dateFrom).toISOString());
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        query = query.lte("created_at", to.toISOString());
      }
      const { data } = await query;
      if (data) setLogs(data as AuditLog[]);
    };
    fetchLogs();
  }, [dateFrom, dateTo]);

  const actions = [...new Set(logs.map((l) => l.action))].sort();
  const entityTypes = [...new Set(logs.map((l) => l.entity_type).filter(Boolean))].sort() as string[];

  const filtered = logs
    .filter((l) => filterAction === "all" || l.action === filterAction)
    .filter((l) => filterEntity === "all" || l.entity_type === filterEntity)
    .filter((l) =>
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      (l.entity_type || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.user_id || "").toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("audit_logs")}</h1>
        <p className="text-sm text-muted-foreground">{t("audit_logs_desc")}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t("search_audit")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-48"><SelectValue placeholder={t("all_actions")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all_actions")}</SelectItem>
            {actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterEntity} onValueChange={setFilterEntity}>
          <SelectTrigger className="w-48"><SelectValue placeholder={t("all_entities")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all_entities")}</SelectItem>
            {entityTypes.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("date_from")}</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("date_to")}</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        </div>
      </div>

      <Card className="border-border bg-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("timestamp")}</TableHead>
                <TableHead>{t("action")}</TableHead>
                <TableHead>{t("entity")}</TableHead>
                <TableHead>{t("entity_id")}</TableHead>
                <TableHead>{t("details")}</TableHead>
                <TableHead>{t("user")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground font-mono">{format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss")}</TableCell>
                  <TableCell><Badge variant="outline" className={`font-mono text-xs ${actionColors[log.action] || ""}`}>{log.action}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-xs">{log.entity_type || "—"}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">{log.entity_id?.slice(0, 8) || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">
                    {log.metadata ? JSON.stringify(log.metadata) : log.new_data ? JSON.stringify(log.new_data) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">{log.user_id?.slice(0, 8) || "system"}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t("no_logs_found")}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
