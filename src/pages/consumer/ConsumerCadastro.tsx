import { useTranslation } from "@/i18n/use-translation";
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Check, Eye, EyeOff } from "lucide-react";
import { validatePassword, PasswordRequirements } from "@/components/PasswordRequirements";

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function isValidCPF(cpf: string): boolean {
  cpf = onlyDigits(cpf);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  for (let t = 9; t < 11; t++) {
    let d = 0;
    for (let c = 0; c < t; c++) d += parseInt(cpf[c]) * ((t + 1) - c);
    d = ((10 * d) % 11) % 10;
    if (parseInt(cpf[t]) !== d) return false;
  }
  return true;
}

function isValidPhone(phone: string): boolean {
  const digits = onlyDigits(phone);
  return digits.length === 11 && digits[2] === "9";
}

interface CepData {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export default function ConsumerCadastro() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [cpfError, setCpfError] = useState("");
  const [cpfChecked, setCpfChecked] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [cep, setCep] = useState("");
  const [cepError, setCepError] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepAddress, setCepAddress] = useState<CepData | null>(null);
  const [addressNumber, setAddressNumber] = useState("");

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

  // CPF handlers
  const handleCpfChange = (val: string) => {
    const digits = onlyDigits(val).slice(0, 11);
    setCpf(digits);
    setCpfError("");
    setCpfChecked(false);
  };

  const handleCpfBlur = useCallback(async () => {
    if (cpf.length !== 11) return;
    if (!isValidCPF(cpf)) {
      setCpfError("CPF inválido");
      return;
    }
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("cpf", cpf)
      .limit(1)
      .maybeSingle();
    if (existing) {
      setCpfError("Este CPF já está vinculado a outra conta. Entre em contato com o suporte.");
    } else {
      setCpfChecked(true);
    }
  }, [cpf]);

  // Phone handler
  const handlePhoneChange = (val: string) => {
    const digits = onlyDigits(val).slice(0, 11);
    setPhone(digits);
    setPhoneError("");
  };

  const handlePhoneBlur = () => {
    if (phone.length > 0 && !isValidPhone(phone)) {
      setPhoneError("Telefone inválido. Digite DDD + 9 + número");
    }
  };

  // CEP handlers
  const fetchCep = useCallback(async (digits: string) => {
    setCepLoading(true);
    setCepError("");
    setCepAddress(null);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data: CepData = await res.json();
      if (data.erro) {
        setCepError("CEP não encontrado");
      } else {
        setCepAddress(data);
      }
    } catch {
      setCepError("CEP não encontrado");
    } finally {
      setCepLoading(false);
    }
  }, []);

  const handleCepChange = (val: string) => {
    const digits = onlyDigits(val).slice(0, 8);
    setCep(digits);
    setCepError("");
    setCepAddress(null);
    if (digits.length === 8) {
      fetchCep(digits);
    }
  };

  // Step 1 validity
  const isStep1Valid =
    name.trim().length > 0 &&
    cpf.length === 11 &&
    isValidCPF(cpf) &&
    cpfChecked &&
    !cpfError &&
    isValidPhone(phone) &&
    !phoneError &&
    cep.length === 8 &&
    !!cepAddress &&
    !cepError &&
    addressNumber.trim().length > 0;

  const validateStep1 = async () => {
    if (!name.trim()) { toast.error(t("consumer_name_required")); return false; }
    if (cpf.length !== 11 || !isValidCPF(cpf)) {
      setCpfError("CPF inválido");
      return false;
    }
    if (cpfError) return false;
    // Re-check CPF availability
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("cpf", cpf)
      .limit(1)
      .maybeSingle();
    if (existing) {
      setCpfError("Este CPF já está vinculado a outra conta. Entre em contato com o suporte.");
      return false;
    }
    if (!isValidPhone(phone)) {
      setPhoneError("Telefone inválido. Digite DDD + 9 + número");
      return false;
    }
    if (cep.length !== 8 || !cepAddress) {
      setCepError("CEP não encontrado");
      return false;
    }
    if (!addressNumber.trim()) {
      toast.error("Informe o número do endereço");
      return false;
    }
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
        cpf,
        phone,
        postal_code: cep,
        address_number: addressNumber.trim(),
        city: cepAddress?.localidade || "",
        state: cepAddress?.uf || "",
        neighborhood: cepAddress?.bairro || "",
        street: cepAddress?.logradouro || "",
        registration_complete: true,
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

  const inputClass = "h-12 rounded-xl border-border/60 bg-card text-base placeholder:text-muted-foreground focus-visible:ring-primary/50";

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
      <div className="relative z-10 flex flex-1 flex-col px-6 overflow-y-auto">
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
            {/* Nome */}
            <Input
              type="text"
              placeholder={t("full_name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              required
            />

            {/* CPF */}
            <div>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="Seu CPF (apenas números)"
                value={cpf}
                onChange={(e) => handleCpfChange(e.target.value)}
                onBlur={handleCpfBlur}
                maxLength={11}
                className={`${inputClass} ${cpfError ? "border-destructive" : ""}`}
                required
              />
              {cpfError && <p className="mt-1 text-xs text-destructive">{cpfError}</p>}
            </div>

            {/* Telefone */}
            <div>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="Celular com DDD (apenas números)"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                onBlur={handlePhoneBlur}
                maxLength={11}
                className={`${inputClass} ${phoneError ? "border-destructive" : ""}`}
                required
              />
              {phoneError && <p className="mt-1 text-xs text-destructive">{phoneError}</p>}
            </div>

            {/* CEP */}
            <div>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="CEP (apenas números)"
                value={cep}
                onChange={(e) => handleCepChange(e.target.value)}
                maxLength={8}
                className={`${inputClass} ${cepError ? "border-destructive" : ""}`}
                required
              />
              {cepLoading && <p className="mt-1 text-xs text-muted-foreground">Buscando CEP...</p>}
              {cepError && <p className="mt-1 text-xs text-destructive">{cepError}</p>}
              {cepAddress && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {cepAddress.logradouro}, {cepAddress.bairro} - {cepAddress.localidade}/{cepAddress.uf}
                </p>
              )}
            </div>

            {/* Número */}
            <Input
              type="text"
              placeholder="Número"
              value={addressNumber}
              onChange={(e) => setAddressNumber(e.target.value)}
              className={`${inputClass} w-32`}
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
              className={inputClass}
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
                  className={`${inputClass} pr-12 ${
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
              className={inputClass}
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
                <span className="text-xs text-muted-foreground">Celular</span>
                <span className="text-sm font-medium text-foreground">{phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Endereço</span>
                <span className="text-sm font-medium text-foreground text-right max-w-[60%]">
                  {cepAddress ? `${cepAddress.logradouro}, ${addressNumber} - ${cepAddress.bairro}, ${cepAddress.localidade}/${cepAddress.uf}` : ""}
                </span>
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
              disabled={loading || (step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid)}
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
