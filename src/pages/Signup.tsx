import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getPtBrErrorMessage } from "@/lib/error-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n/use-translation";

export default function Signup() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin, data: { name: fullName } } });
    if (error) { toast.error(getPtBrErrorMessage(error)); } else { setSent(true); toast.success(t("email_confirm_check")); }
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md border-border bg-card">
          <CardHeader>
            <CardTitle>{t("check_your_email")}</CardTitle>
            <CardDescription>{t("confirmation_sent")} <strong>{email}</strong></CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/login"><Button variant="outline" className="w-full">{t("back_to_login")}</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">CLOSE<span className="text-primary">OUT</span></h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("create_account")}</p>
        </div>
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-xl">{t("sign_up")}</CardTitle>
            <CardDescription>{t("enter_details")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="fullName">{t("full_name")}</Label><Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" required /></div>
              <div className="space-y-2"><Label htmlFor="email">{t("email")}</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></div>
              <div className="space-y-2"><Label htmlFor="password">{t("password")}</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("min_characters")} minLength={6} required /></div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("create_account")}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                {t("already_have_account")} <Link to="/login" className="text-primary hover:underline">{t("sign_in_link")}</Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
