import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/i18n/use-translation";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  LogOut,
  Loader2,
  Receipt,
  Calendar,
  CreditCard,
  Clock,
  CheckCircle2,
  ChefHat,
  Package,
  XCircle,
  Banknote,
  Smartphone,
  DollarSign,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { maskCPF, maskPhone, unmask } from "@/lib/masks";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";

import { ProfileHeaderSocial } from "@/components/consumer/ProfileHeaderSocial";
import { ProfileStatsRow } from "@/components/consumer/ProfileStatsRow";
import { ProfileDetailSheet } from "@/components/consumer/ProfileDetailSheet";
import { PrivacyCard } from "@/components/consumer/PrivacyCard";

const statusIcons: Record<string, React.ElementType> = {
  pending: Clock,
  paid: CheckCircle2,
  preparing: ChefHat,
  ready: Package,
  delivered: CheckCircle2,
  cancelled: XCircle,
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  paid: "Confirmado",
  preparing: "Em Preparo",
  ready: "Pronto",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const paymentIcons: Record<string, React.ElementType> = {
  pix: Smartphone,
  credit: CreditCard,
  debit: CreditCard,
  cash: Banknote,
};

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function deriveUsername(name: string, email: string) {
  if (name && name.trim()) {
    return name.trim().toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9._]/g, "");
  }
  return email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9._]/g, "") || "user";
}

export default function ConsumerPerfil() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [detailSheet, setDetailSheet] = useState<"orders" | "events" | "transactions" | null>(null);

  // Stats
  const [stats, setStats] = useState({ orders: 0, spent: 0, events: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  // Presence
  const [activeCheckin, setActiveCheckin] = useState<{
    id: string;
    event_id: string;
    event_name: string;
    is_visible: boolean;
  } | null>(null);
  const [togglingVisibility, setTogglingVisibility] = useState(false);

  // Recent orders
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [loadingTabs, setLoadingTabs] = useState(true);

  const displayName = profile?.name || user?.email?.split("@")[0] || "";
  const displayEmail = user?.email || "";
  const displayCpf = profile?.cpf ? maskCPF(profile.cpf) : "—";
  const displayPhone = profile?.phone ? maskPhone(profile.phone) : "—";
  const username = deriveUsername(displayName, displayEmail);
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Fetch stats
  useEffect(() => {
    if (!user) return;
    setLoadingStats(true);
    Promise.all([
      supabase
        .from("orders")
        .select("id, total, status", { count: "exact" })
        .eq("consumer_id", user.id)
        .in("status", ["paid", "preparing", "ready", "delivered"]),
      supabase
        .from("event_checkins")
        .select("event_id")
        .eq("user_id", user.id),
    ]).then(([ordersRes, checkinsRes]) => {
      const orders = ordersRes.data || [];
      const spent = orders.reduce((s, o) => s + Number(o.total || 0), 0);
      const uniqueEvents = new Set((checkinsRes.data || []).map((c) => c.event_id));
      setStats({ orders: orders.length, spent, events: uniqueEvents.size });
      setLoadingStats(false);
    });
  }, [user]);

  // Fetch active checkin
  useEffect(() => {
    if (!user) return;
    supabase
      .from("event_checkins")
      .select("id, event_id, is_visible, events!inner(name)")
      .eq("user_id", user.id)
      .is("checked_out_at", null)
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const row = data[0] as any;
          setActiveCheckin({
            id: row.id,
            event_id: row.event_id,
            event_name: row.events?.name || "Evento",
            is_visible: row.is_visible ?? true,
          });
        }
      });
  }, [user]);

  // Fetch tab data
  useEffect(() => {
    if (!user) return;
    setLoadingTabs(true);
    Promise.all([
      supabase
        .from("orders")
        .select("id, order_number, status, total, created_at, payment_method, events!inner(name)")
        .eq("consumer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("event_checkins")
        .select("id, event_id, checked_in_at, checked_out_at, events!inner(name)")
        .eq("user_id", user.id)
        .order("checked_in_at", { ascending: false })
        .limit(10),
      supabase
        .from("payments")
        .select("id, amount, payment_method, status, created_at, paid_at")
        .eq("consumer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]).then(([ordersRes, eventsRes, paymentsRes]) => {
      setRecentOrders(ordersRes.data || []);
      setRecentEvents(eventsRes.data || []);
      setRecentPayments(paymentsRes.data || []);
      setLoadingTabs(false);
    });
  }, [user]);

  const openEdit = () => {
    setEditName(profile?.name || "");
    setEditPhone(profile?.phone ? maskPhone(profile.phone) : "");
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name: editName.trim(), phone: unmask(editPhone) })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("consumer_profile_updated"));
      setEditOpen(false);
      window.location.reload();
    }
  };

  const handleToggleVisibility = async (val: boolean) => {
    if (!activeCheckin) return;
    setTogglingVisibility(true);
    const { error } = await supabase
      .from("event_checkins")
      .update({ is_visible: val })
      .eq("id", activeCheckin.id);
    setTogglingVisibility(false);
    if (error) {
      toast.error(error.message);
    } else {
      setActiveCheckin((prev) => (prev ? { ...prev, is_visible: val } : null));
      toast.success(val ? "Agora você está visível" : "Agora você está oculto");
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/app/login");
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  const formatTime = (d: string) => {
    return new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  // Tab: Pedidos
  const ordersTab = (
    <div className="flex flex-col gap-2">
      {loadingTabs ? (
        Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))
      ) : recentOrders.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-muted-foreground">
          <Inbox className="h-10 w-10 mb-2 opacity-40" />
          <p className="text-sm">Nenhum pedido ainda</p>
        </div>
      ) : (
        recentOrders.map((o: any) => {
          const Icon = statusIcons[o.status] || Clock;
          return (
            <button
              key={o.id}
              onClick={() => navigate("/app/pedidos")}
              className="flex items-center gap-3 rounded-xl border border-border/30 bg-card p-3 active:bg-secondary/50 transition-colors text-left w-full min-h-[48px]"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">#{o.order_number}</span>
                  <span className="text-[10px] text-muted-foreground">{statusLabels[o.status]}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{(o as any).events?.name}</p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-sm font-bold text-foreground">{formatCurrency(o.total)}</span>
                <p className="text-[10px] text-muted-foreground">{formatDate(o.created_at)}</p>
              </div>
            </button>
          );
        })
      )}
    </div>
  );

  // Tab: Eventos
  const eventsTab = (
    <div className="flex flex-col gap-2">
      {loadingTabs ? (
        Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))
      ) : recentEvents.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-muted-foreground">
          <Calendar className="h-10 w-10 mb-2 opacity-40" />
          <p className="text-sm">Nenhum evento visitado</p>
        </div>
      ) : (
        recentEvents.map((e: any) => {
          const isActive = !e.checked_out_at;
          return (
            <div
              key={e.id}
              className="flex items-center gap-3 rounded-xl border border-border/30 bg-card p-3 min-h-[48px]"
            >
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full shrink-0",
                  isActive ? "bg-green-500/10" : "bg-secondary"
                )}
              >
                <Calendar className={cn("h-4 w-4", isActive ? "text-green-400" : "text-muted-foreground")} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{e.events?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(e.checked_in_at)} · {formatTime(e.checked_in_at)}
                </p>
              </div>
              {isActive && (
                <span className="text-[10px] font-semibold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                  Ativo
                </span>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  // Tab: Transações
  const transactionsTab = (
    <div className="flex flex-col gap-2">
      {loadingTabs ? (
        Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))
      ) : recentPayments.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-muted-foreground">
          <DollarSign className="h-10 w-10 mb-2 opacity-40" />
          <p className="text-sm">Nenhuma transação</p>
        </div>
      ) : (
        recentPayments.map((p: any) => {
          const PayIcon = paymentIcons[p.payment_method] || CreditCard;
          const isApproved = p.status === "approved";
          return (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-xl border border-border/30 bg-card p-3 min-h-[48px]"
            >
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full shrink-0",
                  isApproved ? "bg-green-500/10" : "bg-destructive/10"
                )}
              >
                <PayIcon className={cn("h-4 w-4", isApproved ? "text-green-400" : "text-destructive")} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {p.payment_method === "pix" ? "PIX" : p.payment_method === "credit" ? "Crédito" : p.payment_method === "debit" ? "Débito" : "Pagamento"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.paid_at ? formatDate(p.paid_at) + " · " + formatTime(p.paid_at) : formatDate(p.created_at)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className={cn("text-sm font-bold", isApproved ? "text-green-400" : "text-destructive")}>
                  -{formatCurrency(p.amount)}
                </span>
                <p className="text-[10px] text-muted-foreground">{isApproved ? "Aprovado" : p.status}</p>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-4 pb-20">
      {/* Social header */}
      <ProfileHeaderSocial
        avatarUrl={profile?.avatar_url || null}
        initials={initials}
        displayName={displayName}
        username={username}
        email={displayEmail}
        presenceEvent={activeCheckin ? { name: activeCheckin.event_name } : null}
        onEditPress={openEdit}
      />

      {/* Stats */}
      {loadingStats ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <ProfileStatsRow
          stats={[
            { label: "Pedidos", value: stats.orders, icon: "orders", onClick: () => setDetailSheet("orders") },
            { label: "Gasto Total", value: formatCurrency(stats.spent), icon: "spent", onClick: () => setDetailSheet("transactions") },
            { label: "Eventos", value: stats.events, icon: "events", onClick: () => setDetailSheet("events") },
          ]}
        />
      )}

      {/* Detail sheets */}
      <ProfileDetailSheet open={detailSheet === "orders"} onOpenChange={(o) => !o && setDetailSheet(null)} title="Meus Pedidos">
        {ordersTab}
      </ProfileDetailSheet>
      <ProfileDetailSheet open={detailSheet === "events"} onOpenChange={(o) => !o && setDetailSheet(null)} title="Eventos Visitados">
        {eventsTab}
      </ProfileDetailSheet>
      <ProfileDetailSheet open={detailSheet === "transactions"} onOpenChange={(o) => !o && setDetailSheet(null)} title="Transações">
        {transactionsTab}
      </ProfileDetailSheet>

      {/* Privacy card */}
      <PrivacyCard
        isVisible={activeCheckin?.is_visible ?? false}
        hasActiveCheckin={!!activeCheckin}
        onToggle={handleToggleVisibility}
        loading={togglingVisibility}
      />

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive active:bg-destructive/10 transition-colors"
      >
        <LogOut className="h-4 w-4" />
        {t("consumer_logout")}
      </button>

      <p className="text-center text-[10px] text-muted-foreground/40 pb-2">
        Close Out v1.0 · © 2026
      </p>

      {/* Edit Profile Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="dark max-w-[420px] rounded-2xl border-border/60 bg-card text-foreground">
          <DialogHeader>
            <DialogTitle>{t("consumer_edit_profile")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <Input
              placeholder={t("full_name")}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-12 rounded-xl border-border/60 bg-secondary text-base"
            />
            <Input
              placeholder={t("consumer_phone_placeholder")}
              value={editPhone}
              onChange={(e) => setEditPhone(maskPhone(e.target.value))}
              className="h-12 rounded-xl border-border/60 bg-secondary text-base"
              inputMode="numeric"
            />
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">
                CPF: <span className="font-medium text-foreground">{displayCpf}</span>
                <span className="ml-2 text-[10px]">({t("consumer_cpf_not_editable")})</span>
              </p>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-14 rounded-xl bg-gradient-to-r from-primary to-primary-glow text-base font-semibold text-primary-foreground"
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : t("consumer_save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
