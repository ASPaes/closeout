import { useState, useEffect, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import { BarEventGuard } from "@/components/BarEventGuard";
import { useTranslation } from "@/i18n/use-translation";
import { useBar } from "@/contexts/BarContext";
import { supabase } from "@/integrations/supabase/client";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  History, CheckCircle2, XCircle, ShieldCheck, ShieldX, Percent,
  Clock, Smartphone, User, Monitor,
} from "lucide-react";

type ValidationRow = {
  id: string;
  created_at: string;
  result: string;
  order_id: string;
  qr_token_id: string;
  validated_by: string;
  order_number: number | null;
  order_total: number | null;
  order_origin: string | null;
  order_status: string | null;
  order_created_at: string | null;
  order_paid_at: string | null;
  order_preparing_at: string | null;
  order_ready_at: string | null;
  order_delivered_at: string | null;
  staff_name: string | null;
};

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
  notes: string | null;
};

const RESULT_MAP: Record<string, { variant: "active" | "cancelled" | "inactive"; label: string }> = {
  valid: { variant: "active", label: "bar_hist_valid" },
  already_used: { variant: "cancelled", label: "bar_qr_used" },
  cancelled: { variant: "cancelled", label: "bar_qr_cancelled" },
  invalid: { variant: "inactive", label: "bar_qr_invalid" },
};

export default function BarHistorico() {
  const { t } = useTranslation();
  const { eventId } = useBar();

  const [validations, setValidations] = useState<ValidationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [resultFilter, setResultFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [selectedValidation, setSelectedValidation] = useState<ValidationRow | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const fetchValidations = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("validations")
        .select(`
          id, created_at, result, order_id, qr_token_id, validated_by,
          orders!inner(order_number, total, origin, status, created_at, paid_at, preparing_at, ready_at, delivered_at)
        `)
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      // Collect unique staff ids
      const staffIds = [...new Set((data || []).map((v: any) => v.validated_by).filter(Boolean))];
      let profilesMap: Record<string, string> = {};
      if (staffIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", staffIds);
        if (profiles) {
          profilesMap = Object.fromEntries(profiles.map((p) => [p.id, p.name]));
        }
      }

      const rows: ValidationRow[] = (data || []).map((v: any) => {
        const o = v.orders;
        return {
          id: v.id,
          created_at: v.created_at,
          result: v.result,
          order_id: v.order_id,
          qr_token_id: v.qr_token_id,
          validated_by: v.validated_by,
          order_number: o?.order_number ?? null,
          order_total: o?.total ?? null,
          order_origin: o?.origin ?? null,
          order_status: o?.status ?? null,
          order_created_at: o?.created_at ?? null,
          order_paid_at: o?.paid_at ?? null,
          order_preparing_at: o?.preparing_at ?? null,
          order_ready_at: o?.ready_at ?? null,
          order_delivered_at: o?.delivered_at ?? null,
          staff_name: profilesMap[v.validated_by] || null,
        };
      });

      setValidations(rows);
    } catch (err) {
      console.error("Failed to fetch validations:", err);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { fetchValidations(); }, [fetchValidations]);

  // Filtered data
  const filtered = useMemo(() => {
    let rows = validations;

    if (search.trim()) {
      const q = search.trim().toLowerCase().replace("#", "");
      rows = rows.filter((r) =>
        r.order_number?.toString().includes(q) ||
        r.staff_name?.toLowerCase().includes(q)
      );
    }

    if (resultFilter === "valid") rows = rows.filter((r) => r.result === "valid");
    else if (resultFilter === "rejected") rows = rows.filter((r) => r.result !== "valid");

    if (periodFilter !== "all") {
      const now = Date.now();
      let cutoff = 0;
      if (periodFilter === "hour") cutoff = now - 3600_000;
      else if (periodFilter === "today") {
        const d = new Date(); d.setHours(0, 0, 0, 0); cutoff = d.getTime();
      }
      if (cutoff) rows = rows.filter((r) => new Date(r.created_at).getTime() >= cutoff);
    }

    return rows;
  }, [validations, search, resultFilter, periodFilter]);

  // Summary
  const summary = useMemo(() => {
    const total = filtered.length;
    const valid = filtered.filter((r) => r.result === "valid").length;
    const rejected = total - valid;
    const rate = total > 0 ? Math.round((valid / total) * 100) : 0;
    return { total, valid, rejected, rate };
  }, [filtered]);

  // Detail modal
  const openDetail = async (row: ValidationRow) => {
    setSelectedValidation(row);
    setOrderItems([]);
    if (row.order_id && row.order_id !== "00000000-0000-0000-0000-000000000000") {
      setLoadingItems(true);
      const { data } = await supabase
        .from("order_items")
        .select("id, name, quantity, unit_price, total, notes")
        .eq("order_id", row.order_id);
      setOrderItems((data as OrderItem[]) || []);
      setLoadingItems(false);
    }
  };

  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const fmtOrderNum = (n: number | null) => n != null ? `#${String(n).padStart(3, "0")}` : "—";

  const originIcon = (origin: string | null) => {
    if (origin === "consumer_app") return <Smartphone className="h-3.5 w-3.5" />;
    if (origin === "waiter_app") return <User className="h-3.5 w-3.5" />;
    return <Monitor className="h-3.5 w-3.5" />;
  };

  const originLabel = (origin: string | null) => {
    if (origin === "consumer_app") return "App";
    if (origin === "waiter_app") return t("bar_origin_waiter");
    return t("bar_origin_cashier");
  };

  const columns: DataTableColumn<ValidationRow>[] = [
    {
      key: "created_at",
      header: t("bar_hist_datetime"),
      render: (row) => <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(row.created_at)}</span>,
    },
    {
      key: "order",
      header: t("bar_hist_order"),
      render: (row) => (
        <Button variant="link" className="p-0 h-auto text-primary font-mono font-bold" onClick={() => openDetail(row)}>
          {fmtOrderNum(row.order_number)}
        </Button>
      ),
    },
    {
      key: "result",
      header: t("bar_hist_result"),
      render: (row) => {
        const cfg = RESULT_MAP[row.result] || RESULT_MAP.invalid;
        return <StatusBadge status={cfg.variant} label={t(cfg.label as any)} />;
      },
    },
    {
      key: "validated_by",
      header: t("bar_hist_validated_by"),
      render: (row) => <span className="text-sm">{row.staff_name || "—"}</span>,
    },
  ];

  return (
    <BarEventGuard>
      <div className="space-y-6">
        <PageHeader title={t("bar_history")} subtitle={t("bar_history_desc")} icon={History} />

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard icon={<History className="h-5 w-5 text-muted-foreground" />} label={t("bar_hist_total")} value={summary.total} />
          <SummaryCard icon={<CheckCircle2 className="h-5 w-5 text-success" />} label={t("bar_hist_valid")} value={summary.valid} />
          <SummaryCard icon={<XCircle className="h-5 w-5 text-destructive" />} label={t("bar_hist_rejected")} value={summary.rejected} />
          <SummaryCard icon={<Percent className="h-5 w-5 text-primary" />} label={t("bar_hist_success_rate")} value={`${summary.rate}%`} />
        </div>

        {/* Table */}
        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={(r) => r.id}
          loading={loading}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t("bar_hist_search_placeholder")}
          emptyMessage={t("bar_hist_empty")}
          filters={
            <div className="flex gap-2 flex-wrap">
              <Select value={resultFilter} onValueChange={setResultFilter}>
                <SelectTrigger className="w-[140px] bg-secondary/50 border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("bar_all")}</SelectItem>
                  <SelectItem value="valid">{t("bar_hist_valid")}</SelectItem>
                  <SelectItem value="rejected">{t("bar_hist_rejected")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="w-[140px] bg-secondary/50 border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("bar_hist_period_all")}</SelectItem>
                  <SelectItem value="today">{t("bar_hist_period_today")}</SelectItem>
                  <SelectItem value="hour">{t("bar_hist_period_hour")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        />

        {/* Detail modal */}
        <Dialog open={!!selectedValidation} onOpenChange={(o) => { if (!o) setSelectedValidation(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("bar_hist_detail_title")} {selectedValidation ? fmtOrderNum(selectedValidation.order_number) : ""}</DialogTitle>
            </DialogHeader>
            {selectedValidation && (
              <div className="space-y-5">
                {/* Result badge */}
                <div className="flex items-center gap-2">
                  {(() => {
                    const cfg = RESULT_MAP[selectedValidation.result] || RESULT_MAP.invalid;
                    return <StatusBadge status={cfg.variant} label={t(cfg.label as any)} />;
                  })()}
                  <span className="text-xs text-muted-foreground">{fmtDate(selectedValidation.created_at)}</span>
                </div>

                {/* Order info */}
                {selectedValidation.order_number != null && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      {originIcon(selectedValidation.order_origin)}
                      <span>{originLabel(selectedValidation.order_origin)}</span>
                      {selectedValidation.order_total != null && (
                        <span className="ml-auto font-bold">R$ {selectedValidation.order_total.toFixed(2)}</span>
                      )}
                    </div>

                    {/* Items */}
                    {loadingItems ? (
                      <p className="text-xs text-muted-foreground">{t("loading")}...</p>
                    ) : orderItems.length > 0 ? (
                      <div className="bg-secondary/30 rounded-md p-3 space-y-1">
                        {orderItems.map((item) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span>{item.quantity}x {item.name}</span>
                            <span className="text-muted-foreground">R$ {item.total.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {/* Timeline */}
                    <div className="space-y-1 pt-2">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">{t("bar_hist_timeline")}</p>
                      <TimelineStep label={t("bar_hist_tl_created")} time={fmtDate(selectedValidation.order_created_at)} />
                      <TimelineStep label={t("bar_hist_tl_paid")} time={fmtDate(selectedValidation.order_paid_at)} />
                      <TimelineStep label={t("bar_hist_tl_preparing")} time={fmtDate(selectedValidation.order_preparing_at)} />
                      <TimelineStep label={t("bar_hist_tl_ready")} time={fmtDate(selectedValidation.order_ready_at)} />
                      <TimelineStep label={t("bar_hist_tl_delivered")} time={fmtDate(selectedValidation.order_delivered_at)} />
                    </div>
                  </div>
                )}

                {/* Validated by */}
                <div className="text-sm text-muted-foreground">
                  {t("bar_hist_validated_by")}: <span className="text-foreground font-medium">{selectedValidation.staff_name || "—"}</span>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </BarEventGuard>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardContent className="p-4 flex items-center gap-3">
        {icon}
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineStep({ label, time }: { label: string; time: string }) {
  const done = time !== "—";
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className={`h-2 w-2 rounded-full ${done ? "bg-primary" : "bg-muted-foreground/30"}`} />
      <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
      <span className="ml-auto text-muted-foreground">{time}</span>
    </div>
  );
}
