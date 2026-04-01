import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/use-translation";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, QrCode, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import logoMark from "@/assets/brand/logo-mark.png";

const SESSION_KEY = "closeout_waiter_join_code";

export default function WaiterLogin() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [showScanner, setShowScanner] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const scannerRef = useRef<any>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);

  // If already logged in, redirect
  useEffect(() => {
    if (authLoading) return;
    if (user) {
      const savedCode = sessionStorage.getItem(SESSION_KEY);
      if (savedCode) {
        sessionStorage.removeItem(SESSION_KEY);
        navigate(`/garcom/join/${savedCode}`, { replace: true });
      } else {
        navigate("/garcom", { replace: true });
      }
    }
  }, [user, authLoading]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
      }
      // onAuthStateChange will redirect via useEffect
    } catch {
      toast.error(t("wl_login_error"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleQrResult = (decodedText: string) => {
    // Extract join code from URL like /garcom/join/ABCD1234
    const match = decodedText.match(/\/garcom\/join\/([A-Za-z0-9]+)/);
    const code = match ? match[1] : decodedText.trim();
    if (code) {
      stopScanner();
      sessionStorage.setItem(SESSION_KEY, code);
      if (user) {
        navigate(`/garcom/join/${code}`, { replace: true });
      } else {
        toast.info(t("wl_login_first"));
      }
    }
  };

  const startScanner = async () => {
    setShowScanner(true);
    // Dynamic import to keep bundle small
    const { Html5Qrcode } = await import("html5-qrcode");
    await new Promise((r) => setTimeout(r, 100)); // wait for DOM
    if (!scannerContainerRef.current) return;
    const scanner = new Html5Qrcode("waiter-qr-scanner");
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        handleQrResult,
        () => {}
      );
    } catch {
      toast.error(t("wl_camera_error"));
      setShowScanner(false);
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setShowScanner(false);
  };

  const handleManualCode = () => {
    const code = manualCode.trim();
    if (!code) return;
    sessionStorage.setItem(SESSION_KEY, code);
    if (user) {
      navigate(`/garcom/join/${code}`, { replace: true });
    } else {
      toast.info(t("wl_login_first"));
    }
  };

  if (authLoading) {
    return (
      <div className="dark mx-auto flex min-h-[100dvh] max-w-[480px] items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) return null; // will redirect via useEffect

  return (
    <div className="dark mx-auto flex min-h-[100dvh] max-w-[480px] flex-col bg-background px-6 pb-10 pt-16 text-foreground">
      {/* Header */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <img src={logoMark} alt="Close Out" className="h-16 w-16 rounded-2xl object-cover" />
        <h1 className="text-2xl font-bold text-foreground">{t("wl_title")}</h1>
        <p className="text-sm text-muted-foreground">{t("wl_subtitle")}</p>
      </div>

      {/* Login Form */}
      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t("email")}
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="garcom@email.com"
            autoComplete="email"
            className="h-14 rounded-xl border-white/[0.06] bg-white/[0.03] text-base focus:border-primary"
            style={{ fontSize: "16px" }}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t("password")}
          </Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="h-14 rounded-xl border-white/[0.06] bg-white/[0.03] text-base focus:border-primary"
            style={{ fontSize: "16px" }}
            required
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className={cn(
            "flex h-14 w-full items-center justify-center gap-2 rounded-xl font-semibold transition-all active:scale-[0.98]",
            "bg-primary text-primary-foreground"
          )}
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : t("login")}
        </button>

        <div className="flex items-center justify-between text-sm">
          <button type="button" onClick={() => navigate("/forgot-password")} className="text-muted-foreground hover:text-foreground">
            {t("forgot_password")}
          </button>
          <button type="button" onClick={() => navigate("/signup")} className="text-primary font-medium">
            {t("create_account")}
          </button>
        </div>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-4 my-8">
        <div className="flex-1 h-px bg-white/[0.08]" />
        <span className="text-xs text-muted-foreground">{t("wl_or")}</span>
        <div className="flex-1 h-px bg-white/[0.08]" />
      </div>

      {/* QR Code Section */}
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm font-medium text-foreground">{t("wl_have_qr")}</p>

        {!showScanner ? (
          <button
            type="button"
            onClick={startScanner}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm font-medium text-foreground active:scale-[0.98] transition-transform"
          >
            <QrCode className="h-5 w-5 text-primary" />
            {t("wl_scan_qr")}
          </button>
        ) : (
          <div className="w-full space-y-3">
            <div
              id="waiter-qr-scanner"
              ref={scannerContainerRef}
              className="mx-auto w-full max-w-[280px] overflow-hidden rounded-xl"
            />
            <button
              type="button"
              onClick={stopScanner}
              className="flex h-10 w-full items-center justify-center rounded-xl bg-white/[0.06] text-sm text-muted-foreground"
            >
              {t("cancel")}
            </button>
          </div>
        )}

        {/* Manual code input */}
        <div className="flex w-full items-center gap-2 mt-2">
          <div className="relative flex-1">
            <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              placeholder={t("wl_type_code")}
              maxLength={12}
              className="h-12 rounded-xl border-white/[0.06] bg-white/[0.03] pl-10 text-base uppercase tracking-widest focus:border-primary"
              style={{ fontSize: "16px" }}
            />
          </div>
          <button
            type="button"
            onClick={handleManualCode}
            disabled={!manualCode.trim()}
            className={cn(
              "h-12 rounded-xl px-5 text-sm font-semibold transition-all active:scale-[0.98]",
              manualCode.trim()
                ? "bg-primary text-primary-foreground"
                : "bg-white/[0.06] text-muted-foreground cursor-not-allowed"
            )}
          >
            {t("wl_go")}
          </button>
        </div>
      </div>
    </div>
  );
}
