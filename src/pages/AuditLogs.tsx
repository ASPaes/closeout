import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { format } from "date-fns";

type AuditLog = {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: any;
  ip_address: string | null;
  created_at: string;
};

const actionColors: Record<string, string> = {
  user_login: "bg-primary/15 text-primary",
  user_login_failed: "bg-destructive/15 text-destructive",
  user_created: "bg-primary/15 text-primary",
  user_deactivated: "bg-warning/15 text-warning",
  venue_created: "bg-primary/15 text-primary",
  client_created: "bg-primary/15 text-primary",
  role_assigned: "bg-primary/15 text-primary",
  role_revoked: "bg-destructive/15 text-destructive",
};

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");

  useEffect(() => {
    const fetchLogs = async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (data) setLogs(data as AuditLog[]);
    };
    fetchLogs();
  }, []);

  const actions = [...new Set(logs.map((l) => l.action))];

  const filtered = logs.filter(
    (l) =>
      (filterAction === "all" || l.action === filterAction) &&
      (l.action.toLowerCase().includes(search.toLowerCase()) ||
        (l.entity_type || "").toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">System activity log (read-only)</p>
      </div>

      <div className="flex gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by action or entity..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border bg-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead>User</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`font-mono text-xs ${actionColors[log.action] || ""}`}>
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{log.entity_type || "—"}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">{log.entity_id?.slice(0, 8) || "—"}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">{log.user_id?.slice(0, 8) || "system"}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No logs found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
