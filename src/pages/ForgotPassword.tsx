import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n/use-translation";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) { toast.error(error.message); } else { setSent(true); }
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md border-border bg-card">
          <CardHeader>
            <CardTitle>{t("check_your_email")}</CardTitle>
            <CardDescription>{t("reset_link_sent")} <strong>{email}</strong></CardDescription>
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
        </div>
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-xl">{t("forgot_password")}</CardTitle>
            <CardDescription>{t("enter_new_password")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="email">{t("email")}</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@closeout.com" required /></div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("send_reset_link")}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                <Link to="/login" className="text-primary hover:underline">{t("back_to_login")}</Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
