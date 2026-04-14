import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreditCard, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
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

export function SavedCardsSection({ userId }: { userId: string }) {
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-foreground px-1">Cartões salvos</h3>

      {loading ? (
        Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-2xl" />
        ))
      ) : cards.length === 0 ? (
        <div className={cn(glassCard, "flex items-center justify-center py-6")}>
          <p className="text-sm text-muted-foreground">Nenhum cartão salvo</p>
        </div>
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
