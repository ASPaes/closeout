import { useTranslation } from "@/i18n/use-translation";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
      toast.error(error.message);
    } else {
      navigate("/app");
    }
  };

  return (
    <div className="dark relative mx-auto flex min-h-[100dvh] max-w-[480px] flex-col bg-background text-foreground overflow-hidden">
      {/* Background glow effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/20 blur-[100px]" />
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-primary/5 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6">
        {/* Brand */}
        <div className="mb-10 flex flex-col items-center gap-3">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-glow shadow-lg"
            style={{ boxShadow: "0 0 40px hsl(24 100% 50% / 0.4)" }}
          >
            <span className="text-xl font-bold text-primary-foreground tracking-tight">CO</span>
          </div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ fontFamily: "'Mustica Pro', sans-serif" }}
          >
            CLOSE OUT
          </h1>
          <p className="text-sm text-muted-foreground">{t("consumer_login_subtitle")}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="flex w-full flex-col gap-3">
          <div className="relative">
            <Input
              type="email"
              placeholder={t("email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-xl border-border/60 bg-card text-base placeholder:text-muted-foreground focus-visible:ring-primary/50"
              required
            />
          </div>
          <div className="relative">
            <Input
              type="password"
              placeholder={t("password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-xl border-border/60 bg-card text-base placeholder:text-muted-foreground focus-visible:ring-primary/50"
              required
            />
          </div>
          <Button
            type="submit"
            className="mt-2 h-12 w-full rounded-xl bg-gradient-to-r from-primary to-primary-glow text-base font-semibold text-primary-foreground shadow-lg active:scale-[0.98] transition-transform"
            style={{ boxShadow: "0 4px 24px hsl(24 100% 50% / 0.35)" }}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t("login")}
          </Button>
        </form>

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

      {/* Bottom subtle branding */}
      <div className="relative z-10 pb-8 text-center">
        <p className="text-[10px] tracking-widest text-muted-foreground/40 uppercase">
          More vibes, less lines
        </p>
      </div>
    </div>
  );
}
