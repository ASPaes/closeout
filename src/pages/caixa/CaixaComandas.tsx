import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCaixa } from "@/contexts/CaixaContext";
import { useTranslation } from "@/i18n/use-translation";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CaixaEventGuard } from "@/components/CaixaEventGuard";
import { PageHeader } from "@/components/PageHeader";
import { Search, RefreshCw, ChevronRight, Clock, Receipt } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

type ComandaItem = {
  comanda_id: string;
  card_number: string;
  consumer_name: string;
  opened_at: string;
  total: number;
  order_count: number;
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ComandasContent() {
  const navigate = useNavigate();
  const { eventId } = useCaixa();
  const { t } = useTranslation();

  const [comandas, setComandas] = useState<ComandaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [searchNumber, setSearchNumber] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    async function checkEnabled() {
      if (!eventId) {
        setEnabled(false);
        return;
      }
      const { data, error } = await supabase
        .from("events")
        .select("comanda_enabled")
        .eq("id", eventId)
        .single();

      if (error || !data) {
        setEnabled(false);
        return;
      }
      setEnabled(data.comanda_enabled ?? false);
    }

    checkEnabled();
  }, [eventId]);

  const loadComandas = async (cardNumber?: number) => {
    if (!eventId) return;
    setRefreshing(true);
    try {
      const { data, error } = await supabase.rpc("list_open_comandas", {
        p_event_id: eventId,
        p_card_number: cardNumber ?? null,
      });

      if (error) {
        toast.error("Erro ao carregar comandas");
        setComandas([]);
        return;
      }

      const list = (data as unknown as ComandaItem[] | null) ?? [];
      setComandas(list);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (enabled === true) {
      loadComandas();
      const interval = setInterval(() => loadComandas(), 300000);
      return () => clearInterval(interval);
    }
  }, [enabled, eventId]);

  const filteredComandas = useMemo(() => {
    if (!searchNumber.trim()) return comandas;
    const term = searchNumber.trim();
    return comandas.filter((c) => String(c.card_number).startsWith(term));
  }, [comandas, searchNumber]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(searchNumber.trim());
    if (!Number.isNaN(num) && num > 0) {
      loadComandas(num);
    }
  };

  if (enabled === false) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <Receipt className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Comanda não está ativa neste evento</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            O evento selecionado não possui o módulo de comandas habilitado.
          </p>
        </div>
      </div>
    );
  }

  if (enabled === null || loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="h-10 w-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t("caixa_comandas")} (${filteredComandas.length} abertas)`}
        actions={
          <Button
            variant="outline"
            size="icon"
            onClick={() => loadComandas()}
            disabled={refreshing}
            className="shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        }
      />

      <form onSubmit={handleSearchSubmit} className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          inputMode="numeric"
          autoFocus
          placeholder="Número da comanda"
          value={searchNumber}
          onChange={(e) => setSearchNumber(e.target.value.replace(/\D/g, ""))}
          className="pl-10 h-12"
        />
      </form>

      {filteredComandas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <Receipt className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Nenhuma comanda aberta</h2>
            <p className="text-sm text-muted-foreground">
              {searchNumber.trim()
                ? "Nenhuma comanda encontrada com este número."
                : "Não há comandas abertas no momento."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredComandas.map((comanda) => (
            <Card
              key={comanda.comanda_id}
              className="cursor-pointer hover:bg-accent/40 transition-colors group"
              onClick={() => navigate(`/caixa/comandas/${comanda.comanda_id}`)}
            >
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-lg font-bold text-primary">#{comanda.card_number}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {comanda.consumer_name}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        há{" "}
                        {formatDistanceToNow(new Date(comanda.opened_at), {
                          locale: ptBR,
                          addSuffix: false,
                        })}
                      </span>
                      <Badge variant="secondary" className="text-xs h-5 px-1.5">
                        {comanda.order_count} pedidos
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">
                      {formatCurrency(Number(comanda.total))}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CaixaComandas() {
  return (
    <CaixaEventGuard>
      <ComandasContent />
    </CaixaEventGuard>
  );
}
