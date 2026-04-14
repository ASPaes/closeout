import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, LogOut } from "lucide-react";

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
    addressNumber.trim().length > 0;

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

    toast.success("Cadastro completo!");
    navigate("/app", { replace: true });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/app/login", { replace: true });
  };

  const inputClass = "h-12 rounded-xl border-border/60 bg-card text-base placeholder:text-muted-foreground focus-visible:ring-primary/50";

  return (
    <div className="dark relative mx-auto flex min-h-[100dvh] max-w-[480px] flex-col bg-background text-foreground overflow-hidden">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/15 blur-[100px]" />
      </div>

      {/* Header with logout */}
      <div className="relative z-10 flex items-center justify-end px-4 pt-4">
        <button
          onClick={handleLogout}
          className="flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm text-muted-foreground active:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col px-6 overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Complete seu cadastro</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Precisamos de algumas informações para continuar
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {/* Nome */}
          <Input
            type="text"
            placeholder="Nome completo"
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

        {/* Action */}
        <div className="mt-auto pb-6 pt-6">
          <Button
            onClick={handleSubmit}
            disabled={loading || !isFormValid}
            className="h-14 w-full rounded-xl bg-gradient-to-r from-primary to-primary-glow text-base font-semibold text-primary-foreground shadow-lg active:scale-[0.98] transition-transform"
            style={{ boxShadow: "0 4px 24px hsl(24 100% 50% / 0.35)" }}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Concluir cadastro"}
          </Button>
        </div>
      </div>
    </div>
  );
}
