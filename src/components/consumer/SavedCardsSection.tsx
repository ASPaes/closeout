import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreditCard, Trash2, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SavedCard {
  id: string;
  card_brand: string | null;
  card_last_four: string;
  card_holder_name: string | null;
}

const brandLabels: Record<string, string> = {
  VISA: "Visa",
  MASTERCARD: "Mastercard",
  ELO: "Elo",
  AMEX: "Amex",
  HIPERCARD: "Hipercard",
  DINERS: "Diners",
};

const glassCard = "rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm";

const maskCardNumber = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
};

const onlyDigits = (value: string) => value.replace(/\D/g, "");

export function SavedCardsSection({ userId }: { userId: string }) {
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [holder, setHolder] = useState("");
  const [number, setNumber] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [cvv, setCvv] = useState("");

  const fetchCards = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("asaas_customer_cards")
      .select("id, card_brand, card_last_four, card_holder_name")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    setCards(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const { error } = await supabase
      .from("asaas_customer_cards")
      .update({ is_active: false })
      .eq("id", deleteId);
    setDeleting(false);
    setDeleteId(null);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Cartão removido");
      setCards((prev) => prev.filter((c) => c.id !== deleteId));
    }
  };

  const resetForm = () => {
    setHolder("");
    setNumber("");
    setMonth("");
    setYear("");
    setCvv("");
  };

  const handleAddOpenChange = (open: boolean) => {
    setAddOpen(open);
    if (!open) resetForm();
  };

  const numberDigits = onlyDigits(number);
  const monthNum = parseInt(month, 10);
  const isValid =
    holder.trim().length >= 2 &&
    numberDigits.length >= 13 &&
    month.length > 0 &&
    !isNaN(monthNum) &&
    monthNum >= 1 &&
    monthNum <= 12 &&
    year.length > 0 &&
    cvv.length >= 3;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || saving) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-tokenize-card", {
        body: {
          card_holder_name: holder.trim(),
          card_number: numberDigits,
          card_expiry_month: month.padStart(2, "0"),
          card_expiry_year: year,
          card_cvv: cvv,
        },
      });
      if (error || !data?.success) {
        toast.error(data?.error || error?.message || "Erro ao adicionar cartão");
      } else {
        toast.success("Cartão adicionado!");
        setAddOpen(false);
        resetForm();
        fetchCards();
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao adicionar cartão");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setAddOpen(true)}
        className="group inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/[0.12] bg-white/[0.03] text-base font-semibold text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary active:border-primary/40 active:bg-primary/5 active:text-primary"
      >
        <Plus className="h-5 w-5" />
        Adicionar cartão
      </button>

      {loading ? (
        Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-2xl" />
        ))
      ) : (
        cards.map((card) => (
          <div
            key={card.id}
            className={cn(glassCard, "flex items-center gap-3 p-3 min-h-[52px]")}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 shrink-0">
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  •••• {card.card_last_four}
                </span>
                {card.card_brand && (
                  <span className="text-[10px] text-muted-foreground">
                    {brandLabels[card.card_brand] || card.card_brand}
                  </span>
                )}
              </div>
              {card.card_holder_name && (
                <p className="text-xs text-muted-foreground truncate">
                  {card.card_holder_name}
                </p>
              )}
            </div>
            <button
              onClick={() => setDeleteId(card.id)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 transition-colors shrink-0"
              aria-label="Remover cartão"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))
      )}

      <Dialog open={addOpen} onOpenChange={handleAddOpenChange}>
        <DialogContent className="dark max-w-[420px] rounded-3xl border-white/[0.08] bg-card/95 backdrop-blur-xl text-foreground">
          <DialogHeader>
            <DialogTitle>Adicionar cartão</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Nome no cartão
              </label>
              <Input
                value={holder}
                onChange={(e) => setHolder(e.target.value)}
                placeholder="Nome impresso no cartão"
                autoCapitalize="characters"
                className="h-12 rounded-xl border-white/[0.08] bg-white/[0.04]"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Número do cartão
              </label>
              <Input
                value={number}
                onChange={(e) => setNumber(maskCardNumber(e.target.value))}
                placeholder="0000 0000 0000 0000"
                inputMode="numeric"
                maxLength={19}
                className="h-12 rounded-xl border-white/[0.08] bg-white/[0.04]"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Mês</label>
                <Input
                  value={month}
                  onChange={(e) => setMonth(onlyDigits(e.target.value).slice(0, 2))}
                  placeholder="MM"
                  inputMode="numeric"
                  maxLength={2}
                  className="h-12 rounded-xl border-white/[0.08] bg-white/[0.04]"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Ano</label>
                <Input
                  value={year}
                  onChange={(e) => setYear(onlyDigits(e.target.value).slice(0, 2))}
                  placeholder="AA"
                  inputMode="numeric"
                  maxLength={2}
                  className="h-12 rounded-xl border-white/[0.08] bg-white/[0.04]"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">CVV</label>
                <Input
                  value={cvv}
                  onChange={(e) => setCvv(onlyDigits(e.target.value).slice(0, 4))}
                  placeholder="CVV"
                  inputMode="numeric"
                  maxLength={4}
                  className="h-12 rounded-xl border-white/[0.08] bg-white/[0.04]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!isValid || saving}
              className="mt-2 inline-flex h-14 items-center justify-center rounded-xl bg-gradient-to-r from-primary to-primary-glow text-base font-semibold text-primary-foreground shadow-lg transition-opacity disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar cartão"
              )}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="dark max-w-[360px] rounded-3xl border-white/[0.08] bg-card/95 backdrop-blur-xl text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cartão</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja remover este cartão?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
