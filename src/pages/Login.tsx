import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Shield, KeyRound } from "lucide-react";

type LoginStep = "credentials" | "mfa";

export default function Login() {
  const navigate = useNavigate();
  const [step, setStep] = useState<LoginStep>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // Check if MFA is required
    if (data.session) {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const totp = factorsData?.totp;

      if (totp && totp.length > 0) {
        const factor = totp[0];
        setFactorId(factor.id);
        const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
        if (challengeError) {
          toast.error("Failed to initiate MFA challenge");
          setLoading(false);
          return;
        }
        setChallengeId(challengeData.id);
        setStep("mfa");
        setLoading(false);
        return;
      }

      // Check profile status
      const { data: profile } = await supabase.from("profiles").select("status").eq("id", data.session.user.id).single();
      if (profile?.status === "inactive") {
        await supabase.auth.signOut();
        toast.error("Your account has been deactivated. Contact an administrator.");
        setLoading(false);
        return;
      }

      navigate("/");
    }

    setLoading(false);
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || !challengeId) return;
    setLoading(true);

    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code: mfaCode,
    });

    if (error) {
      toast.error("Invalid verification code");
      setMfaCode("");
      setLoading(false);
      return;
    }

    // Check profile status after MFA
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: profile } = await supabase.from("profiles").select("status").eq("id", session.user.id).single();
      if (profile?.status === "inactive") {
        await supabase.auth.signOut();
        toast.error("Your account has been deactivated. Contact an administrator.");
        setLoading(false);
        return;
      }
    }

    navigate("/");
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 dark">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 mb-4">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            CLOSE<span className="text-primary">OUT</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Operations platform for bars, clubs & events</p>
        </div>

        {step === "credentials" && (
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-xl">Sign in</CardTitle>
              <CardDescription>Enter your credentials to access the admin panel</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@closeout.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
                <div className="flex items-center justify-between text-sm">
                  <Link to="/signup" className="text-primary hover:underline">Create account</Link>
                  <Link to="/forgot-password" className="text-muted-foreground hover:text-foreground transition-colors">Forgot password?</Link>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {step === "mfa" && (
          <Card className="border-border bg-card">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <KeyRound className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl">Two-Factor Authentication</CardTitle>
              <CardDescription>Enter the 6-digit code from your authenticator app</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleMfaVerify} className="space-y-6">
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={mfaCode} onChange={(value) => setMfaCode(value)}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button type="submit" className="w-full" disabled={loading || mfaCode.length !== 6}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify
                </Button>
                <button type="button" onClick={() => { setStep("credentials"); setMfaCode(""); }} className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors">
                  ← Back to login
                </button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
