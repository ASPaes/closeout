import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/i18n/use-translation";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  User,
  CreditCard,
  Wallet,
  LogOut,
  ChevronRight,
  Pencil,
  Loader2,
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

export default function ConsumerPerfil() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const displayName = profile?.name || user?.email?.split("@")[0] || "";
  const displayEmail = user?.email || "";
  const displayCpf = profile?.cpf ? maskCPF(profile.cpf) : "—";
  const displayPhone = profile?.phone ? maskPhone(profile.phone) : "—";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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
      .update({
        name: editName.trim(),
        phone: unmask(editPhone),
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("consumer_profile_updated"));
      setEditOpen(false);
      // Trigger re-fetch by reloading
      window.location.reload();
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/app/login");
  };

  const menuItems = [
    { icon: User, label: t("consumer_personal_data"), action: openEdit, color: "text-primary" },
    { icon: CreditCard, label: t("consumer_payment_methods"), action: () => {}, color: "text-info" },
    { icon: Wallet, label: t("consumer_limits_title"), action: () => navigate("/app/limites"), color: "text-warning" },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Profile header */}
      <div className="flex flex-col items-center rounded-2xl border border-border/60 bg-card p-5">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-xl font-bold text-primary"
        >
          {initials}
        </div>
        <h1 className="mt-3 text-lg font-bold text-foreground">{displayName}</h1>
        <p className="text-xs text-muted-foreground">{displayEmail}</p>

        <div className="mt-3 w-full space-y-1.5 rounded-xl bg-secondary/50 p-3">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">CPF</span>
            <span className="text-foreground font-medium">{displayCpf}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{t("consumer_phone_label")}</span>
            <span className="text-foreground font-medium">{displayPhone}</span>
          </div>
        </div>

        <button
          onClick={openEdit}
          className="mt-3 flex items-center gap-1.5 text-xs text-primary active:text-primary/70 transition-colors min-h-[44px]"
        >
          <Pencil className="h-3.5 w-3.5" />
          {t("consumer_edit_profile")}
        </button>
      </div>

      {/* Menu */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        {menuItems.map((item, i) => (
          <button
            key={item.label}
            onClick={item.action}
            className={cn(
              "flex w-full min-h-[48px] items-center gap-3 px-4 py-3 text-left active:bg-secondary/50 transition-colors",
              i > 0 && "border-t border-border/30"
            )}
          >
            <item.icon className={cn("h-5 w-5 shrink-0", item.color)} />
            <span className="flex-1 text-sm font-medium text-foreground">{item.label}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
          </button>
        ))}
      </div>

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
