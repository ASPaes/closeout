import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "@/i18n/use-translation";
import { useGestor } from "@/contexts/GestorContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Beer, ShoppingCart, CheckCircle2,
  AlertTriangle, Loader2, Copy, X, Check,
  Play, RefreshCw, Calendar, ChevronRight,
  Plus, Ban, Clock, User,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type EventRow = { id: string; name: string; start_at: string | null; status: string };

type StationRow = {
  id: string;
  name: string;
  join_code: string;
  created_at: string;
  event_id: string;
  status: string;
  closed_at: string | null;
  bar_station_members: { name: string }[] | null;
};

type OrderSummary = {
  id: string;
  event_id: string;
  status: string;
  total: number;
  paid_at: string | null;
  order_number: number | null;
  origin: string | null;
  delivered_by_station_id: string | null;
};

type LateOrder = {
  id: string;
  order_number: number | null;
  origin: string | null;
  total: number;
  paid_at: string;
  minutesAgo: number;
};

type EventBarGroup = {
  eventId: string;
  eventName: string;
  eventDate: string;
  stations: StationRow[];
  isActive: boolean;
  faturamentoEntregue: number;
  ordersTotal: number;
  ordersDelivered: number;
  ordersReady: number;
  ordersLate: number;
  activeStations: number;
  lateOrders: LateOrder[];
  stationDeliveries: Map<string, { count: number; gmv: number }>;
};

const ORIGIN_LABELS: Record<string, string> = {
  consumer_app: "App",
  waiter_app: "Garçom",
  cashier: "Caixa",
};

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });


export default function GestorBarOperacao() {
  const { t } = useTranslation();
  const { effectiveClientId } = useGestor();
  const { session } = useAuth();

  const formatTimeOpen = (createdAt: string) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `${hours}h${minutes > 0 ? ` ${minutes}min` : ""}`;
    return `${minutes}min`;
  };

  const [events, setEvents] = useState<EventRow[]>([]);
  const [allStations, setAllStations] = useState<StationRow[]>([]);
  const [allOrders, setAllOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"ativos" | "encerrados">("ativos");
  const [selectedGroup, setSelectedGroup] = useState<EventBarGroup | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  
  const [bulkCancelling, setBulkCancelling] = useState(false);

  // Create bar dialog
  const [createBarOpen, setCreateBarOpen] = useState(false);
  const [createBarEventId, setCreateBarEventId] = useState("");
  const [barName, setBarName] = useState("");
  const [memberNames, setMemberNames] = useState<string[]>([]);
  const [newMemberName, setNewMemberName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdStation, setCreatedStation] = useState<{ name: string; join_code: string } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Close station dialog
  const [closingStation, setClosingStation] = useState<StationRow | null>(null);
  const [closeReport, setCloseReport] = useState<{ delivered: number; gmv: number; hoursOpen: number } | null>(null);
  const [closeLoading, setCloseLoading] = useState(false);

  // Load events for current client
  useEffect(() => {
    if (!effectiveClientId) return;
    supabase
      .from("events")
      .select("id, name, start_at, status")
      .eq("client_id", effectiveClientId)
      .in("status", ["active", "completed"])
      .order("start_at", { ascending: false })
      .then(({ data }) => {
        setEvents((data as EventRow[]) ?? []);
      });
  }, [effectiveClientId]);

  const fetchAllData = async () => {
    if (!effectiveClientId) return;
    setLoading(true);

    const [stationsRes, ordersRes] = await Promise.all([
      supabase
        .from("bar_stations")
        .select("id, name, join_code, created_at, event_id, status, closed_at, bar_station_members(name)")
        .eq("client_id", effectiveClientId)
        .order("created_at"),
      supabase
        .from("orders")
        .select("id, event_id, status, total, paid_at, order_number, origin, delivered_by_station_id")
        .eq("client_id", effectiveClientId)
        .not("status", "in", "(cancelled,pending,processing_payment)")
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);

    setAllStations((stationsRes.data as StationRow[]) ?? []);
    setAllOrders((ordersRes.data as OrderSummary[]) ?? []);
    setLoading(false);
    setLastRefresh(new Date());
  };

  useEffect(() => { fetchAllData(); }, [effectiveClientId]);

  useEffect(() => {
    if (activeTab !== "ativos") return;
    const interval = setInterval(() => { fetchAllData(); }, 60000);
    return () => clearInterval(interval);
  }, [activeTab, effectiveClientId]);

  const eventDateMap = useMemo(
    () => Object.fromEntries(events.map((e) => [e.id, { name: e.name, start_at: e.start_at }])),
    [events]
  );

  const groups: EventBarGroup[] = useMemo(() => {
    const stationsByEvent = new Map<string, StationRow[]>();
    allStations.forEach((s) => {
      if (!stationsByEvent.has(s.event_id)) stationsByEvent.set(s.event_id, []);
      stationsByEvent.get(s.event_id)!.push(s);
    });

    const lateThreshold = Date.now() - 35 * 60 * 1000;
    const out: EventBarGroup[] = [];

    stationsByEvent.forEach((stations, eventId) => {
      const eventInfo = eventDateMap[eventId];
      const eventOrders = allOrders.filter((o) => o.event_id === eventId);

      const ordersTotal = eventOrders.length;
      const ordersDelivered = eventOrders.filter((o) => o.status === "delivered").length;
      const ordersReady = eventOrders.filter((o) => o.status === "ready" || o.status === "partially_delivered").length;

      const lateList: LateOrder[] = eventOrders
        .filter((o) => o.paid_at && new Date(o.paid_at).getTime() < lateThreshold && o.status !== "delivered" && o.status !== "partially_delivered")
        .map((o) => ({
          id: o.id,
          order_number: o.order_number,
          origin: o.origin,
          total: Number(o.total),
          paid_at: o.paid_at!,
          minutesAgo: Math.round((Date.now() - new Date(o.paid_at!).getTime()) / 60000),
        }))
        .sort((a, b) => b.minutesAgo - a.minutesAgo);

      const faturamentoEntregue = Math.round(
        eventOrders
          .filter((o) => o.status === "delivered")
          .reduce((sum, o) => sum + Number(o.total), 0) * 100
      ) / 100;

      const stationDeliveries = new Map<string, { count: number; gmv: number }>();
      eventOrders
        .filter((o) => o.status === "delivered" && o.delivered_by_station_id)
        .forEach((o) => {
          const sid = o.delivered_by_station_id!;
          const prev = stationDeliveries.get(sid) || { count: 0, gmv: 0 };
          stationDeliveries.set(sid, {
            count: prev.count + 1,
            gmv: Math.round((prev.gmv + Number(o.total)) * 100) / 100,
          });
        });

      const activeStations = stations.filter((s) => s.status === "active").length;

      out.push({
        eventId,
        eventName: eventInfo?.name || eventId.slice(0, 8),
        eventDate: eventInfo?.start_at || stations[0].created_at,
        stations,
        isActive: activeStations > 0,
        faturamentoEntregue,
        ordersTotal,
        ordersDelivered,
        ordersReady,
        ordersLate: lateList.length,
        activeStations,
        lateOrders: lateList,
        stationDeliveries,
      });
    });

    return out;
  }, [allStations, allOrders, eventDateMap]);

  const activeGroups = useMemo(
    () => groups.filter((g) => g.isActive).sort((a, b) => +new Date(b.eventDate) - +new Date(a.eventDate)),
    [groups]
  );
  const closedGroups = useMemo(
    () => groups.filter((g) => !g.isActive).sort((a, b) => +new Date(b.eventDate) - +new Date(a.eventDate)),
    [groups]
  );
  const currentGroups = activeTab === "ativos" ? activeGroups : closedGroups;

  useEffect(() => {
    if (!selectedGroup) return;
    const updated = groups.find((g) => g.eventId === selectedGroup.eventId);
    if (updated) setSelectedGroup(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  // Bulk cancel open QRs
  const handleBulkCancelQRs = async (eventId: string) => {
    setBulkCancelling(true);
    try {
      const { data, error } = await (supabase.rpc as any)("bulk_cancel_open_qrs", {
        p_event_id: eventId,
        p_client_id: effectiveClientId,
      });
      if (error) throw error;
      const result = data as { cancelled_count: number; skipped_paid: number; message: string };
      if (result.cancelled_count === 0 && result.skipped_paid === 0) {
        toast.info("Nenhum QR em aberto encontrado");
      } else {
        toast.success(result.message);
      }
      fetchAllData();
    } catch (err: any) {
      toast.error("Erro ao cancelar QRs: " + (err.message || "erro desconhecido"));
    } finally {
      setBulkCancelling(false);
    }
  };

  const copyStationLink = (joinCode: string) => {
    const url = `${window.location.origin}/bar?station=${joinCode}`;
    navigator.clipboard.writeText(url);
    toast.success(t("gbar_link_copied" as any));
  };

  const resetCreateDialog = () => {
    setBarName("");
    setMemberNames([]);
    setNewMemberName("");
    setCreating(false);
    setCreatedStation(null);
    setLinkCopied(false);
  };

  const handleCloseCreateDialog = (open: boolean) => {
    setCreateBarOpen(open);
    if (!open) resetCreateDialog();
  };

  const handleAddMember = () => {
    const name = newMemberName.trim();
    if (!name) return;
    setMemberNames((prev) => [...prev, name]);
    setNewMemberName("");
  };

  const handleCreateBar = async () => {
    if (!barName.trim() || !createBarEventId || !effectiveClientId || !session?.user?.id) return;
    setCreating(true);
    try {
      const { data: station, error } = await supabase
        .from("bar_stations")
        .insert({
          name: barName.trim(),
          event_id: createBarEventId,
          client_id: effectiveClientId,
          created_by: session.user.id,
        } as any)
        .select("id, name, join_code")
        .single();
      if (error || !station) throw error;

      if (memberNames.length > 0) {
        await supabase.from("bar_station_members").insert(
          memberNames.map((name) => ({ bar_station_id: station.id, name })) as any
        );
      }

      setCreatedStation({ name: station.name, join_code: station.join_code });
      toast.success(t("gbar_bar_created_success" as any));
      fetchAllData();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao criar bar");
    } finally {
      setCreating(false);
    }
  };

  const handleCopyCreatedLink = () => {
    if (!createdStation) return;
    const url = `${window.location.origin}/bar?station=${createdStation.join_code}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleOpenCloseStation = async (station: StationRow) => {
    setClosingStation(station);
    setCloseLoading(true);
    const { data: deliveredData } = await supabase
      .from("orders")
      .select("total")
      .eq("delivered_by_station_id", station.id)
      .eq("status", "delivered");
    const delivered = deliveredData?.length ?? 0;
    const gmv = Math.round((deliveredData ?? []).reduce((acc, o) => acc + Number(o.total), 0) * 100) / 100;
    const hoursOpen = Math.round((Date.now() - new Date(station.created_at ?? Date.now()).getTime()) / 3600000 * 10) / 10;
    setCloseReport({ delivered, gmv, hoursOpen });
    setCloseLoading(false);
  };

  const handleCloseStation = async () => {
    if (!closingStation) return;
    await supabase
      .from("bar_stations")
      .update({ status: "closed", closed_at: new Date().toISOString() } as any)
      .eq("id", closingStation.id);
    toast.success(`Bar "${closingStation.name}" fechado`);
    setClosingStation(null);
    setCloseReport(null);
    fetchAllData();
  };

  

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes valueFade {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Beer className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("gbar_ops_title" as any)}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("gbar_ops_desc" as any)}</p>
        </div>
      </div>

      {/* Summary Strip */}
      {(!loading || allStations.length > 0) && (
        <SummaryStrip groups={currentGroups} tab={activeTab} />
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("ativos")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === "ativos"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Play className="h-4 w-4" />
          Ativos
          <span className="text-xs text-muted-foreground">({activeGroups.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("encerrados")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === "encerrados"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Check className="h-4 w-4" />
          Encerrados
          <span className="text-xs text-muted-foreground">({closedGroups.length})</span>
        </button>
      </div>

      {/* Refresh note */}
      {activeTab === "ativos" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="h-3 w-3" />
          Atualiza a cada 1 min · Última: {lastRefresh.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && allStations.length === 0 && (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-full rounded-xl border border-border bg-card p-5 flex flex-col gap-4 opacity-70">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-5 w-3/4 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
                </div>
                <div className="h-5 w-16 rounded bg-muted animate-pulse" />
              </div>
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
                <div className="h-7 w-1/2 rounded bg-muted animate-pulse" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-border p-2.5 space-y-2">
                  <div className="h-3 w-full rounded bg-muted animate-pulse" />
                  <div className="h-6 w-8 rounded bg-muted animate-pulse" />
                </div>
                <div className="rounded-lg border border-border p-2.5 space-y-2">
                  <div className="h-3 w-full rounded bg-muted animate-pulse" />
                  <div className="h-6 w-8 rounded bg-muted animate-pulse" />
                </div>
                <div className="rounded-lg border border-border p-2.5 space-y-2">
                  <div className="h-3 w-full rounded bg-muted animate-pulse" />
                  <div className="h-6 w-8 rounded bg-muted animate-pulse" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
                <div className="h-3 w-1/4 rounded bg-muted animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {(!loading || allStations.length > 0) && currentGroups.length === 0 && (
        <div className="text-center py-16 text-muted-foreground border border-border/60 rounded-lg">
          <Beer className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">
            {activeTab === "ativos" ? "Nenhum bar ativo no momento" : "Nenhum evento encerrado com bares"}
          </p>
        </div>
      )}

      {/* Event cards horizontal scroll */}
      {(!loading || allStations.length > 0) && currentGroups.length > 0 && (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {currentGroups.map((group, idx) => (
            <EventCard
              key={group.eventId}
              group={group}
              index={idx}
              onSelect={() => setSelectedGroup(group)}
            />
          ))}
        </div>
      )}


      {/* Create Bar Dialog */}
      {/* Event drill-down sheet */}
      <Sheet
        open={!!selectedGroup}
        onOpenChange={(open) => { if (!open) setSelectedGroup(null); }}
      >
        <SheetContent
          side="bottom"
          className="h-[92vh] max-h-[92vh] overflow-y-auto p-0 bg-background border-border"
        >
          {selectedGroup && (
            <EventBarSheet
              group={selectedGroup}
              onCreateBar={(eventId) => {
                setCreateBarEventId(eventId);
                setCreateBarOpen(true);
                setSelectedGroup(null);
              }}
              onCloseStation={(station) => {
                handleOpenCloseStation(station);
                setSelectedGroup(null);
              }}
              onCancelQRs={(eventId) => {
                handleBulkCancelQRs(eventId);
                setSelectedGroup(null);
              }}
              onCopyLink={copyStationLink}
              formatTimeOpen={formatTimeOpen}
              bulkCancelling={bulkCancelling}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Create Bar Dialog */}
      <Dialog open={createBarOpen} onOpenChange={handleCloseCreateDialog}>
        <DialogContent>
          {!createdStation ? (
            <>
              <DialogHeader>
                <DialogTitle>{t("gbar_create_bar" as any)}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("gbar_bar_name" as any)}</Label>
                  <Input
                    className="h-12"
                    value={barName}
                    onChange={(e) => setBarName(e.target.value)}
                    placeholder={t("gbar_bar_name_placeholder" as any)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("gbar_operators_optional" as any)}</Label>
                  <div className="flex gap-2">
                    <Input
                      className="h-12"
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddMember();
                        }
                      }}
                      placeholder={t("gbar_operator_name_placeholder" as any)}
                    />
                    <Button type="button" variant="secondary" className="h-12" onClick={handleAddMember}>
                      {t("gbar_add" as any)}
                    </Button>
                  </div>
                  {memberNames.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {memberNames.map((name, idx) => (
                        <Badge key={idx} variant="secondary" className="gap-1 pr-1">
                          {name}
                          <button
                            type="button"
                            onClick={() => setMemberNames((prev) => prev.filter((_, i) => i !== idx))}
                            className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  className="h-12 w-full"
                  disabled={!barName.trim() || creating}
                  onClick={handleCreateBar}
                >
                  {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  {t("gbar_create_bar" as any)}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{t("gbar_bar_created" as any)}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{t("gbar_bar_created_desc" as any)}</p>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    className="h-12 font-mono text-xs"
                    value={`${window.location.origin}/bar?station=${createdStation.join_code}`}
                  />
                  <Button type="button" variant="secondary" className="h-12" onClick={handleCopyCreatedLink}>
                    {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" className="h-12" onClick={resetCreateDialog}>
                  {t("gbar_create_another" as any)}
                </Button>
                <Button className="h-12" onClick={() => handleCloseCreateDialog(false)}>
                  {t("close" as any)}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Close Station Dialog */}
      <Dialog open={!!closingStation} onOpenChange={(open) => { if (!open) { setClosingStation(null); setCloseReport(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Beer className="h-5 w-5 text-primary" />
              Fechar Bar — {closingStation?.name}
            </DialogTitle>
          </DialogHeader>
          {closeLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : closeReport && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Operadores</span>
                  <span className="text-sm font-medium">
                    {(closingStation?.bar_station_members ?? []).map(m => m.name).join(", ") || "Nenhum"}
                  </span>
                </div>
                <div className="border-t border-border/30" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tempo aberto</span>
                  <span className="text-sm font-medium">
                    {closeReport.hoursOpen < 1
                      ? `${Math.round(closeReport.hoursOpen * 60)} min`
                      : `${closeReport.hoursOpen}h`
                    }
                  </span>
                </div>
                <div className="border-t border-border/30" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Pedidos entregues</span>
                  <span className="text-sm font-bold">{closeReport.delivered}</span>
                </div>
                <div className="border-t border-border/30" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Faturamento entregue</span>
                  <span className="text-sm font-bold text-primary">{formatCurrency(closeReport.gmv)}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setClosingStation(null); setCloseReport(null); }}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleCloseStation} disabled={closeLoading}>
              Fechar Bar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// EventCard — horizontal card per event
// ============================================================
function EventCard({
  group,
  index,
  onSelect,
}: {
  group: EventBarGroup;
  index: number;
  onSelect: () => void;
}) {
  const lateActive = group.ordersLate > 0;

  return (
    <button
      onClick={onSelect}
      className="opacity-0 text-left w-full rounded-xl border border-border bg-card hover:bg-card/80 transition-colors p-5 flex flex-col gap-4"
      style={{ animation: `fadeSlideIn 0.4s ease-out ${index * 80}ms both` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-base font-bold text-foreground truncate">{group.eventName}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <Calendar className="h-3 w-3" />
            {group.eventDate
              ? format(new Date(group.eventDate), "dd MMM yyyy", { locale: ptBR })
              : "—"}
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 text-[10px]",
            group.isActive
              ? "border-primary/40 text-primary bg-primary/10"
              : "border-border text-muted-foreground"
          )}
        >
          {group.isActive ? "Ativo" : "Encerrado"}
        </Badge>
      </div>

      {/* Faturamento entregue — destaque laranja */}
      <div className="rounded-lg bg-primary/[0.07] border border-primary/[0.12] p-3">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Faturamento entregue
        </div>
        <div className="text-2xl font-bold text-primary mt-0.5">
          {formatCurrency(group.faturamentoEntregue)}
        </div>
      </div>

      {/* KPIs grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-border/60 p-2.5">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase tracking-wide">
            <ShoppingCart className="h-3 w-3" />
            Pedidos
          </div>
          <div className="text-lg font-bold mt-0.5">{group.ordersTotal}</div>
        </div>
        <div className="rounded-lg border border-border/60 p-2.5">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase tracking-wide">
            <CheckCircle2 className="h-3 w-3" />
            Entregues
          </div>
          <div className="text-lg font-bold mt-0.5">{group.ordersDelivered}</div>
        </div>
        <div
          className={cn(
            "rounded-lg border p-2.5",
            lateActive ? "border-destructive/50 bg-destructive/5" : "border-border/60"
          )}
        >
          <div
            className={cn(
              "flex items-center gap-1 text-[10px] uppercase tracking-wide",
              lateActive ? "text-destructive" : "text-muted-foreground"
            )}
          >
            <AlertTriangle className={cn("h-3 w-3", lateActive && "animate-pulse")} />
            Atrasados
          </div>
          <div
            className={cn(
              "text-lg font-bold mt-0.5",
              lateActive ? "text-destructive" : ""
            )}
          >
            {group.ordersLate}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border/40">
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Beer className="h-3.5 w-3.5" />
          {group.stations.length} {group.stations.length === 1 ? "bar" : "bares"}
          {group.isActive && group.activeStations !== group.stations.length && (
            <span className="text-[10px]">({group.activeStations} ativos)</span>
          )}
        </div>
        <div className="text-xs text-primary font-medium flex items-center gap-1">
          Ver detalhes
          <ChevronRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </button>
  );
}

// ============================================================
// EventBarSheet — drill-down with stations + late orders
// ============================================================
interface EventBarSheetProps {
  group: EventBarGroup;
  onCreateBar: (eventId: string) => void;
  onCloseStation: (station: StationRow) => void;
  onCancelQRs: (eventId: string) => void;
  onCopyLink: (joinCode: string) => void;
  formatTimeOpen: (createdAt: string) => string;
  bulkCancelling: boolean;
}

function EventBarSheet({
  group, onCreateBar, onCloseStation, onCancelQRs,
  onCopyLink, formatTimeOpen, bulkCancelling,
}: EventBarSheetProps) {
  const hasLate = group.ordersLate > 0;
  const dateLabel = (() => {
    try { return format(new Date(group.eventDate), "dd/MM/yyyy · HH:mm"); } catch { return ""; }
  })();

  const summaryChips: { label: string; value: string; highlight?: boolean; danger?: boolean }[] = [
    { label: "Faturamento entregue", value: formatCurrency(group.faturamentoEntregue), highlight: true },
    { label: "Total pedidos", value: String(group.ordersTotal) },
    { label: "Entregues", value: String(group.ordersDelivered) },
    { label: "Prontos", value: String(group.ordersReady) },
    { label: "Atrasados", value: String(group.ordersLate), danger: hasLate },
  ];

  const visibleStations = group.stations.filter((s) => group.isActive ? s.status === "active" : true);

  return (
    <div className="px-5 pt-3 pb-8 space-y-5">
      {/* Handle */}
      <div className="flex justify-center">
        <div className="h-1 w-10 rounded-full bg-border" />
      </div>

      {/* Header */}
      <SheetHeader className="space-y-1.5 text-left">
        <SheetTitle className="text-xl font-bold text-foreground">{group.eventName}</SheetTitle>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            {dateLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Beer className="h-3 w-3" />
            {group.stations.length} {group.stations.length === 1 ? "bar" : "bares"}
          </span>
          {group.isActive && (
            <span className="inline-flex items-center gap-1.5">
              <RefreshCw className="h-3 w-3" />
              Atualiza a cada 1 min
            </span>
          )}
        </div>
      </SheetHeader>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {summaryChips.map((chip) => (
          <div
            key={chip.label}
            className={cn(
              "rounded-lg border px-3 py-2 min-w-[120px] flex-1",
              chip.highlight && "bg-primary/[0.07] border-primary/[0.12]",
              chip.danger && "bg-destructive/10 border-destructive/40",
              !chip.highlight && !chip.danger && "bg-card border-border/60",
            )}
          >
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{chip.label}</div>
            <div className={cn(
              "text-base font-bold mt-0.5",
              chip.highlight && "text-primary",
              chip.danger && "text-destructive",
            )}>
              {chip.value}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border/50" />

      {/* Bares do evento */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Bares do evento</h3>
          {group.isActive && (
            <Button size="sm" onClick={() => onCreateBar(group.eventId)} className="gap-1.5 h-8">
              <Plus className="h-3.5 w-3.5" />
              Criar bar
            </Button>
          )}
        </div>

        {visibleStations.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground border border-border/60 rounded-lg">
            Nenhum bar para mostrar
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleStations.map((station) => {
              const d = group.stationDeliveries.get(station.id);
              return (
                <BarStationCard
                  key={station.id}
                  station={station}
                  deliveries={d?.count ?? 0}
                  gmv={d?.gmv ?? 0}
                  formatTimeOpen={formatTimeOpen}
                  onCopyLink={() => onCopyLink(station.join_code)}
                  onClose={() => onCloseStation(station)}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-border/50" />

      {/* Pedidos atrasados */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Pedidos atrasados</h3>
          {hasLate && (
            <Badge variant="outline" className="bg-destructive/10 border-destructive/40 text-destructive text-[10px]">
              {group.ordersLate}
            </Badge>
          )}
        </div>

        {group.lateOrders.length === 0 ? (
          <div className="text-center py-6 border border-border/60 rounded-lg">
            <CheckCircle2 className="h-6 w-6 text-primary mx-auto mb-1.5 opacity-70" />
            <p className="text-xs text-muted-foreground">Nenhum pedido atrasado. Tudo em dia!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {group.lateOrders.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2"
              >
                <div className="flex items-center gap-2 text-sm min-w-0">
                  <span className="font-bold text-primary">#{o.order_number ?? "—"}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {ORIGIN_LABELS[o.origin ?? ""] ?? o.origin ?? "—"}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold">{formatCurrency(o.total)}</span>
                  <span className="text-xs text-destructive font-medium">{o.minutesAgo} min</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cancelar QRs */}
      {group.isActive && (
        <>
          <div className="border-t border-border/50" />
          <div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full h-10 gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={bulkCancelling}
                >
                  {bulkCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                  Cancelar QRs em aberto
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar QRs em aberto?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso cancelará todos os QRs em aberto do evento &quot;{group.eventName}&quot;. Pedidos serão cancelados e estoque liberado.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onCancelQRs(group.eventId)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Confirmar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// BarStationCard — single station inside the sheet
// ============================================================
function BarStationCard({
  station, deliveries, gmv, formatTimeOpen, onCopyLink, onClose,
}: {
  station: StationRow;
  deliveries: number;
  gmv: number;
  formatTimeOpen: (createdAt: string) => string;
  onCopyLink: () => void;
  onClose: () => void;
}) {
  const isActive = station.status === "active";
  const members = (station.bar_station_members ?? []).map((m) => m.name).join(", ");

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn(
            "h-7 w-7 rounded-md flex items-center justify-center shrink-0",
            isActive ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
          )}>
            <Beer className="h-3.5 w-3.5" />
          </div>
          <div className="text-sm font-semibold truncate">{station.name}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCopyLink} title="Copiar link">
            <Copy className="h-3.5 w-3.5" />
          </Button>
          {isActive && (
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onClose} title="Fechar bar">
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Members */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <User className="h-3 w-3 shrink-0" />
        <span className="truncate">{members || "Sem operadores"}</span>
      </div>

      {/* Time open */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3 w-3 shrink-0" />
        {isActive ? `Aberto há ${formatTimeOpen(station.created_at)}` : "Fechado"}
      </div>

      {/* Faturamento */}
      <div className="rounded-lg bg-primary/[0.07] border border-primary/[0.12] p-2.5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Faturamento entregue</div>
        <div className="text-base font-bold text-primary mt-0.5">{formatCurrency(gmv)}</div>
      </div>

      {/* Deliveries */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Pedidos entregues</span>
        <span className="font-semibold">{deliveries}</span>
      </div>
    </div>
  );
}
