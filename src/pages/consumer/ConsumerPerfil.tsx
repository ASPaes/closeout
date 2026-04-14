import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/i18n/use-translation";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  LogOut,
  Loader2,
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
  Wallet,
  AlertTriangle,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { maskCPF, maskPhone, unmask } from "@/lib/masks";
import { Skeleton } from "@/components/ui/skeleton";

import { ProfileHeaderSocial } from "@/components/consumer/ProfileHeaderSocial";
import { ProfileStatsRow } from "@/components/consumer/ProfileStatsRow";
import { ProfileDetailSheet } from "@/components/consumer/ProfileDetailSheet";
import { PrivacyCard } from "@/components/consumer/PrivacyCard";
import { ProfileActionCards } from "@/components/consumer/ProfileActionCards";
import { ProfileSegmentedTabs } from "@/components/consumer/ProfileSegmentedTabs";
import { SavedCardsSection } from "@/components/consumer/SavedCardsSection";
import ConsumerLimites from "@/pages/consumer/ConsumerLimites";

/* ── status mappings ── */
const statusIcons: Record<string, React.ElementType> = {
  pending: Clock, paid: CheckCircle2, preparing: ChefHat,
  ready: Package, delivered: CheckCircle2, cancelled: XCircle,
};
const statusLabels: Record<string, string> = {
  pending: "Pendente", paid: "Confirmado", preparing: "Em Preparo",
  ready: "Pronto", delivered: "Entregue", cancelled: "Cancelado",
};
const paymentIcons: Record<string, React.ElementType> = {
  pix: Smartphone, credit: CreditCard, debit: CreditCard, cash: Banknote,
};

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ConsumerPerfil() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editCpf, setEditCpf] = useState("");
  const [editCpfError, setEditCpfError] = useState("");
  const [cpfChangeConfirm, setCpfChangeConfirm] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [saving, setSaving] = useState(false);
  const [detailSheet, setDetailSheet] = useState<"orders" | "events" | "transactions" | "privacy" | "limits" | null>(null);
  

  const [stats, setStats] = useState({ orders: 0, spent: 0, events: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);

  const [activeCheckin, setActiveCheckin] = useState<{
    id: string; event_id: string; event_name: string; is_visible: boolean;
  } | null>(null);
  const [togglingVisibility, setTogglingVisibility] = useState(false);

  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [loadingTabs, setLoadingTabs] = useState(true);

  const displayName = profile?.name || user?.email?.split("@")[0] || "";
  const displayEmail = user?.email || "";
  const displayCpf = profile?.cpf ? maskCPF(profile.cpf) : "—";
  const displayPhone = profile?.phone ? maskPhone(profile.phone) : "—";
  const profileUsername = (profile as any)?.username || null;
  const avatarUrl = localAvatarUrl || profile?.avatar_url || null;
  const initials = displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  /* ── data fetching — refetch every time page gains focus ── */
  const fetchAllData = useCallback(() => {
    if (!user) return;

    // Stats
    setLoadingStats(true);
    supabase.rpc("get_consumer_profile_stats").then(({ data, error }) => {
      if (data && !error) {
        const d = data as any;
        setStats({ orders: d.total_orders || 0, spent: Number(d.total_spent) || 0, events: d.total_events || 0 });
      }
      setLoadingStats(false);
    });

    // Active checkin
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
            id: row.id, event_id: row.event_id,
            event_name: row.events?.name || "Evento",
            is_visible: row.is_visible ?? true,
          });
        } else {
          setActiveCheckin(null);
        }
      });

    // Tabs
    setLoadingTabs(true);
    Promise.all([
      supabase.from("orders").select("id, order_number, status, total, created_at, payment_method, events!inner(name)").eq("consumer_id", user.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("event_checkins").select("id, event_id, checked_in_at, checked_out_at, events!inner(name)").eq("user_id", user.id).order("checked_in_at", { ascending: false }).limit(10),
      supabase.from("payments").select("id, amount, payment_method, status, created_at, paid_at").eq("consumer_id", user.id).order("created_at", { ascending: false }).limit(10),
    ]).then(([o, e, p]) => {
      setRecentOrders(o.data || []);
      setRecentEvents(e.data || []);
      setRecentPayments(p.data || []);
      setLoadingTabs(false);
    });
  }, [user]);

  // Fetch on mount
  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  // Re-fetch when tab/window regains focus
  useEffect(() => {
    const onFocus = () => fetchAllData();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") fetchAllData();
    });
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [fetchAllData]);

  /* ── CPF validation ── */
  function isValidCPF(cpf: string): boolean {
    cpf = cpf.replace(/\D/g, "");
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    for (let t = 9; t < 11; t++) {
      let d = 0;
      for (let c = 0; c < t; c++) d += parseInt(cpf[c]) * ((t + 1) - c);
      d = ((10 * d) % 11) % 10;
      if (parseInt(cpf[t]) !== d) return false;
    }
    return true;
  }

  /* ── actions ── */
  const openEdit = () => {
    setEditName(profile?.name || "");
    setEditPhone(profile?.phone ? maskPhone(profile.phone) : "");
    setEditUsername(profileUsername || "");
    setEditCpf(profile?.cpf || "");
    setEditCpfError("");
    setUsernameError("");
    setEditOpen(true);
  };

  const validateUsername = (val: string) => {
    if (!val) { setUsernameError(""); return true; }
    if (!/^[a-z0-9._]{3,30}$/.test(val)) {
      setUsernameError("3-30 caracteres: letras minúsculas, números, . e _");
      return false;
    }
    setUsernameError("");
    return true;
  };

  const cpfChanged = editCpf !== (profile?.cpf || "");

  const handleSaveClick = async () => {
    if (!user) return;
    // Validate CPF
    if (!editCpf || !isValidCPF(editCpf)) {
      setEditCpfError("CPF inválido");
      return;
    }
    setEditCpfError("");

    if (cpfChanged) {
      setCpfChangeConfirm(true);
      return;
    }
    await performSave(false);
  };

  const performSave = async (withCpfChange: boolean) => {
    if (!user) return;
    if (editUsername && !validateUsername(editUsername)) return;
    if (editUsername && editUsername !== profileUsername) {
      const { data: available } = await supabase.rpc("check_username_available", { p_username: editUsername });
      if (!available) { setUsernameError("Username já está em uso"); return; }
    }
    setSaving(true);
    const updates: any = { name: editName.trim(), phone: unmask(editPhone) };
    if (editUsername) updates.username = editUsername.toLowerCase();

    if (withCpfChange) {
      updates.cpf = editCpf;
      // Invalidate saved cards and customer map
      await Promise.all([
        supabase.from("asaas_customer_cards").update({ is_active: false } as any).eq("user_id", user.id),
        supabase.from("asaas_customer_map").delete().eq("user_id", user.id),
      ]);
    }

    const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(withCpfChange ? "CPF atualizado. Cartões salvos foram removidos." : t("consumer_profile_updated"));
      setEditOpen(false);
      window.location.reload();
    }
  };

  const handleToggleVisibility = async (val: boolean) => {
    if (!activeCheckin) return;
    setTogglingVisibility(true);
    const { error } = await supabase.rpc("set_checkin_visibility", { p_visible: val });
    setTogglingVisibility(false);
    if (error) { toast.error(error.message); } else {
      setActiveCheckin((prev) => (prev ? { ...prev, is_visible: val } : null));
      toast.success(val ? "Agora você está visível" : "Agora você está oculto");
    }
  };

  const handleLogout = async () => { await signOut(); navigate("/app/login"); };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const formatTime = (d: string) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  /* ── glass card style ── */
  const glassCard = "rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm";

  /* ── tab: orders ── */
  const ordersTab = (
    <div className="flex flex-col gap-2">
      {loadingTabs ? (
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)
      ) : recentOrders.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-muted-foreground">
          <Inbox className="h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm">Nenhum pedido ainda</p>
        </div>
      ) : (
        recentOrders.map((o: any) => {
          const Icon = statusIcons[o.status] || Clock;
          return (
            <button key={o.id} onClick={() => navigate("/app/pedidos")}
              className={cn(glassCard, "flex items-center gap-3 p-3 active:bg-white/[0.06] transition-colors text-left w-full min-h-[52px]")}>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 shrink-0">
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

  /* ── tab: events ── */
  const eventsTab = (
    <div className="flex flex-col gap-2">
      {loadingTabs ? (
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)
      ) : recentEvents.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-muted-foreground">
          <Calendar className="h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm">Nenhum evento visitado</p>
        </div>
      ) : (
        recentEvents.map((e: any) => {
          const isActive = !e.checked_out_at;
          return (
            <div key={e.id} className={cn(glassCard, "flex items-center gap-3 p-3 min-h-[52px]")}>
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl shrink-0", isActive ? "bg-green-500/10" : "bg-secondary")}>
                <Calendar className={cn("h-4 w-4", isActive ? "text-green-400" : "text-muted-foreground")} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{e.events?.name}</p>
                <p className="text-xs text-muted-foreground">{formatDate(e.checked_in_at)} · {formatTime(e.checked_in_at)}</p>
              </div>
              {isActive && (
                <span className="text-[10px] font-semibold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">Ativo</span>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  /* ── tab: transactions ── */
  const transactionsTab = (
    <div className="flex flex-col gap-2">
      {loadingTabs ? (
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)
      ) : recentPayments.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-muted-foreground">
          <DollarSign className="h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm">Nenhuma transação</p>
        </div>
      ) : (
        recentPayments.map((p: any) => {
          const PayIcon = paymentIcons[p.payment_method] || CreditCard;
          const isApproved = p.status === "approved";
          return (
            <div key={p.id} className={cn(glassCard, "flex items-center gap-3 p-3 min-h-[52px]")}>
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl shrink-0", isApproved ? "bg-green-500/10" : "bg-destructive/10")}>
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

  const handleAction = (key: string) => {
    if (key === "profile") openEdit();
    else if (key === "events") setDetailSheet("events");
    else if (key === "limits") setDetailSheet("limits");
    else if (key === "privacy") setDetailSheet("privacy");
  };

  return (
    <div className="flex flex-col gap-4 pb-20">
      {/* Header glass */}
      <ProfileHeaderSocial
        userId={user?.id || ""}
        avatarUrl={avatarUrl}
        initials={initials}
        displayName={displayName}
        username={profileUsername}
        email={displayEmail}
        presenceEvent={activeCheckin ? { name: activeCheckin.event_name } : null}
        onEditPress={openEdit}
        onAvatarUpdated={(url) => setLocalAvatarUrl(url)}
      />

      {/* Stats */}
      {loadingStats ? (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[76px] w-full rounded-2xl" />)}
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

      {/* Saved cards */}
      {user?.id && <SavedCardsSection userId={user.id} />}

      {/* Action cards */}
      <ProfileActionCards onAction={handleAction} />

      {/* Segmented tabs */}
      <ProfileSegmentedTabs
        tabs={[
          { key: "orders", label: "Pedidos", content: ordersTab },
          { key: "events", label: "Eventos", content: eventsTab },
          { key: "transactions", label: "Transações", content: transactionsTab },
        ]}
      />

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
      <ProfileDetailSheet open={detailSheet === "limits"} onOpenChange={(o) => !o && setDetailSheet(null)} title="Meus Limites">
        <ConsumerLimites />
      </ProfileDetailSheet>
      <ProfileDetailSheet open={detailSheet === "privacy"} onOpenChange={(o) => !o && setDetailSheet(null)} title="Segurança e Privacidade">
        <PrivacyCard
          isVisible={activeCheckin?.is_visible ?? false}
          hasActiveCheckin={!!activeCheckin}
          onToggle={handleToggleVisibility}
          loading={togglingVisibility}
        />
      </ProfileDetailSheet>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive active:bg-destructive/10 transition-colors"
      >
        <LogOut className="h-4 w-4" />
        {t("consumer_logout")}
      </button>

      <p className="text-center text-[10px] text-muted-foreground/30 pb-2">
        Close Out v1.0 · © 2026
      </p>

      {/* Edit Profile Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="dark max-w-[420px] rounded-3xl border-white/[0.08] bg-card/95 backdrop-blur-xl text-foreground">
          <DialogHeader>
            <DialogTitle>{t("consumer_edit_profile")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <Input
              placeholder={t("full_name")}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-12 rounded-xl border-white/[0.08] bg-white/[0.04] text-base"
            />
            <div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-base">@</span>
                <Input
                  placeholder="username"
                  value={editUsername}
                  onChange={(e) => {
                    const v = e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, "");
                    setEditUsername(v);
                    validateUsername(v);
                  }}
                  className="h-12 rounded-xl border-white/[0.08] bg-white/[0.04] text-base pl-8"
                  maxLength={30}
                />
              </div>
              {usernameError && <p className="text-xs text-destructive mt-1 ml-1">{usernameError}</p>}
            </div>
            <Input
              placeholder={t("consumer_phone_placeholder")}
              value={editPhone}
              onChange={(e) => setEditPhone(maskPhone(e.target.value))}
              className="h-12 rounded-xl border-white/[0.08] bg-white/[0.04] text-base"
              inputMode="numeric"
            />
            <div>
              <Input
                placeholder="CPF (apenas números)"
                value={maskCPF(editCpf)}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 11);
                  setEditCpf(v);
                  if (v.length === 11 && !isValidCPF(v)) setEditCpfError("CPF inválido");
                  else setEditCpfError("");
                }}
                className="h-12 rounded-xl border-white/[0.08] bg-white/[0.04] text-base"
                inputMode="numeric"
              />
              {editCpfError && <p className="text-xs text-destructive mt-1 ml-1">{editCpfError}</p>}
              {cpfChanged && !editCpfError && editCpf.length === 11 && (
                <p className="text-[10px] text-amber-400 mt-1 ml-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Alterar o CPF removerá seus cartões salvos
                </p>
              )}
            </div>
            <Button
              onClick={handleSaveClick}
              disabled={saving || !!usernameError || !!editCpfError}
              className="h-14 rounded-xl bg-gradient-to-r from-primary to-primary-glow text-base font-semibold text-primary-foreground"
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : t("consumer_save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CPF change confirmation */}
      <AlertDialog open={cpfChangeConfirm} onOpenChange={setCpfChangeConfirm}>
        <AlertDialogContent className="dark max-w-[400px] rounded-3xl border-white/[0.08] bg-card/95 backdrop-blur-xl text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar CPF</AlertDialogTitle>
            <AlertDialogDescription>
              Ao alterar seu CPF, todos os seus cartões salvos serão removidos porque estão vinculados ao CPF anterior. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => performSave(true)}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? "Salvando..." : "Confirmar e salvar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
