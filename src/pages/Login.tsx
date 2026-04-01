import { useState, useCallback, useMemo } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getPtBrErrorMessage } from "@/lib/error-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, KeyRound } from "lucide-react";
import { useTranslation } from "@/i18n/use-translation";
import logoFull from "@/assets/brand/logo-full-2.png";

type LoginStep = "credentials" | "mfa";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const { t } = useTranslation();
  const [step, setStep] = useState<LoginStep>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { toast.error(getPtBrErrorMessage(error)); setLoading(false); return; }
    if (data.session) {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const totp = factorsData?.totp;
      if (totp && totp.length > 0) {
        const factor = totp[0];
        setFactorId(factor.id);
        const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
        if (challengeError) { toast.error(t("mfa_failed")); setLoading(false); return; }
        setChallengeId(challengeData.id);
        setStep("mfa");
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("status").eq("id", data.session.user.id).single();
      if (profile?.status === "inactive") { await supabase.auth.signOut(); toast.error(t("account_deactivated")); setLoading(false); return; }
      navigate(redirectTo || "/");
    }
    setLoading(false);
  }, [email, password, navigate, redirectTo, t]);

  const handleMfaVerify = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || !challengeId) return;
    setLoading(true);
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code: mfaCode });
    if (error) { toast.error(t("invalid_verification_code")); setMfaCode(""); setLoading(false); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: profile } = await supabase.from("profiles").select("status").eq("id", session.user.id).single();
      if (profile?.status === "inactive") { await supabase.auth.signOut(); toast.error(t("account_deactivated")); setLoading(false); return; }
    }
    navigate(redirectTo || "/");
    setLoading(false);
  }, [factorId, challengeId, mfaCode, navigate, redirectTo, t]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 relative overflow-hidden" style={{ backgroundColor: '#000' }}>
      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="text-center animate-[fade-in_0.6s_ease-out,scale-in_0.6s_ease-out]">
          <img
            src={logoFull}
            alt="Close Out"
            className="mx-auto h-44 w-auto mb-4"
          />
          <p className="text-sm text-muted-foreground italic tracking-wide">
            More vibes, less lines.
          </p>
        </div>

        {step === "credentials" && (
          <Card className="border-border/60 bg-card/80 backdrop-blur-sm animate-fade-in">
            <CardHeader>
              <CardTitle className="text-xl">{t("sign_in")}</CardTitle>
              <CardDescription>{t("credentials_subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@closeout.com" required className="bg-secondary/50 border-border/60" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t("password")}</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className="bg-secondary/50 border-border/60" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full h-11 text-base font-semibold glow-hover transition-all" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("sign_in")}
                </Button>
                <div className="flex items-center justify-between text-sm">
                  <Link to="/signup" className="text-primary hover:text-primary-glow hover:underline transition-colors">{t("create_account")}</Link>
                  <Link to="/forgot-password" className="text-muted-foreground hover:text-foreground transition-colors">{t("forgot_password")}</Link>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {step === "mfa" && (
          <Card className="border-border/60 bg-card/80 backdrop-blur-sm animate-fade-in">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <KeyRound className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl">{t("two_factor_auth")}</CardTitle>
              <CardDescription>{t("mfa_subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleMfaVerify} className="space-y-6">
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={mfaCode} onChange={(value) => setMfaCode(value)}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                      <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button type="submit" className="w-full h-11 text-base font-semibold glow-hover transition-all" disabled={loading || mfaCode.length !== 6}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("verify")}
                </Button>
                <button type="button" onClick={() => { setStep("credentials"); setMfaCode(""); }} className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {t("back_to_login_arrow")}
                </button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
