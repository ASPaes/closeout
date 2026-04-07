import { useTranslation } from "@/i18n/use-translation";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Check, Eye, EyeOff } from "lucide-react";
import { maskCPF, maskPhone, unmask } from "@/lib/masks";
import { validatePassword, PasswordRequirements } from "@/components/PasswordRequirements";

function validateCPF(cpf: string): boolean {
  const digits = unmask(cpf);
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let rem = (sum * 10) % 11;
  if (rem === 10) rem = 0;
  if (rem !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  rem = (sum * 10) % 11;
  if (rem === 10) rem = 0;
  return rem === parseInt(digits[10]);
}

export default function ConsumerCadastro() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [cpfError, setCpfError] = useState("");

  // Step 2
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);

  // Step 3
  const [termsAccepted, setTermsAccepted] = useState(false);

  const pwValidation = validatePassword(password);
  const showPwReqs = step === 2;

  const handleCPFChange = (val: string) => {
    const masked = maskCPF(val);
    setCpf(masked);
    setCpfError("");
  };

  const validateStep1 = async () => {
    if (!name.trim()) { toast.error(t("consumer_name_required")); return false; }
    const rawCpf = unmask(cpf);
    if (rawCpf.length !== 11 || !validateCPF(rawCpf)) {
      setCpfError(t("consumer_cpf_invalid"));
      return false;
    }
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("cpf", rawCpf)
      .maybeSingle();
    if (existing) {
      setCpfError(t("consumer_cpf_taken"));
      return false;
    }
    if (unmask(phone).length < 10) { toast.error(t("consumer_phone_invalid")); return false; }
    return true;
  };

  const validateStep2 = () => {
    if (!email.includes("@")) { toast.error(t("consumer_email_invalid")); return false; }
    if (!pwValidation.isValid) { toast.error("A senha não atende todos os requisitos."); return false; }
    if (password !== confirmPassword) { toast.error(t("consumer_passwords_mismatch")); return false; }
    return true;
  };

  const isStep2Valid = pwValidation.isValid && email.includes("@") && password === confirmPassword && confirmPassword.length > 0;

  const handleNext = async () => {
    if (step === 1) {
      setLoading(true);
      const ok = await validateStep1();
      setLoading(false);
      if (ok) setStep(2);
    } else if (step === 2) {
      if (validateStep2()) setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
    else navigate("/app/login");
  };

  const handleSignup = async () => {
    if (!termsAccepted) { toast.error(t("consumer_accept_terms")); return; }
    setLoading(true);
    const rawCpf = unmask(cpf);
    const rawPhone = unmask(phone);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: window.location.origin + "/app",
      },
    });

    if (error) { toast.error(error.message); setLoading(false); return; }

    if (data.user) {
      await supabase.from("profiles").update({
        cpf: rawCpf,
        phone: rawPhone,
      }).eq("id", data.user.id);

      await supabase.from("user_roles").insert({
        user_id: data.user.id,
        role: "consumer",
      });
    }

    setLoading(false);
    toast.success(t("consumer_signup_success"));
    navigate("/app/login");
  };

  const handleOAuth = async (provider: "google" | "apple") => {
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
        <div className="absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/15 blur-[100px]" />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center px-4 pt-4">
        <button
          onClick={handleBack}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted-foreground active:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1" />
      </div>

      {/* Stepper */}
      <div className="relative z-10 flex items-center justify-center gap-2 py-4">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
              s < step
                ? "bg-primary text-primary-foreground"
                : s === step
                ? "bg-primary/20 text-primary ring-2 ring-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {s < step ? <Check className="h-4 w-4" /> : s}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            {step === 1 ? t("consumer_step1_title") : step === 2 ? t("consumer_step2_title") : t("consumer_step3_title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {step === 1 ? t("consumer_step1_desc") : step === 2 ? t("consumer_step2_desc") : t("consumer_step3_desc")}
          </p>
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-3">
            <Input
              type="text"
              placeholder={t("full_name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 rounded-xl border-border/60 bg-card text-base placeholder:text-muted-foreground focus-visible:ring-primary/50"
              required
            />
            <div>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="CPF"
                value={cpf}
                onChange={(e) => handleCPFChange(e.target.value)}
                className={`h-12 rounded-xl border-border/60 bg-card text-base placeholder:text-muted-foreground focus-visible:ring-primary/50 ${cpfError ? "border-destructive" : ""}`}
                required
              />
              {cpfError && <p className="mt-1 text-xs text-destructive">{cpfError}</p>}
            </div>
            <Input
              type="tel"
              inputMode="numeric"
              placeholder={t("consumer_phone_placeholder")}
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              className="h-12 rounded-xl border-border/60 bg-card text-base placeholder:text-muted-foreground focus-visible:ring-primary/50"
              required
            />
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3">
            <Input
              type="email"
              placeholder={t("email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-xl border-border/60 bg-card text-base placeholder:text-muted-foreground focus-visible:ring-primary/50"
              required
            />
            <div>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder={t("password")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPwFocused(true)}
                  onBlur={() => setPwFocused(false)}
                  className={`h-12 rounded-xl border-border/60 bg-card text-base placeholder:text-muted-foreground focus-visible:ring-primary/50 pr-12 ${
                    password.length > 0 ? (pwValidation.isValid ? "border-success" : "border-destructive") : ""
                  }`}
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <PasswordRequirements password={password} show={showPwReqs} />
            </div>
            <Input
              type="password"
              placeholder={t("consumer_confirm_password")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-12 rounded-xl border-border/60 bg-card text-base placeholder:text-muted-foreground focus-visible:ring-primary/50"
              minLength={6}
              required
            />
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">{t("full_name")}</span>
                <span className="text-sm font-medium text-foreground">{name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">CPF</span>
                <span className="text-sm font-medium text-foreground">{cpf}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">{t("consumer_phone_label")}</span>
                <span className="text-sm font-medium text-foreground">{phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">{t("email")}</span>
                <span className="text-sm font-medium text-foreground">{email}</span>
              </div>
            </div>

            <label className="flex items-start gap-3 min-h-[44px] cursor-pointer">
              <Checkbox
                checked={termsAccepted}
                onCheckedChange={(v) => setTermsAccepted(v === true)}
                className="mt-0.5"
              />
              <span className="text-sm text-muted-foreground leading-snug">
                {t("consumer_terms_label")}
              </span>
            </label>
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto pb-6 pt-6 flex flex-col gap-3">
          {step < 3 ? (
            <Button
              onClick={handleNext}
              disabled={loading || (step === 2 && !isStep2Valid)}
              className="h-14 w-full rounded-xl bg-gradient-to-r from-primary to-primary-glow text-base font-semibold text-primary-foreground shadow-lg active:scale-[0.98] transition-transform"
              style={{ boxShadow: "0 4px 24px hsl(24 100% 50% / 0.35)" }}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t("consumer_next")}
            </Button>
          ) : (
            <Button
              onClick={handleSignup}
              disabled={loading || !termsAccepted}
              className="h-14 w-full rounded-xl bg-gradient-to-r from-primary to-primary-glow text-base font-semibold text-primary-foreground shadow-lg active:scale-[0.98] transition-transform"
              style={{ boxShadow: "0 4px 24px hsl(24 100% 50% / 0.35)" }}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t("consumer_create_account")}
            </Button>
          )}

          {step === 1 && (
            <>
              <div className="flex items-center gap-3 my-2">
                <div className="h-px flex-1 bg-border/40" />
                <span className="text-xs text-muted-foreground">{t("consumer_or")}</span>
                <div className="h-px flex-1 bg-border/40" />
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full rounded-xl border-border/40 bg-white/[0.07] text-sm font-medium text-foreground active:scale-[0.98] transition-transform"
                onClick={() => handleOAuth("google")}
              >
                {t("consumer_signup_google")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full rounded-xl border-border/40 bg-white/[0.07] text-sm font-medium text-foreground active:scale-[0.98] transition-transform"
                onClick={() => handleOAuth("apple")}
              >
                {t("consumer_signup_apple")}
              </Button>
            </>
          )}
        </div>

        <button
          onClick={() => navigate("/app/login")}
          className="mb-6 min-h-[44px] text-sm font-medium text-primary active:text-primary/70 transition-colors text-center"
        >
          {t("consumer_has_account")}
        </button>
      </div>
    </div>
  );
}
