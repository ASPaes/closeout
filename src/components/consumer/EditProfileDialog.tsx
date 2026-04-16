import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  Camera,
  Lock,
  Mail,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { maskCPF, maskPhone, unmask } from "@/lib/masks";

type Profile = {
  id?: string;
  name?: string | null;
  phone?: string | null;
  cpf?: string | null;
  avatar_url?: string | null;
  username?: string | null;
  postal_code?: string | null;
  street?: string | null;
  address_number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  email: string;
  profile: Profile | null;
  initials: string;
  avatarUrl: string | null;
  onAvatarUpdated: (url: string) => void;
  onSaved: () => void;
};

interface CepData {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

function isValidCPF(cpf: string): boolean {
  cpf = cpf.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  for (let t = 9; t < 11; t++) {
    let d = 0;
    for (let c = 0; c < t; c++) d += parseInt(cpf[c]) * ((t + 1) - c);
    d = ((10 * d) % 11) % 10;
    if (parseInt(cpf[t]) !== d) return false;
  }
  return true;
}

const inputClass =
  "h-12 rounded-xl border-white/[0.08] bg-white/[0.04] text-base";
const sectionLabel =
  "text-xs text-muted-foreground uppercase tracking-wider mb-2 font-semibold";

export function EditProfileDialog({
  open,
  onOpenChange,
  userId,
  email,
  profile,
  initials,
  avatarUrl,
  onAvatarUpdated,
  onSaved,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Personal data
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [phone, setPhone] = useState("");

  // Address
  const [cep, setCep] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");
  const [street, setStreet] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  // CPF change request
  const [cpfRequestExpanded, setCpfRequestExpanded] = useState(false);
  const [hasPendingCpfRequest, setHasPendingCpfRequest] = useState(false);
  const [newCpf, setNewCpf] = useState("");
  const [newCpfError, setNewCpfError] = useState("");
  const [justification, setJustification] = useState("");
  const [submittingCpfRequest, setSubmittingCpfRequest] = useState(false);

  // Init form when modal opens
  useEffect(() => {
    if (!open) return;
    setName(profile?.name || "");
    setUsername(profile?.username || "");
    setUsernameError("");
    setPhone(profile?.phone ? maskPhone(profile.phone) : "");
    setCep(profile?.postal_code || "");
    setCepError("");
    setStreet(profile?.street || "");
    setAddressNumber(profile?.address_number || "");
    setNeighborhood(profile?.neighborhood || "");
    setCity(profile?.city || "");
    setState(profile?.state || "");
    setCpfRequestExpanded(false);
    setNewCpf("");
    setNewCpfError("");
    setJustification("");

    // Check pending CPF request
    if (userId) {
      supabase
        .from("cpf_change_requests")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "pending")
        .maybeSingle()
        .then(({ data }) => {
          setHasPendingCpfRequest(!!data);
        });
    }
  }, [open, profile, userId]);

  /* ── Avatar upload ── */
  const handleAvatarUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem válida");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 2MB");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error("Erro ao enviar foto");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(path);

    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl } as any)
      .eq("id", userId);

    setUploading(false);

    if (updateError) {
      toast.error("Erro ao atualizar perfil");
    } else {
      toast.success("Foto atualizada!");
      onAvatarUpdated(publicUrl);
    }
  };

  /* ── Username validation ── */
  const validateUsername = (val: string) => {
    if (!val) {
      setUsernameError("");
      return true;
    }
    if (!/^[a-z0-9._]{3,30}$/.test(val)) {
      setUsernameError("3-30 caracteres: letras minúsculas, números, . e _");
      return false;
    }
    setUsernameError("");
    return true;
  };

  /* ── CEP fetch ── */
  const fetchCep = useCallback(async (digits: string) => {
    setCepLoading(true);
    setCepError("");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data: CepData = await res.json();
      if (data.erro) {
        setCepError("CEP não encontrado");
      } else {
        setStreet(data.logradouro || "");
        setNeighborhood(data.bairro || "");
        setCity(data.localidade || "");
        setState(data.uf || "");
      }
    } catch {
      setCepError("CEP não encontrado");
    } finally {
      setCepLoading(false);
    }
  }, []);

  const handleCepChange = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 8);
    setCep(digits);
    setCepError("");
    if (digits.length === 8) {
      fetchCep(digits);
    }
  };

  /* ── Save ── */
  const handleSave = async () => {
    if (!userId) return;
    if (username && !validateUsername(username)) return;

    if (username && username !== (profile?.username || "")) {
      const { data: available } = await supabase.rpc(
        "check_username_available",
        { p_username: username }
      );
      if (!available) {
        setUsernameError("Username já está em uso");
        return;
      }
    }

    setSaving(true);

    const updates: any = {
      name: name.trim(),
      phone: unmask(phone),
      postal_code: cep,
      street: street.trim(),
      address_number: addressNumber.trim(),
      neighborhood: neighborhood.trim(),
      city: city.trim(),
      state: state.trim(),
    };
    if (username) updates.username = username.toLowerCase();

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId);

    setSaving(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Perfil atualizado!");
      onOpenChange(false);
      onSaved();
    }
  };

  /* ── CPF change request ── */
  const handleSubmitCpfRequest = async () => {
    const digits = newCpf.replace(/\D/g, "");
    if (!isValidCPF(digits)) {
      setNewCpfError("CPF inválido");
      return;
    }
    if (justification.trim().length < 10) {
      toast.error("Justificativa deve ter no mínimo 10 caracteres");
      return;
    }

    setSubmittingCpfRequest(true);
    const { error } = await supabase.rpc("create_cpf_change_request", {
      p_requested_cpf: digits,
      p_justification: justification.trim(),
    });
    setSubmittingCpfRequest(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Solicitação enviada! Entraremos em contato.");
    setCpfRequestExpanded(false);
    setNewCpf("");
    setJustification("");
    setHasPendingCpfRequest(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dark max-w-[480px] max-h-[80dvh] overflow-y-auto rounded-3xl border-white/[0.08] bg-card/95 backdrop-blur-xl text-foreground">
        <DialogHeader>
          <DialogTitle>Editar perfil</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 pt-2">
          {/* Avatar */}
          <div className="flex justify-center">
            <div className="relative">
              <Avatar className="h-20 w-20 border-2 border-white/10 shadow-lg shadow-black/30">
                <AvatarImage src={avatarUrl || undefined} alt={name} />
                <AvatarFallback className="bg-primary/20 text-xl font-bold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md active:scale-90 transition-transform disabled:opacity-60"
              >
                {uploading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Camera className="h-3 w-3" />
                )}
              </button>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
          </div>

          {/* Personal data */}
          <div>
            <p className={sectionLabel}>Dados pessoais</p>
            <div className="flex flex-col gap-3">
              <Input
                placeholder="Nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />

              <div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-base">
                    @
                  </span>
                  <Input
                    placeholder="username"
                    value={username}
                    onChange={(e) => {
                      const v = e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9._]/g, "");
                      setUsername(v);
                      validateUsername(v);
                    }}
                    className={`${inputClass} pl-8`}
                    maxLength={30}
                  />
                </div>
                {usernameError && (
                  <p className="text-xs text-destructive mt-1 ml-1">
                    {usernameError}
                  </p>
                )}
              </div>

              {/* Email read-only */}
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  value={email}
                  disabled
                  className={`${inputClass} pl-9 pr-9 opacity-70 cursor-not-allowed`}
                />
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              </div>

              <Input
                placeholder="Telefone"
                value={phone}
                onChange={(e) => setPhone(maskPhone(e.target.value))}
                className={inputClass}
                inputMode="numeric"
              />
            </div>
          </div>

          <div className="h-px bg-white/[0.06]" />

          {/* CPF section */}
          <div>
            <p className={sectionLabel}>CPF</p>
            <div className="relative">
              <Input
                value={profile?.cpf ? maskCPF(profile.cpf) : ""}
                disabled
                placeholder="CPF não informado"
                className={`${inputClass} pr-9 opacity-70 cursor-not-allowed`}
              />
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
            </div>

            <div className="mt-2">
              {hasPendingCpfRequest ? (
                <Badge
                  variant="outline"
                  className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px]"
                >
                  Solicitação pendente
                </Badge>
              ) : (
                <button
                  type="button"
                  onClick={() => setCpfRequestExpanded((v) => !v)}
                  className="text-xs text-primary underline flex items-center gap-1 active:opacity-70 transition-opacity"
                >
                  Solicitar alteração de CPF
                  {cpfRequestExpanded ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              )}
            </div>

            {cpfRequestExpanded && !hasPendingCpfRequest && (
              <div className="mt-3 flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div>
                  <Input
                    placeholder="Novo CPF"
                    value={maskCPF(newCpf)}
                    onChange={(e) => {
                      const v = e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 11);
                      setNewCpf(v);
                      if (v.length === 11 && !isValidCPF(v))
                        setNewCpfError("CPF inválido");
                      else setNewCpfError("");
                    }}
                    className={inputClass}
                    inputMode="numeric"
                  />
                  {newCpfError && (
                    <p className="text-xs text-destructive mt-1 ml-1">
                      {newCpfError}
                    </p>
                  )}
                </div>
                <Textarea
                  placeholder="Justificativa (mínimo 10 caracteres)"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  className="min-h-[80px] rounded-xl border-white/[0.08] bg-white/[0.04] text-sm"
                  maxLength={500}
                />
                <Button
                  type="button"
                  onClick={handleSubmitCpfRequest}
                  disabled={
                    submittingCpfRequest ||
                    !!newCpfError ||
                    newCpf.length !== 11 ||
                    justification.trim().length < 10
                  }
                  variant="secondary"
                  className="h-10 rounded-xl"
                >
                  {submittingCpfRequest ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Enviar solicitação"
                  )}
                </Button>
              </div>
            )}
          </div>

          <div className="h-px bg-white/[0.06]" />

          {/* Address */}
          <div>
            <p className={sectionLabel}>Endereço</p>
            <div className="flex flex-col gap-3">
              <div>
                <div className="relative">
                  <Input
                    placeholder="CEP"
                    value={cep}
                    onChange={(e) => handleCepChange(e.target.value)}
                    className={`${inputClass} ${cepError ? "border-destructive" : ""}`}
                    inputMode="numeric"
                    maxLength={8}
                  />
                  {cepLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                {cepError && (
                  <p className="text-xs text-destructive mt-1 ml-1">
                    {cepError}
                  </p>
                )}
              </div>

              <Input
                placeholder="Rua"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className={inputClass}
              />
              <Input
                placeholder="Número"
                value={addressNumber}
                onChange={(e) => setAddressNumber(e.target.value)}
                className={inputClass}
              />
              <Input
                placeholder="Bairro"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className={inputClass}
              />
              <div className="grid grid-cols-[1fr_80px] gap-2">
                <Input
                  placeholder="Cidade"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={inputClass}
                />
                <Input
                  placeholder="UF"
                  value={state}
                  onChange={(e) =>
                    setState(e.target.value.toUpperCase().slice(0, 2))
                  }
                  className={inputClass}
                  maxLength={2}
                />
              </div>
            </div>
          </div>

          {/* Save */}
          <Button
            onClick={handleSave}
            disabled={saving || !!usernameError}
            className="h-14 rounded-xl bg-gradient-to-r from-primary to-primary-glow text-base font-semibold text-primary-foreground"
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              "Salvar alterações"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
