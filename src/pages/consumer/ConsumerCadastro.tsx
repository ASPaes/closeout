import { useTranslation } from "@/i18n/use-translation";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

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
    <div className="dark mx-auto flex min-h-[100dvh] max-w-[480px] flex-col items-center justify-center bg-background px-6 text-foreground">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
          CO
        </div>
        <h1 className="text-2xl font-bold">{t("create_account")}</h1>
        <p className="text-sm text-muted-foreground">{t("consumer_signup_subtitle")}</p>
      </div>
      <form onSubmit={handleSignup} className="flex w-full flex-col gap-4">
        <Input
          type="text"
          placeholder={t("full_name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-12 text-base"
          required
        />
        <Input
          type="email"
          placeholder={t("email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 text-base"
          required
        />
        <Input
          type="password"
          placeholder={t("password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-12 text-base"
          minLength={6}
          required
        />
        <Button type="submit" className="h-12 w-full rounded-xl text-base" disabled={loading}>
          {loading ? "..." : t("create_account")}
        </Button>
      </form>
      <button
        onClick={() => navigate("/app/login")}
        className="mt-6 min-h-[44px] text-sm text-primary active:text-primary/80"
      >
        {t("consumer_has_account")}
      </button>
    </div>
  );
}
