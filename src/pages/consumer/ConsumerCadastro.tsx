import { useTranslation } from "@/i18n/use-translation";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";

export default function ConsumerCadastro() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo: window.location.origin + "/app" },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("consumer_signup_success"));
      navigate("/app/login");
    }
  };

  return (
    <div className="dark relative mx-auto flex min-h-[100dvh] max-w-[480px] flex-col bg-background text-foreground overflow-hidden">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/15 blur-[100px]" />
      </div>

      {/* Back button */}
      <div className="relative z-10 px-4 pt-4">
        <button
          onClick={() => navigate("/app/login")}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted-foreground active:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6">
        <div className="mb-8 flex flex-col items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{t("create_account")}</h1>
          <p className="text-sm text-muted-foreground">{t("consumer_signup_subtitle")}</p>
        </div>

        <form onSubmit={handleSignup} className="flex w-full flex-col gap-3">
          <Input
            type="text"
            placeholder={t("full_name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-12 rounded-xl border-border/60 bg-card text-base placeholder:text-muted-foreground focus-visible:ring-primary/50"
            required
          />
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
            minLength={6}
            required
          />
          <Button
            type="submit"
            className="mt-2 h-12 w-full rounded-xl bg-gradient-to-r from-primary to-primary-glow text-base font-semibold text-primary-foreground shadow-lg active:scale-[0.98] transition-transform"
            style={{ boxShadow: "0 4px 24px hsl(24 100% 50% / 0.35)" }}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t("create_account")}
          </Button>
        </form>

        <button
          onClick={() => navigate("/app/login")}
          className="mt-6 min-h-[44px] text-sm font-medium text-primary active:text-primary/70 transition-colors"
        >
          {t("consumer_has_account")}
        </button>
      </div>
    </div>
  );
}
