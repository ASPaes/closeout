import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, LogOut, User } from "lucide-react";
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

export default function ConsumerCompletarCadastro() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);

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
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const isGoogleUser = user?.app_metadata?.provider === "google";

  // Pre-fill from existing profile
  useEffect(() => {
    if (profile?.name) setName(profile.name);
    if (profile?.phone) setPhone(onlyDigits(profile.phone));
    if (profile?.cpf) {
      setCpf(onlyDigits(profile.cpf));
      setCpfChecked(true);
    }
  }, [profile]);

  // Redirect if already complete
  useEffect(() => {
    if (profile?.registration_complete) {
      navigate("/app", { replace: true });
    }
  }, [profile, navigate]);

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
    if (existing && existing.id !== user?.id) {
      setCpfError("Este CPF já está vinculado a outra conta. Entre em contato com o suporte.");
    } else {
      setCpfChecked(true);
    }
  }, [cpf, user?.id]);

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

  const handlePasswordBlur = () => {
    if (!isGoogleUser) return;
    if (password.length > 0 && password.length < 6) {
      setPasswordError("Mínimo 6 caracteres");
    } else if (passwordConfirm.length > 0 && password !== passwordConfirm) {
      setPasswordError("As senhas não coincidem");
    } else {
      setPasswordError("");
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

  const isFormValid =
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
    addressNumber.trim().length > 0 &&
    (!isGoogleUser || (password.length >= 6 && password === passwordConfirm));

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);

    // Re-check CPF
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("cpf", cpf)
      .limit(1)
      .maybeSingle();
    if (existing && existing.id !== user.id) {
      setCpfError("Este CPF já está vinculado a outra conta. Entre em contato com o suporte.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("profiles").update({
      name: name.trim(),
      cpf,
      phone,
      postal_code: cep,
      address_number: addressNumber.trim(),
      city: cepAddress?.localidade || "",
      state: cepAddress?.uf || "",
      neighborhood: cepAddress?.bairro || "",
      street: cepAddress?.logradouro || "",
      registration_complete: true,
    }).eq("id", user.id);

    setLoading(false);

    if (error) {
      toast.error("Erro ao salvar cadastro. Tente novamente.");
      return;
    }

    // Set password for Google users so they can login via email/password in PWA
    if (isGoogleUser && password) {
      const { error: pwError } = await supabase.auth.updateUser({ password });
      if (pwError) {
        toast.error("Cadastro salvo, mas houve erro ao definir a senha. Você pode definir depois em 'Esqueci minha senha'.");
        navigate("/app", { replace: true });
        return;
      }
    }

    toast.success("Cadastro completo!");
    navigate("/app", { replace: true });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/app/login", { replace: true });
  };

  const inputBase =
    "peer h-14 w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 pt-6 pb-2 text-[15px] text-[#f5f0eb] placeholder-transparent outline-none transition-all duration-300 focus:bg-white/[0.07] focus:border-[hsla(24,100%,50%,0.4)] focus:shadow-[0_0_0_3px_hsla(24,100%,50%,0.08),0_0_20px_hsla(24,100%,50%,0.05)] disabled:opacity-50";
  const labelBase =
    "absolute left-4 top-2 text-[11px] uppercase tracking-wider text-muted-foreground/60 transition-all duration-200 pointer-events-none peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-[15px] peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-muted-foreground/50 peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[11px] peer-focus:uppercase peer-focus:tracking-wider peer-focus:text-primary";
  const caret = { caretColor: "hsl(24,100%,50%)" } as const;

  return (
    <AuthBackground>
      <div className="relative z-10 flex h-[100dvh] max-w-[480px] mx-auto flex-col px-6 overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        {/* Header */}
        <div className="flex items-center justify-end pt-4 pb-2">
          <button
            onClick={handleLogout}
            className="flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm text-muted-foreground active:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>

        {/* Avatar */}
        <div className="flex justify-center mb-6">
          {name ? (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-2xl font-bold text-white shadow-[0_0_24px_hsla(24,100%,50%,0.3)]">
              {name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/[0.05] border border-white/[0.08] text-primary/50">
              <User className="h-8 w-8" />
            </div>
          )}
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 style={{ fontFamily: "'Outfit', sans-serif" }} className="text-3xl font-bold text-white tracking-tight">
            {name ? `Quase lá, ${name.split(' ')[0]}!` : "Complete seu cadastro"}
          </h1>
          <p className="mt-2 text-base text-muted-foreground font-light">
            Complete seu cadastro para começar a pedir
          </p>
        </div>

        {/* Form fields */}
        <div className="flex flex-col gap-4 flex-1 overflow-y-auto">
          {/* Nome */}
          <div className="relative">
            <input
              type="text"
              placeholder=" "
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputBase}
              style={caret}
              required
            />
            <label className={labelBase}>Nome completo</label>
          </div>

          {/* CPF */}
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              placeholder=" "
              value={cpf}
              onChange={(e) => handleCpfChange(e.target.value)}
              onBlur={handleCpfBlur}
              maxLength={11}
              className={`${inputBase} ${cpfError ? "border-destructive" : ""}`}
              style={caret}
              required
            />
            <label className={labelBase}>CPF</label>
            {cpfError && <p className="mt-1 text-xs text-destructive">{cpfError}</p>}
          </div>

          {/* Phone */}
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              placeholder=" "
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              onBlur={handlePhoneBlur}
              maxLength={11}
              className={`${inputBase} ${phoneError ? "border-destructive" : ""}`}
              style={caret}
              required
            />
            <label className={labelBase}>Celular com DDD</label>
            {phoneError && <p className="mt-1 text-xs text-destructive">{phoneError}</p>}
          </div>

          {/* CEP */}
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              placeholder=" "
              value={cep}
              onChange={(e) => handleCepChange(e.target.value)}
              maxLength={8}
              className={`${inputBase} ${cepError ? "border-destructive" : ""}`}
              style={caret}
              required
            />
            <label className={labelBase}>CEP</label>
            {cepLoading && <p className="mt-1 text-xs text-muted-foreground">Buscando CEP...</p>}
            {cepError && <p className="mt-1 text-xs text-destructive">{cepError}</p>}
            {cepAddress && (
              <p className="mt-1 text-xs text-muted-foreground">
                {cepAddress.logradouro}, {cepAddress.bairro} - {cepAddress.localidade}/{cepAddress.uf}
              </p>
            )}
          </div>

          {/* Address row: Rua + Número */}
          <div className="flex gap-3">
            <div className="relative flex-[2]">
              <input
                type="text"
                placeholder=" "
                value={cepAddress?.logradouro || ""}
                disabled={!cepAddress}
                className={`${inputBase} disabled:opacity-50`}
                style={caret}
              />
              <label className={labelBase}>Rua</label>
            </div>
            <div className="relative flex-1">
              <input
                type="text"
                placeholder=" "
                value={addressNumber}
                onChange={(e) => setAddressNumber(e.target.value)}
                className={inputBase}
                style={caret}
                required
              />
              <label className={labelBase}>Nº</label>
            </div>
          </div>

          {/* Password section for Google users */}
          {isGoogleUser && (
            <div className="mt-2 pt-4 border-t border-white/[0.06]">
              <p className="mb-3 text-xs text-muted-foreground">
                Defina uma senha para acessar sua conta sem o Google
              </p>
              <div className="flex flex-col gap-4">
                <div className="relative">
                  <input
                    type="password"
                    placeholder=" "
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setPasswordError(""); }}
                    onBlur={handlePasswordBlur}
                    className={`${inputBase} ${passwordError ? "border-destructive" : ""}`}
                    style={caret}
                    required
                  />
                  <label className={labelBase}>Criar senha (mín. 6 caracteres)</label>
                </div>
                <div className="relative">
                  <input
                    type="password"
                    placeholder=" "
                    value={passwordConfirm}
                    onChange={(e) => { setPasswordConfirm(e.target.value); setPasswordError(""); }}
                    onBlur={handlePasswordBlur}
                    className={`${inputBase} ${passwordError ? "border-destructive" : ""}`}
                    style={caret}
                    required
                  />
                  <label className={labelBase}>Confirmar senha</label>
                  {passwordError && <p className="mt-1 text-xs text-destructive">{passwordError}</p>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Button */}
        <div className="mt-auto pb-6 pt-6">
          <button
            onClick={handleSubmit}
            disabled={loading || !isFormValid}
            className="h-14 w-full rounded-xl font-semibold text-base tracking-wide text-white border-0 active:scale-[0.98] transition-transform"
            style={{ background: 'linear-gradient(135deg, hsl(24,100%,50%) 0%, hsl(18,100%,45%) 100%)', boxShadow: '0 4px 24px hsla(24,100%,50%,0.3), inset 0 1px 0 hsla(0,0%,100%,0.15)' }}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "Concluir cadastro"}
          </button>
        </div>
      </div>
    </AuthBackground>
  );
}
