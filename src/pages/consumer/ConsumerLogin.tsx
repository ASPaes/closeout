import { useTranslation } from "@/i18n/use-translation";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import logoMark from "@/assets/brand/logo-mark.png";

export default function ConsumerLogin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Email ou senha incorretos");
      return;
    }
    // Consumer role is auto-assigned by useAuth via ensure_consumer_role()
    navigate("/app");
  };

  const handleOAuth = async (provider: "google") => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + "/app" },
    });
    if (error) toast.error(error.message);
  };

  return (
    <div className="dark relative mx-auto flex min-h-[100dvh] max-w-[480px] flex-col bg-background text-foreground overflow-hidden">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/20 blur-[100px]" />
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-primary/5 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6">
        {/* Brand */}
        <div className="mb-10 flex flex-col items-center gap-3">
          <img
            src={logoMark}
            alt="Close Out"
            className="h-20 w-20 rounded-2xl object-cover shadow-lg"
            style={{ boxShadow: "0 0 40px hsl(24 100% 50% / 0.4)" }}
          />
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ fontFamily: "'Mustica Pro', sans-serif" }}
          >
            CLOSE OUT
          </h1>
          <p className="text-sm text-muted-foreground text-center">
            {t("consumer_login_tagline")}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="flex w-full flex-col gap-3">
          <Input
            type="email"
            placeholder={t("email")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-xl border-border/60 bg-card text-base placeholder:text-muted-foreground focus-visible:ring-primary/50"
            required
          />
          <Input
            type="password"
            placeholder={t("password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-xl border-border/60 bg-card text-base placeholder:text-muted-foreground focus-visible:ring-primary/50"
            required
          />
          <Button
            type="submit"
            className="mt-1 h-14 w-full rounded-xl bg-gradient-to-r from-primary to-primary-glow text-base font-semibold text-primary-foreground shadow-lg active:scale-[0.98] transition-transform"
            style={{ boxShadow: "0 4px 24px hsl(24 100% 50% / 0.35)" }}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t("login")}
          </Button>
        </form>

        {/* Divider */}
        <div className="my-6 flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-border/40" />
          <span className="text-xs text-muted-foreground">{t("consumer_or")}</span>
          <div className="h-px flex-1 bg-border/40" />
        </div>

        {/* Social OAuth */}
        <div className="flex w-full flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full rounded-xl border-border/40 bg-white/[0.07] text-sm font-medium text-foreground active:scale-[0.98] transition-transform"
            onClick={() => handleOAuth("google")}
          >
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {t("consumer_continue_google")}
          </Button>
        </div>

        {/* Links */}
        <div className="mt-8 flex flex-col items-center gap-4">
          <button
            onClick={() => navigate("/app/cadastro")}
            className="min-h-[44px] text-sm font-medium text-primary active:text-primary/70 transition-colors"
          >
            {t("consumer_no_account")}
          </button>
          <button
            onClick={() => navigate("/forgot-password")}
            className="min-h-[44px] text-xs text-muted-foreground active:text-foreground transition-colors"
          >
            {t("forgot_password")}
          </button>
        </div>
      </div>

      {/* Bottom branding */}
      <div className="relative z-10 pb-8 text-center">
        <p className="text-[10px] tracking-widest text-muted-foreground/40 uppercase">
          More vibes, less lines
        </p>
      </div>
    </div>
  );
}
