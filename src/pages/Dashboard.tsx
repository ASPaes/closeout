import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, MapPin, CalendarDays, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function Dashboard() {
  const { isSuperAdmin } = useAuth();
  const [stats, setStats] = useState({ clients: 0, venues: 0, events: 0, users: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const [c, v, e] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("venues").select("id", { count: "exact", head: true }),
        supabase.from("events").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        clients: c.count ?? 0,
        venues: v.count ?? 0,
        events: e.count ?? 0,
        users: 0,
      });
    };
    fetchStats();
  }, []);

  const cards = [
    { title: "Clients", value: stats.clients, icon: Building2, color: "text-primary" },
    { title: "Venues", value: stats.venues, icon: MapPin, color: "text-success" },
    { title: "Events", value: stats.events, icon: CalendarDays, color: "text-warning" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your operations</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title} className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
