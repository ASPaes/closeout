import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, CalendarDays, Activity, CalendarCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import { format } from "date-fns";
import { ptBR as datePtBR } from "date-fns/locale";
import { EVENT_STATUS } from "@/config";

type AuditEntry = {
  id: string;
  action: string;
  entity_type: string | null;
  created_at: string;
  user_id: string | null;
};

export default function Dashboard() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [stats, setStats] = useState({ clients: 0, venues: 0, activeEvents: 0, eventsToday: 0 });
  const [recentLogs, setRecentLogs] = useState<AuditEntry[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const [c, v, e, eToday, logs] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("venues").select("id", { count: "exact", head: true }),
        supabase.from("events").select("id", { count: "exact", head: true }).eq("status", EVENT_STATUS.ACTIVE),
        supabase.from("events").select("id", { count: "exact", head: true })
          .gte("start_at", todayStart.toISOString())
          .lte("start_at", todayEnd.toISOString()),
        supabase.from("audit_logs").select("id, action, entity_type, created_at, user_id").order("created_at", { ascending: false }).limit(8),
      ]);
      setStats({
        clients: c.count ?? 0,
        venues: v.count ?? 0,
        activeEvents: e.count ?? 0,
        eventsToday: eToday.count ?? 0,
      });
      if (logs.data) setRecentLogs(logs.data as AuditEntry[]);
    };
    fetchData();
  }, []);

  const cards = [
    { title: t("total_clients"), value: stats.clients, icon: Building2, desc: t("business_owners") },
    { title: t("total_venues"), value: stats.venues, icon: MapPin, desc: t("physical_locations") },
    { title: t("active_events"), value: stats.activeEvents, icon: CalendarDays, desc: t("currently_running") },
    { title: t("events_today"), value: stats.eventsToday, icon: CalendarCheck, desc: t("events_today_desc") },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t("welcome_back")}{profile?.name ? `, ${profile.name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("operations_overview")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title} className="border-border bg-card hover:border-primary/20 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">{card.desc}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <card.icon className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground tracking-tight">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center gap-2 pb-4">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base font-semibold">{t("recent_activity")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("action")}</TableHead>
                <TableHead>{t("entity")}</TableHead>
                <TableHead>{t("time")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell><Badge variant="outline" className="font-mono text-xs">{log.action}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-xs">{log.entity_type || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs font-mono">{format(new Date(log.created_at), "MMM dd, HH:mm")}</TableCell>
                </TableRow>
              ))}
              {recentLogs.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">{t("no_recent_activity")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
