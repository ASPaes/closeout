import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/i18n/use-translation";
import { format } from "date-fns";
import type { Json } from "@/integrations/supabase/types";

type CashOrder = {
  id: string;
  order_number: number;
  created_at: string;
  items: Json;
  total: number;
  payment_method: string;
  status: string;
};

type OrderItem = { name: string; quantity: number };

interface OrderPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string | null;
  onSelect: (order: CashOrder) => void;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const paymentLabel: Record<string, string> = {
  cash: "Dinheiro",
  credit_card: "Crédito",
  debit_card: "Débito",
  pix: "PIX",
};

export function OrderPickerDialog({ open, onOpenChange, eventId, onSelect }: OrderPickerDialogProps) {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<CashOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open || !eventId) return;
    setLoading(true);
    setSearch("");
    supabase
      .from("cash_orders")
      .select("id, order_number, created_at, items, total, payment_method, status")
      .eq("event_id", eventId)
      .eq("status", "completed")
      .order("order_number", { ascending: false })
      .then(({ data }) => {
        setOrders(data ?? []);
        setLoading(false);
      });
  }, [open, eventId]);

  const filtered = useMemo(() => {
    if (!search) return orders;
    const q = search.toLowerCase();
    const num = parseInt(q, 10);
    return orders.filter((o) => {
      if (!isNaN(num) && String(o.order_number).includes(q)) return true;
      const items = Array.isArray(o.items) ? (o.items as OrderItem[]) : [];
      return items.some((i) => i.name.toLowerCase().includes(q));
    });
  }, [orders, search]);

  const getItemsSummary = (items: Json) => {
    if (!Array.isArray(items)) return "";
    return (items as OrderItem[]).map((i) => `${i.quantity}x ${i.name}`).join(", ");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg bg-card/95 backdrop-blur-sm border-border/60"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("order_picker_title")}</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("order_picker_search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        <ScrollArea className="h-[400px] -mx-1">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-sm text-muted-foreground animate-pulse">{t("loading")}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <ShoppingBag className="h-8 w-8 text-muted-foreground/50" />
              <span className="text-sm text-muted-foreground">{t("order_picker_empty")}</span>
            </div>
          ) : (
            <div className="space-y-1.5 px-1">
              {filtered.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => {
                    onSelect(order);
                    onOpenChange(false);
                  }}
                  className="w-full text-left rounded-lg border border-border/40 bg-muted/20 p-3 transition-all hover:border-primary/50 hover:bg-primary/5 active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-foreground">
                      #{order.order_number}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {paymentLabel[order.payment_method] ?? order.payment_method}
                      </Badge>
                      <span className="text-sm font-bold text-primary">{fmt(order.total)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {getItemsSummary(order.items)}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">
                    {format(new Date(order.created_at), "dd/MM/yyyy HH:mm")}
                  </p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
