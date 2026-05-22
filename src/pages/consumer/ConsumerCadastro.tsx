import { useTranslation } from "@/i18n/use-translation";
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { validatePassword, PasswordRequirements } from "@/components/PasswordRequirements";
import AuthBackground from "@/components/consumer/AuthBackground";

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

const inputBase =
  "peer h-14 w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 pt-6 pb-2 text-[15px] text-[#f5f0eb] placeholder-transparent outline-none transition-all duration-300 focus:bg-white/[0.07] focus:border-[hsla(24,100%,50%,0.4)] focus:shadow-[0_0_0_3px_hsla(24,100%,50%,0.08),0_0_20px_hsla(24,100%,50%,0.05)] disabled:opacity-50";
const labelBase =
  "absolute left-4 top-2 text-[11px] uppercase tracking-wider text-muted-foreground/60 transition-all duration-200 pointer-events-none peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-[15px] peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-muted-foreground/50 peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[11px] peer-focus:uppercase peer-focus:tracking-wider peer-focus:text-primary";
const caret = { caretColor: "hsl(24,100%,50%)" } as const;

export default function ConsumerCadastro() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Personal
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [cpfError, setCpfError] = useState("");
  const [cpfChecked, setCpfChecked] = useState(false);
  const [cpfTaken, setCpfTaken] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");

  // Address
  const [cep, setCep] = useState("");
  const [cepError, setCepError] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepAddress, setCepAddress] = useState<CepData | null>(null);
  const [addressNumber, setAddressNumber] = useState("");

  // Access
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const isIOSPWA =
    typeof navigator !== "undefined" &&
    /iPhone|iPad|iPod/.test(navigator.userAgent) &&
    (window.navigator as any).standalone === true;

  const pwValidation = validatePassword(password);
  const showPwReqs = step === 3;

  // CPF handlers
  const handleCpfChange = (val: string) => {
    const digits = onlyDigits(val).slice(0, 11);
    setCpf(digits);
    setCpfError("");
    setCpfChecked(false);
    setCpfTaken(false);
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
      setCpfTaken(true);
      setCpfError("Já existe uma conta com este CPF. Faça login ou use a opção 'Esqueci minha senha'.");
    } else {
      setCpfTaken(false);
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

  // Validity
  const isStep1Valid =
    name.trim().length > 0 &&
    cpf.length === 11 &&
    isValidCPF(cpf) &&
    cpfChecked &&
    !cpfTaken &&
    !cpfError &&
    isValidPhone(phone) &&
    !phoneError;

  const isStep2Valid =
    cep.length === 8 && !!cepAddress && !cepError && addressNumber.trim().length > 0;

  const isStep3Valid =
    email.includes("@") &&
    pwValidation.isValid &&
    password === confirmPassword &&
    confirmPassword.length > 0 &&
    termsAccepted;

  const validateStep1 = async () => {
    if (!name.trim()) { toast.error(t("consumer_name_required")); return false; }
    if (cpf.length !== 11 || !isValidCPF(cpf)) {
      setCpfError("CPF inválido");
      return false;
    }
    if (cpfError) return false;
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("cpf", cpf)
      .limit(1)
      .maybeSingle();
    if (existing) {
      setCpfTaken(true);
      setCpfError("Já existe uma conta com este CPF. Faça login ou use a opção 'Esqueci minha senha'.");
      return false;
    }
    if (!isValidPhone(phone)) {
      setPhoneError("Telefone inválido. Digite DDD + 9 + número");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
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

  const validateStep3 = () => {
    if (!email.includes("@")) { toast.error(t("consumer_email_invalid")); return false; }
    if (!pwValidation.isValid) { toast.error("A senha não atende todos os requisitos."); return false; }
    if (password !== confirmPassword) { toast.error(t("consumer_passwords_mismatch")); return false; }
    return true;
  };

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
    if (!validateStep3()) return;
    setLoading(true);

    const { data: cpfCheck } = await supabase
      .from("profiles")
      .select("id")
      .eq("cpf", cpf)
      .limit(1)
      .maybeSingle();
    if (cpfCheck) {
      setCpfTaken(true);
      setCpfError("Já existe uma conta com este CPF. Faça login ou use a opção 'Esqueci minha senha'.");
      toast.error("Já existe uma conta com este CPF. Faça login ou use a opção 'Esqueci minha senha'.");
      setLoading(false);
      setStep(1);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          cpf,
          phone,
          postal_code: cep,
          address_number: addressNumber.trim(),
          city: cepAddress?.localidade || "",
          state: cepAddress?.uf || "",
          neighborhood: cepAddress?.bairro || "",
          street: cepAddress?.logradouro || "",
          signup_source: "consumer",
        },
        emailRedirectTo: window.location.origin + "/app/login",
      },
    });

    if (error) {
      const msg = error.message || "";
      if (msg.includes("CPF_ALREADY_REGISTERED") || msg.includes("Database error")) {
        toast.error("Já existe uma conta com este CPF. Faça login ou use 'Esqueci minha senha'.");
        setCpfTaken(true);
        setCpfError("CPF já cadastrado em outra conta");
        setStep(1);
      } else if (msg.includes("already registered") || msg.includes("already been registered")) {
        toast.error("Este e-mail já está cadastrado. Faça login ou use 'Esqueci minha senha'.");
        setStep(3);
      } else {
        toast.error(msg);
      }
      setLoading(false);
      return;
    }

    setLoading(false);
    toast.success(t("consumer_signup_success"));
    navigate("/app/login");
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + "/app/login" },
    });
    if (error) toast.error(error.message);
  };

  const stepTitle = step === 1 ? "Dados Pessoais" : step === 2 ? "Endereço" : "Acesso";
  const stepDesc =
    step === 1
      ? "Precisamos de algumas informações básicas para sua segurança"
      : step === 2
      ? "Informe seu CEP para preenchermos automaticamente"
      : "Crie suas credenciais de login";

  return (
    <AuthBackground>
      <div className="dark relative mx-auto flex h-full max-w-[430px] flex-col text-foreground" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {/* Header */}
        <div className="flex items-center px-4 pt-1">
          <button
            onClick={handleBack}
            className="h-10 w-10 rounded-full border border-white/[0.06] bg-white/[0.03] flex items-center justify-center text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 px-6 py-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 rounded-full transition-all duration-[400ms] ${
                s === step
                  ? "h-1.5 bg-primary shadow-[0_0_12px_hsla(24,100%,50%,0.4)]"
                  : s < step
                  ? "h-1 bg-primary/30"
                  : "h-1 bg-border/30"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col px-6 overflow-y-auto">
          <div className="mb-8">
            <h1
              className="text-[28px] font-bold leading-tight mb-1.5"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              {stepTitle}
            </h1>
            <p className="text-sm text-muted-foreground/50">{stepDesc}</p>
          </div>

          {step === 1 && (
            <div className="flex flex-col gap-4">
              {/* Nome */}
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder=" "
                  className={inputBase}
                  style={caret}
                />
                <label className={labelBase}>{t("full_name")}</label>
              </div>

              {/* CPF */}
              <div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={cpf}
                    onChange={(e) => handleCpfChange(e.target.value)}
                    onBlur={handleCpfBlur}
                    maxLength={11}
                    required
                    placeholder=" "
                    className={`${inputBase} ${cpfError ? "border-red-500/60" : ""}`}
                    style={caret}
                  />
                  <label className={labelBase}>CPF (apenas números)</label>
                </div>
                {cpfError && <p className="mt-1 text-xs text-red-500">{cpfError}</p>}
              </div>

              {/* Telefone */}
              <div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    onBlur={handlePhoneBlur}
                    maxLength={11}
                    required
                    placeholder=" "
                    className={`${inputBase} ${phoneError ? "border-red-500/60" : ""}`}
                    style={caret}
                  />
                  <label className={labelBase}>Celular com DDD</label>
                </div>
                {phoneError && <p className="mt-1 text-xs text-red-500">{phoneError}</p>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              {/* CEP */}
              <div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={cep}
                    onChange={(e) => handleCepChange(e.target.value)}
                    maxLength={8}
                    required
                    placeholder=" "
                    className={`${inputBase} ${cepError ? "border-red-500/60" : ""}`}
                    style={caret}
                  />
                  <label className={labelBase}>CEP</label>
                </div>
                {cepLoading && <p className="mt-1 text-xs text-muted-foreground">Buscando CEP...</p>}
                {cepError && <p className="mt-1 text-xs text-red-500">{cepError}</p>}
              </div>

              {/* Rua */}
              <div className="relative">
                <input
                  type="text"
                  value={cepAddress?.logradouro || ""}
                  onChange={() => {}}
                  disabled={!cepAddress}
                  placeholder=" "
                  className={`${inputBase} ${!cepAddress ? "opacity-50" : ""}`}
                  style={caret}
                />
                <label className={labelBase}>Rua</label>
              </div>

              {/* Bairro + Nº */}
              <div className="flex gap-3">
                <div className="relative flex-[2]">
                  <input
                    type="text"
                    value={cepAddress?.bairro || ""}
                    onChange={() => {}}
                    disabled={!cepAddress}
                    placeholder=" "
                    className={`${inputBase} ${!cepAddress ? "opacity-50" : ""}`}
                    style={caret}
                  />
                  <label className={labelBase}>Bairro</label>
                </div>
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={addressNumber}
                    onChange={(e) => setAddressNumber(e.target.value)}
                    required
                    placeholder=" "
                    className={inputBase}
                    style={caret}
                  />
                  <label className={labelBase}>Nº</label>
                </div>
              </div>

              {/* Cidade/UF */}
              <div className="relative">
                <input
                  type="text"
                  value={cepAddress ? `${cepAddress.localidade}/${cepAddress.uf}` : ""}
                  onChange={() => {}}
                  disabled
                  placeholder=" "
                  className={`${inputBase} opacity-50`}
                  style={caret}
                />
                <label className={labelBase}>Cidade / UF</label>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4">
              {/* Email */}
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder=" "
                  className={inputBase}
                  style={caret}
                />
                <label className={labelBase}>Email</label>
              </div>

              {/* Senha */}
              <div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setPwFocused(true)}
                    onBlur={() => setPwFocused(false)}
                    minLength={6}
                    required
                    placeholder=" "
                    className={`${inputBase} pr-12 ${
                      password.length > 0 && !pwValidation.isValid ? "border-red-500/60" : ""
                    }`}
                    style={caret}
                  />
                  <label className={labelBase}>Senha</label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <PasswordRequirements password={password} show={showPwReqs} />
              </div>

              {/* Confirmar senha */}
              <div className="relative">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  required
                  placeholder=" "
                  className={inputBase}
                  style={caret}
                />
                <label className={labelBase}>Confirmar senha</label>
              </div>

              {/* Termos */}
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
                className="h-14 w-full rounded-xl font-semibold text-base tracking-wide text-white border-0"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(24,100%,50%) 0%, hsl(18,100%,45%) 100%)",
                  boxShadow:
                    "0 4px 24px hsla(24,100%,50%,0.3), inset 0 1px 0 hsla(0,0%,100%,0.15)",
                }}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t("consumer_next")}
              </Button>
            ) : (
              <Button
                onClick={handleSignup}
                disabled={loading || !isStep3Valid}
                className="h-14 w-full rounded-xl font-semibold text-base tracking-wide text-white border-0"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(24,100%,50%) 0%, hsl(18,100%,45%) 100%)",
                  boxShadow:
                    "0 4px 24px hsla(24,100%,50%,0.3), inset 0 1px 0 hsla(0,0%,100%,0.15)",
                }}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Criar minha conta"}
              </Button>
            )}

            {step === 1 && !isIOSPWA && (
              <>
                <div className="flex items-center gap-3 my-2">
                  <div className="h-px flex-1 bg-border/40" />
                  <span className="text-xs text-muted-foreground">ou cadastre com</span>
                  <div className="h-px flex-1 bg-border/40" />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-[50px] w-full rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm font-medium text-sm text-foreground"
                  onClick={() => handleOAuth("google")}
                >
                  {t("consumer_signup_google")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-[50px] w-full rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm font-medium text-sm text-foreground"
                  onClick={() => handleOAuth("apple")}
                >
                  {t("consumer_signup_apple")}
                </Button>
              </>
            )}
          </div>

          <button
            onClick={() => navigate("/app/login")}
            className="mb-6 min-h-[44px] text-sm font-medium text-primary text-center"
          >
            {t("consumer_has_account")}
          </button>
        </div>
      </div>
    </AuthBackground>
  );
}