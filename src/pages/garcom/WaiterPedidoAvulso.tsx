import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWaiter } from "@/contexts/WaiterContext";
import { WaiterSessionGuard } from "@/components/WaiterSessionGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import {
  Search, Plus, Minus, ArrowRight, Loader2, ChevronLeft,
  Banknote, CreditCard, DollarSign, PartyPopper,
} from "lucide-react";

type CatalogProduct = {
  id: string; type: "product" | "combo"; name: string; price: number;
  category_name: string | null; image_path: string | null; stock_available: number | null;
};
type CartItem = { id: string; type: "product" | "combo"; name: string; price: number; quantity: number };

export default function WaiterPedidoAvulso() {
  const navigate = useNavigate();
  const { eventId, clientId, refreshSession, cashCollected, setCashCollected } = useWaiter();

  const [phase, setPhase] = useState<"catalog" | "payment">("catalog");
  const [cart, setCart] = useState<CartItem[]>([]);

  // ── Catalog state ──
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<string[]>(["Todos"]);
  const [activeCat, setActiveCat] = useState("Todos");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // ── Payment state ──
  const [method, setMethod] = useState<string | null>(null);
  const [cashReceived, setCashReceived] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ orderId: string; qrToken: string } | null>(null);

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cashVal = parseFloat(cashReceived.replace(",", ".")) || 0;

  // ── Fetch catalog ──
  useEffect(() => {
    if (!eventId || !clientId) return;
    (async () => {
      setLoading(true);
      const { data: ec } = await supabase.from("event_catalogs").select("catalog_id").eq("event_id", eventId).eq("is_active", true);
      if (!ec?.length) { setLoading(false); return; }

      const [ciRes, stRes] = await Promise.all([
        supabase.from("catalog_items")
          .select("id, item_type, product_id, combo_id, products:product_id (id, name, price, image_path, category_id, is_stock_tracked, categories:category_id (name)), combos:combo_id (id, name, price)")
          .in("catalog_id", ec.map(c => c.catalog_id)).eq("is_active", true),
        supabase.from("stock_balances").select("product_id, quantity_available").eq("client_id", clientId),
      ]);

      const sm: Record<string, number> = {};
      (stRes.data ?? []).forEach((s: any) => { sm[s.product_id] = s.quantity_available; });

      const items: CatalogProduct[] = [];
      const cs = new Set<string>();
      (ciRes.data ?? []).forEach((ci: any) => {
        if (ci.item_type === "product" && ci.products) {
          const p = ci.products;
          const cn = p.categories?.name || null;
          if (cn) cs.add(cn);
          items.push({ id: p.id, type: "product", name: p.name, price: Number(p.price), category_name: cn, image_path: p.image_path, stock_available: p.is_stock_tracked ? (sm[p.id] ?? 0) : null });
        } else if (ci.item_type === "combo" && ci.combos) {
          const c = ci.combos;
          cs.add("Combos");
          items.push({ id: c.id, type: "combo", name: c.name, price: Number(c.price), category_name: "Combos", image_path: null, stock_available: null });
        }
      });
      items.sort((a, b) => a.name.localeCompare(b.name));
      setCategories(["Todos", ...Array.from(cs).sort()]);
      setProducts(items);
      setLoading(false);
    })();
  }, [eventId, clientId]);

  const filtered = useMemo(() => products.filter(p => {
    const mc = activeCat === "Todos" || p.category_name === activeCat;
    const ms = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return mc && ms;
  }), [products, activeCat, search]);

  const cartMap = useMemo(() => {
    const m: Record<string, number> = {};
    cart.forEach(i => { m[i.id] = i.quantity; });
    return m;
  }, [cart]);

  const addItem = (p: CatalogProduct) => setCart(prev => {
    const ex = prev.find(i => i.id === p.id);
    return ex ? prev.map(i => i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i) : [...prev, { id: p.id, type: p.type, name: p.name, price: p.price, quantity: 1 }];
  });
  const dec = (id: string) => setCart(prev => { const i = prev.find(x => x.id === id); if (!i) return prev; return i.quantity <= 1 ? prev.filter(x => x.id !== id) : prev.map(x => x.id === id ? { ...x, quantity: x.quantity - 1 } : x); });
  const inc = (id: string) => setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: i.quantity + 1 } : i));

  const handleSubmit = async () => {
    if (!method) { toast.error("Selecione a forma de pagamento"); return; }
    if (method === "cash" && cashVal < total) { toast.error("Valor insuficiente"); return; }
    setSubmitting(true);

    const items = cart.map(i => ({ [i.type === "product" ? "product_id" : "combo_id"]: i.id, quantity: i.quantity }));
    const { data, error } = await supabase.rpc("create_waiter_order", {
      params: { event_id: eventId, items, payment_method: method } as any,
    });
    setSubmitting(false);
    if (error || !(data as any)?.ok) { toast.error((data as any)?.error || "Erro ao criar pedido"); return; }

    toast.success("Pedido avulso criado!");
    setResult({ orderId: (data as any).order_id, qrToken: (data as any).qr_token });
    if (method === "cash") setCashCollected(cashCollected + total);
    refreshSession();
  };

  // ── Success ──
  if (result) {
    return (
      <WaiterSessionGuard>
        <div className="flex flex-col items-center gap-6 py-8">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15">
            <PartyPopper className="h-10 w-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold">Pedido criado!</h2>
          <p className="text-sm text-muted-foreground">Pedido avulso — sem identificação</p>
          <div className="rounded-2xl bg-white p-4"><QRCodeSVG value={result.qrToken} size={180} /></div>
          <p className="text-xs text-muted-foreground">QR Code para retirada</p>
          <div className="flex flex-col gap-3 w-full mt-4">
            <Button className="h-14 rounded-xl text-base font-semibold w-full" onClick={() => navigate("/garcom/pedidos")}>Ver pedidos</Button>
            <Button variant="outline" className="h-14 rounded-xl text-base font-semibold w-full border-white/[0.08]" onClick={() => { setResult(null); setCart([]); setMethod(null); setCashReceived(""); setPhase("catalog"); }}>Novo pedido avulso</Button>
          </div>
        </div>
      </WaiterSessionGuard>
    );
  }

  // ── Payment ──
  if (phase === "payment") {
    const opts = [
      { id: "cash", icon: Banknote, label: "Dinheiro", desc: "Receber em espécie" },
      { id: "pos", icon: CreditCard, label: "Maquininha (POS)", desc: "Cartão crédito/débito" },
      { id: "pix", icon: DollarSign, label: "PIX", desc: "QR Code PIX" },
    ];
    return (
      <WaiterSessionGuard>
        <div className="flex flex-col gap-4 pb-4">
          <button onClick={() => setPhase("catalog")} className="flex items-center gap-1 text-sm text-muted-foreground w-fit">
            <ChevronLeft className="h-4 w-4" /> Voltar ao catálogo
          </button>
          <h2 className="text-xl font-bold">Pagamento — Avulso</h2>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">Resumo</p>
            {cart.map(i => (
              <div key={i.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{i.quantity}x {i.name}</span>
                <span className="text-foreground font-medium">R$ {(i.price * i.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div className="border-t border-white/[0.06] pt-3 flex items-center justify-between">
              <span className="text-base font-bold">Total</span>
              <span className="text-lg font-bold text-primary">R$ {total.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {opts.map(o => (
              <button key={o.id} onClick={() => setMethod(o.id)} className={cn("flex items-center gap-4 rounded-2xl border p-4 text-left active:scale-[0.98] transition-all", method === o.id ? "border-primary bg-primary/10" : "border-white/[0.06] bg-white/[0.03]")}>
                <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", method === o.id ? "bg-primary/20" : "bg-white/[0.06]")}>
                  <o.icon className={cn("h-6 w-6", method === o.id ? "text-primary" : "text-muted-foreground")} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{o.label}</p>
                  <p className="text-xs text-muted-foreground">{o.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {method === "cash" && (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-3">
              <label className="text-sm font-semibold text-foreground">Valor recebido</label>
              <Input placeholder="0,00" value={cashReceived} onChange={e => setCashReceived(e.target.value)} className="h-12 rounded-xl text-lg font-bold text-center bg-white/[0.04] border-white/[0.08]" inputMode="decimal" autoFocus />
              {cashVal >= total && (
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                  <span className="text-sm text-muted-foreground">Troco</span>
                  <span className="text-lg font-bold text-emerald-400">R$ {(cashVal - total).toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          <Button onClick={handleSubmit} disabled={!method || submitting} className="h-14 rounded-xl text-base font-semibold w-full mt-2">
            {submitting && <Loader2 className="h-5 w-5 animate-spin mr-2" />}
            Finalizar · R$ {total.toFixed(2)}
          </Button>
        </div>
      </WaiterSessionGuard>
    );
  }

  // ── Catalog ──
  return (
    <WaiterSessionGuard>
      <div className="flex flex-col gap-4 pb-24">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground">
            <ChevronLeft className="h-4 w-4" /> Voltar
          </button>
          <h2 className="text-xl font-bold flex-1">Pedido Avulso</h2>
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} className="h-12 rounded-2xl border-white/[0.08] bg-white/[0.04] pl-11 text-base" />
        </div>

        {categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5">
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCat(cat)} className={cn("shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-all active:scale-95", activeCat === cat ? "bg-primary text-primary-foreground" : "bg-white/[0.06] border border-white/[0.08] text-muted-foreground")}>{cat}</button>
            ))}
          </div>
        )}

        {loading && <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
        {!loading && filtered.length === 0 && <div className="flex flex-col items-center justify-center py-16"><p className="text-sm text-muted-foreground">Nenhum produto encontrado</p></div>}

        {!loading && (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(product => {
              const qty = cartMap[product.id] || 0;
              const out = product.stock_available !== null && product.stock_available <= 0;
              return (
                <div key={product.id} className={cn("relative flex flex-col rounded-2xl bg-white/[0.04] border border-white/[0.06] overflow-hidden active:scale-[0.98] transition-transform", out && "opacity-50")}>
                  <div className="relative aspect-square w-full bg-white/[0.02] overflow-hidden">
                    {product.image_path ? (
                      <img src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/product-images/${product.image_path}`} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center"><span className="text-4xl">{product.type === "combo" ? "🪣" : "🍺"}</span></div>
                    )}
                    {out && <div className="absolute inset-0 flex items-center justify-center bg-black/60"><span className="text-xs font-bold text-destructive">Esgotado</span></div>}
                  </div>
                  <div className="flex flex-col gap-1 p-3">
                    <h3 className="text-[13px] font-semibold text-foreground line-clamp-2 leading-tight">{product.name}</h3>
                    <span className="text-[15px] font-bold text-primary">R$ {product.price.toFixed(2)}</span>
                  </div>
                  {!out && qty === 0 && (
                    <button onClick={() => addItem(product)} className="absolute bottom-[52px] right-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_4px_16px_hsl(24,100%,50%,0.4)] active:scale-90 transition-transform"><Plus className="h-5 w-5" /></button>
                  )}
                  {!out && qty > 0 && (
                    <div className="flex items-center justify-between w-full px-2 py-1.5 border-t border-white/[0.06]">
                      <button onClick={() => dec(product.id)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-foreground active:scale-90 transition-transform"><Minus className="h-4 w-4" /></button>
                      <span className="text-sm font-bold text-foreground">{qty}</span>
                      <button onClick={() => inc(product.id)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground active:scale-90 transition-transform"><Plus className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {cartCount > 0 && (
          <div className="fixed bottom-[76px] left-0 right-0 z-40 px-5">
            <div className="mx-auto max-w-[480px]">
              <button onClick={() => setPhase("payment")} className="flex h-14 w-full items-center justify-between rounded-2xl bg-primary px-5 shadow-xl active:scale-[0.98] transition-transform" style={{ boxShadow: "0 8px 32px hsl(24 100% 50% / 0.35)" }}>
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-foreground/20 text-xs font-bold text-primary-foreground">{cartCount}</div>
                  <span className="text-[15px] font-semibold text-primary-foreground">Pagamento</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[15px] font-bold text-primary-foreground">R$ {total.toFixed(2)}</span>
                  <ArrowRight className="h-4 w-4 text-primary-foreground/70" />
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </WaiterSessionGuard>
  );
}
