import { useTranslation } from "@/i18n/use-translation";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";
import logoMark from "@/assets/brand/logo-mark.png";
import AuthBackground from "@/components/consumer/AuthBackground";

export default function ConsumerLogin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const isIOSPWA =
    typeof navigator !== "undefined" &&
    /iPhone|iPad|iPod/.test(navigator.userAgent) &&
    (window.navigator as any).standalone === true;

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

  const renderSplash = () => (
    <div className="relative flex flex-1 flex-col items-center justify-center px-6">
      <div
        className="flex flex-col items-center"
        style={{ animation: "splashIn 1.2s cubic-bezier(0.16,1,0.3,1) forwards", opacity: 0 }}
      >
        <div className="relative mb-5">
          <div
            className="absolute"
            style={{
              inset: "-30%",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, hsla(24,100%,50%,0.4) 0%, transparent 70%)",
              animation: "pulseGlow 3s ease-in-out infinite",
            }}
          />
          <img
            src={logoMark}
            alt="Close Out"
            className="relative h-[100px] w-[100px] rounded-2xl object-cover"
            style={{ filter: "drop-shadow(0 0 30px hsla(24,100%,50%,0.4))" }}
          />
        </div>
        <h1
          className="text-[38px] font-extrabold tracking-[3px] uppercase mb-2"
          style={{ fontFamily: "'Outfit', sans-serif" }}
        >
          CLOSE OUT
        </h1>
        <p className="text-[13px] tracking-[4px] uppercase text-muted-foreground/50 mb-[60px]">
          {t("consumer_login_tagline")}
        </p>
      </div>

      <div
        className="flex flex-col items-center gap-4 w-full max-w-[340px]"
        style={{ animation: "fadeUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.6s forwards", opacity: 0 }}
      >
        <button
          type="button"
          onClick={() => setShowSplash(false)}
          className="h-14 w-full rounded-xl font-semibold text-base tracking-wide text-white"
          style={{
            background:
              "linear-gradient(135deg, hsl(24,100%,50%) 0%, hsl(18,100%,45%) 100%)",
            boxShadow:
              "0 4px 24px hsla(24,100%,50%,0.3), inset 0 1px 0 hsla(0,0%,100%,0.15)",
          }}
        >
          Entrar na minha conta
        </button>
        <button
          type="button"
          onClick={() => navigate("/app/cadastro")}
          className="h-14 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm font-medium text-[15px] text-foreground"
        >
          Criar minha conta
        </button>
      </div>

      <div
        className="absolute bottom-6 text-[11px] tracking-[5px] uppercase text-muted-foreground/30"
        style={{ animation: "fadeUp 0.8s cubic-bezier(0.16,1,0.3,1) 1s forwards", opacity: 0 }}
      >
        MORE VIBES, LESS LINES
      </div>
    </div>
  );

  const renderLogin = () => (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="mb-10 flex flex-col items-center gap-3">
        <img
          src={logoMark}
          alt="Close Out"
          className="h-[72px] w-[72px] rounded-2xl object-cover"
          style={{ boxShadow: "0 0 40px hsla(24,100%,50%,0.35)" }}
        />
        <h1
          className="text-[26px] font-bold tracking-[2px]"
          style={{ fontFamily: "'Outfit', sans-serif" }}
        >
          CLOSE OUT
        </h1>
        <p className="text-xs text-muted-foreground/50 tracking-wide">
          {t("consumer_login_tagline")}
        </p>
      </div>

      <form onSubmit={handleLogin} className="flex w-full flex-col gap-4">
        <div className="relative">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder=" "
            className="peer h-14 w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 pt-6 pb-2 text-[15px] text-[#f5f0eb] placeholder-transparent outline-none transition-all duration-300 focus:bg-white/[0.07] focus:border-[hsla(24,100%,50%,0.4)] focus:shadow-[0_0_0_3px_hsla(24,100%,50%,0.08),0_0_20px_hsla(24,100%,50%,0.05)]"
            style={{ caretColor: "hsl(24,100%,50%)" }}
          />
          <label className="absolute left-4 top-2 text-[11px] uppercase tracking-wider text-muted-foreground/60 transition-all duration-200 pointer-events-none peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-[15px] peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-muted-foreground/50 peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[11px] peer-focus:uppercase peer-focus:tracking-wider peer-focus:text-primary">
            Email
          </label>
        </div>

        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder=" "
            className="peer h-14 w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 pt-6 pb-2 pr-12 text-[15px] text-[#f5f0eb] placeholder-transparent outline-none transition-all duration-300 focus:bg-white/[0.07] focus:border-[hsla(24,100%,50%,0.4)] focus:shadow-[0_0_0_3px_hsla(24,100%,50%,0.08),0_0_20px_hsla(24,100%,50%,0.05)]"
            style={{ caretColor: "hsl(24,100%,50%)" }}
          />
          <label className="absolute left-4 top-2 text-[11px] uppercase tracking-wider text-muted-foreground/60 transition-all duration-200 pointer-events-none peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-[15px] peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-muted-foreground/50 peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[11px] peer-focus:uppercase peer-focus:tracking-wider peer-focus:text-primary">
            Senha
          </label>
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>

        <div className="text-right">
          <button
            type="button"
            onClick={() => navigate("/forgot-password")}
            className="text-[13px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            {t("forgot_password")}
          </button>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="mt-1 h-14 w-full rounded-xl font-semibold text-base tracking-wide text-white border-0"
          style={{
            background:
              "linear-gradient(135deg, hsl(24,100%,50%) 0%, hsl(18,100%,45%) 100%)",
            boxShadow:
              "0 4px 24px hsla(24,100%,50%,0.3), inset 0 1px 0 hsla(0,0%,100%,0.15)",
          }}
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t("login")}
        </Button>
      </form>

      {!isIOSPWA && (
        <>
          <div className="my-6 flex w-full items-center gap-3">
            <div className="h-px flex-1 bg-border/40" />
            <span className="text-xs text-muted-foreground">{t("consumer_or")}</span>
            <div className="h-px flex-1 bg-border/40" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-14 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm text-sm font-medium text-foreground"
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
        </>
      )}

      <button
        type="button"
        onClick={() => navigate("/app/cadastro")}
        className="mt-8 text-sm font-medium text-primary"
      >
        {t("consumer_no_account")}
      </button>
    </div>
  );

  return (
    <AuthBackground>
      <div className="dark relative mx-auto flex h-[100dvh] max-w-[480px] flex-col text-foreground overflow-hidden">
        {showSplash ? renderSplash() : renderLogin()}
      </div>
    </AuthBackground>
  );
}
