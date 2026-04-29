import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/i18n/use-translation";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  LogOut,
  CreditCard,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { ProfileHeaderSocial } from "@/components/consumer/ProfileHeaderSocial";
import { ProfileStatsRow } from "@/components/consumer/ProfileStatsRow";
import { ProfileDetailSheet } from "@/components/consumer/ProfileDetailSheet";
import { PrivacyCard } from "@/components/consumer/PrivacyCard";
import { ProfileActionCards } from "@/components/consumer/ProfileActionCards";
import { SavedCardsSection } from "@/components/consumer/SavedCardsSection";
import { EditProfileDialog } from "@/components/consumer/EditProfileDialog";
import ConsumerLimites from "@/pages/consumer/ConsumerLimites";

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ConsumerPerfil() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

  const [editOpen, setEditOpen] = useState(false);
  const [cardsDialogOpen, setCardsDialogOpen] = useState(false);
  const [detailSheet, setDetailSheet] = useState<"privacy" | "limits" | null>(null);
  

  const [stats, setStats] = useState({ orders: 0, spent: 0, events: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);

  const [activeCheckin, setActiveCheckin] = useState<{
    id: string; event_id: string; event_name: string; is_visible: boolean;
  } | null>(null);
  const [togglingVisibility, setTogglingVisibility] = useState(false);

  const displayName = profile?.name || user?.email?.split("@")[0] || "";
  const displayEmail = user?.email || "";
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

  /* ── actions ── */
  const openEdit = () => setEditOpen(true);

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

  const handleAction = (key: string) => {
    if (key === "profile") openEdit();
    else if (key === "cards") setCardsDialogOpen(true);
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
            { label: "Pedidos", value: stats.orders, icon: "orders" },
            { label: "Gasto Total", value: formatCurrency(stats.spent), icon: "spent" },
            { label: "Eventos", value: stats.events, icon: "events" },
          ]}
        />
      )}

      {/* Action cards (saved cards moved into dialog opened from action card) */}

      {/* Action cards */}
      <ProfileActionCards onAction={handleAction} />

      {/* Detail sheets */}
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

      {/* Saved cards dialog */}
      <Dialog open={cardsDialogOpen} onOpenChange={setCardsDialogOpen}>
        <DialogContent className="dark max-w-[480px] rounded-3xl border-white/[0.08] bg-card/95 backdrop-blur-xl text-foreground max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Meus cartões</DialogTitle>
          </DialogHeader>
          {user?.id && <SavedCardsSection userId={user.id} />}
        </DialogContent>
      </Dialog>

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
      <EditProfileDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        userId={user?.id || ""}
        email={displayEmail}
        profile={profile as any}
        initials={initials}
        avatarUrl={avatarUrl}
        onAvatarUpdated={(url) => setLocalAvatarUrl(url)}
        onSaved={() => fetchAllData()}
      />
    </div>
  );
}
