import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWaiter } from "@/contexts/WaiterContext";
import { useTranslation } from "@/i18n/use-translation";
import { WaiterSessionGuard } from "@/components/WaiterSessionGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { maskCPF, maskPhone, unmask } from "@/lib/masks";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import {
  ScanLine, CreditCard, Phone, Hash, UserCheck, ChevronLeft,
  Search, Plus, Minus, ArrowRight, Loader2, CheckCircle2,
  Banknote, Smartphone, CreditCard as CreditCardIcon,
  UserX, DollarSign, PartyPopper,
} from "lucide-react";

// ── Types ─────────────────────────────────────────
type CatalogProduct = {
  id: string;
  type: "product" | "combo";
  name: string;
  price: number;
  category_name: string | null;
  image_path: string | null;
  stock_available: number | null;
};

type CartItem = {
  id: string;
  type: "product" | "combo";
  name: string;
  price: number;
  quantity: number;
};

type IdentifiedClient = {
  id: string;
  name: string;
  cpf: string | null;
  phone: string | null;
};

type Step = 1 | 2 | 3;

const STEPS = [
  { step: 1, label: "Cliente" },
  { step: 2, label: "Pedido" },
  { step: 3, label: "Pagamento" },
] as const;

// ═══════════════════════════════════════════════════
export default function WaiterNovoPedido() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { eventId, clientId, sessionId, refreshSession, cashCollected, setCashCollected } = useWaiter();

  const [step, setStep] = useState<Step>(1);
  const [consumer, setConsumer] = useState<IdentifiedClient | null>(null);

  // Pre-fill consumer from navigation state (e.g., from Chamados)
  useEffect(() => {
    const state = location.state as any;
    if (state?.consumer_id) {
      supabase
        .from("profiles")
        .select("id, name, cpf, phone")
        .eq("id", state.consumer_id)
        .single()
        .then(({ data }) => {
          if (data) {
            setConsumer({ id: data.id, name: data.name, cpf: data.cpf, phone: data.phone });
            setStep(2);
          }
        });
    }
  }, [location.state]);

  return (
    <WaiterSessionGuard>
      <div className="flex flex-col gap-4 pb-4">
        {/* Stepper */}
        <div className="flex items-center justify-between gap-2">
          {STEPS.map(({ step: s, label }) => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors",
                  step >= s
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/[0.08] text-muted-foreground"
                )}
              >
                {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
              </div>
              <span className={cn("text-[11px] font-medium", step >= s ? "text-foreground" : "text-muted-foreground")}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {step === 1 && (
          <StepIdentify
            onIdentified={(c) => { setConsumer(c); setStep(2); }}
            onSkip={() => { setConsumer(null); setStep(2); }}
          />
        )}

        {step === 2 && (
          <StepCatalog
            eventId={eventId!}
            clientId={clientId!}
            consumer={consumer}
            onBack={() => setStep(1)}
            onContinue={(items) => {
              setCartItems(items);
              setStep(3);
            }}
            cartItems={cartItems}
            setCartItems={setCartItems}
          />
        )}

        {step === 3 && (
          <StepPayment
            eventId={eventId!}
            clientId={clientId!}
            consumer={consumer}
            cartItems={cartItems}
            sessionId={sessionId!}
            onBack={() => setStep(2)}
            onDone={(addedCash) => {
              if (addedCash > 0) setCashCollected(cashCollected + addedCash);
              refreshSession();
            }}
          />
        )}
      </div>
    </WaiterSessionGuard>
  );

  // Lifted cart state so it persists between steps
  function WaiterNovoPedidoInner() {} // unused, cart is lifted below
}

// We need cart state at the top level — let me refactor:
// Actually, let me restructure properly with cart state in the parent.

// ═══════════════════════════════════════════════════
// Re-export with proper cart state
// ═══════════════════════════════════════════════════

// The above has a bug — cartItems/setCartItems used before declaration.
// Let me fix by rewriting the default export properly:

const WaiterNovoPedidoPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { eventId, clientId, sessionId, refreshSession, cashCollected, setCashCollected } = useWaiter();

  const [step, setStep] = useState<Step>(1);
  const [consumer, setConsumer] = useState<IdentifiedClient | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Pre-fill consumer from navigation state
  useEffect(() => {
    const state = location.state as any;
    if (state?.consumer_id) {
      supabase
        .from("profiles")
        .select("id, name, cpf, phone")
        .eq("id", state.consumer_id)
        .single()
        .then(({ data }) => {
          if (data) {
            setConsumer({ id: data.id, name: data.name, cpf: data.cpf, phone: data.phone });
            setStep(2);
          }
        });
    }
  }, [location.state]);

  return (
    <WaiterSessionGuard>
      <div className="flex flex-col gap-4 pb-4">
        {/* Stepper */}
        <div className="flex items-center justify-between gap-2">
          {STEPS.map(({ step: s, label }) => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors",
                  step >= s
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/[0.08] text-muted-foreground"
                )}
              >
                {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
              </div>
              <span className={cn("text-[11px] font-medium", step >= s ? "text-foreground" : "text-muted-foreground")}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {step === 1 && (
          <StepIdentify
            onIdentified={(c) => { setConsumer(c); setStep(2); }}
            onSkip={() => { setConsumer(null); setStep(2); }}
          />
        )}

        {step === 2 && (
          <StepCatalog
            eventId={eventId!}
            clientId={clientId!}
            consumer={consumer}
            onBack={() => setStep(1)}
            onContinue={() => setStep(3)}
            cartItems={cartItems}
            setCartItems={setCartItems}
          />
        )}

        {step === 3 && (
          <StepPayment
            eventId={eventId!}
            clientId={clientId!}
            consumer={consumer}
            cartItems={cartItems}
            sessionId={sessionId!}
            onBack={() => setStep(2)}
            onDone={(addedCash) => {
              if (addedCash > 0) setCashCollected(cashCollected + addedCash);
              refreshSession();
            }}
          />
        )}
      </div>
    </WaiterSessionGuard>
  );
};

// ═══════════════════════════════════════════════════
// STEP 1 — Identify Client
// ═══════════════════════════════════════════════════
function StepIdentify({
  onIdentified,
  onSkip,
}: {
  onIdentified: (c: IdentifiedClient) => void;
  onSkip: () => void;
}) {
  const [mode, setMode] = useState<"menu" | "cpf" | "phone" | "id" | "qr">("menu");
  const [inputValue, setInputValue] = useState("");
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const searchProfile = async (field: string, value: string) => {
    setSearching(true);
    setNotFound(false);
    const { data } = await supabase
      .from("profiles")
      .select("id, name, cpf, phone")
      .eq(field, value)
      .limit(1)
      .maybeSingle();

    setSearching(false);
    if (data) {
      onIdentified({ id: data.id, name: data.name, cpf: data.cpf, phone: data.phone });
    } else {
      setNotFound(true);
    }
  };

  const handleSearch = () => {
    const raw = unmask(inputValue);
    if (mode === "cpf" && raw.length === 11) {
      searchProfile("cpf", raw);
    } else if (mode === "phone" && raw.length >= 10) {
      searchProfile("phone", raw);
    } else if (mode === "id" && inputValue.trim().length > 10) {
      searchProfile("id", inputValue.trim());
    }
  };

  // QR scanner mode
  useEffect(() => {
    if (mode !== "qr") return;
    let scanner: any = null;
    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        scanner = new Html5Qrcode("waiter-qr-reader");
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 220 },
          (decoded: string) => {
            scanner?.stop();
            // Expect a profile ID or URL with profile ID
            const profileId = decoded.includes("/") ? decoded.split("/").pop() : decoded;
            if (profileId) {
              searchProfile("id", profileId);
            }
          },
          () => {}
        );
      } catch (e) {
        toast.error("Não foi possível acessar a câmera");
        setMode("menu");
      }
    };
    startScanner();
    return () => {
      scanner?.stop?.().catch(() => {});
    };
  }, [mode]);

  if (mode === "qr") {
    return (
      <div className="flex flex-col gap-4">
        <button onClick={() => setMode("menu")} className="flex items-center gap-1 text-sm text-muted-foreground w-fit">
          <ChevronLeft className="h-4 w-4" /> Voltar
        </button>
        <h2 className="text-lg font-bold">Escaneie o QR do perfil</h2>
        <div id="waiter-qr-reader" className="w-full rounded-2xl overflow-hidden" />
        {searching && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Buscando cliente...
          </div>
        )}
      </div>
    );
  }

  if (mode !== "menu") {
    const config = {
      cpf: { label: "CPF", placeholder: "000.000.000-00", mask: maskCPF, icon: CreditCard },
      phone: { label: "Telefone", placeholder: "(11) 98765-4321", mask: maskPhone, icon: Phone },
      id: { label: "ID do cliente", placeholder: "UUID do perfil", mask: null, icon: Hash },
    }[mode]!;

    return (
      <div className="flex flex-col gap-4">
        <button onClick={() => { setMode("menu"); setInputValue(""); setNotFound(false); }} className="flex items-center gap-1 text-sm text-muted-foreground w-fit">
          <ChevronLeft className="h-4 w-4" /> Voltar
        </button>
        <h2 className="text-lg font-bold">Buscar por {config.label}</h2>
        <Input
          placeholder={config.placeholder}
          value={inputValue}
          onChange={(e) => {
            setNotFound(false);
            setInputValue(config.mask ? config.mask(e.target.value) : e.target.value);
          }}
          className="h-12 rounded-xl text-base bg-white/[0.04] border-white/[0.08]"
          autoFocus
          inputMode={mode === "id" ? "text" : "numeric"}
        />
        <Button
          onClick={handleSearch}
          disabled={searching}
          className="h-14 rounded-xl text-base font-semibold w-full"
        >
          {searching ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Search className="h-5 w-5 mr-2" />}
          Buscar
        </Button>

        {notFound && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 text-center space-y-3">
            <p className="text-sm text-muted-foreground">Cliente não encontrado</p>
            <Button variant="outline" onClick={onSkip} className="h-12 rounded-xl w-full">
              Continuar como avulso
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center py-4">
        <UserCheck className="h-16 w-16 mx-auto text-primary/60 mb-3" />
        <h2 className="text-xl font-bold">Identificar cliente</h2>
        <p className="text-sm text-muted-foreground mt-1">Opcional — identifique o cliente para vincular o pedido</p>
      </div>

      <div className="flex flex-col gap-3">
        {[
          { id: "qr" as const, icon: ScanLine, label: "Ler QR do Perfil", desc: "Escaneie o QR Code do app do cliente" },
          { id: "cpf" as const, icon: CreditCard, label: "Digitar CPF", desc: "Buscar pelo CPF cadastrado" },
          { id: "phone" as const, icon: Phone, label: "Digitar Telefone", desc: "Buscar pelo número de celular" },
          { id: "id" as const, icon: Hash, label: "Digitar ID", desc: "Buscar pelo ID do perfil" },
        ].map((opt) => (
          <button
            key={opt.id}
            onClick={() => setMode(opt.id)}
            className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 text-left active:scale-[0.98] transition-transform"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <opt.icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{opt.label}</p>
              <p className="text-xs text-muted-foreground">{opt.desc}</p>
            </div>
          </button>
        ))}
      </div>

      <Button
        variant="outline"
        onClick={onSkip}
        className="h-14 rounded-xl text-base font-semibold mt-2 border-white/[0.08]"
      >
        <UserX className="h-5 w-5 mr-2" />
        Pular — Pedido Avulso
      </Button>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// STEP 2 — Catalog
// ═══════════════════════════════════════════════════
function StepCatalog({
  eventId,
  clientId,
  consumer,
  onBack,
  onContinue,
  cartItems,
  setCartItems,
}: {
  eventId: string;
  clientId: string;
  consumer: IdentifiedClient | null;
  onBack: () => void;
  onContinue: () => void;
  cartItems: CartItem[];
  setCartItems: (items: CartItem[]) => void;
}) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<string[]>(["Todos"]);
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId || !clientId) return;
    const fetchCatalog = async () => {
      setLoading(true);

      const { data: eventCatalogs } = await supabase
        .from("event_catalogs")
        .select("catalog_id")
        .eq("event_id", eventId)
        .eq("is_active", true);

      if (!eventCatalogs?.length) { setLoading(false); return; }
      const catalogIds = eventCatalogs.map((ec) => ec.catalog_id);

      const { data: catalogItems } = await supabase
        .from("catalog_items")
        .select(`
          id, item_type, product_id, combo_id,
          products:product_id (id, name, price, image_path, category_id, is_stock_tracked, categories:category_id (name)),
          combos:combo_id (id, name, price)
        `)
        .in("catalog_id", catalogIds)
        .eq("is_active", true);

      const { data: stockBalances } = await supabase
        .from("stock_balances")
        .select("product_id, quantity_available")
        .eq("client_id", clientId);

      const stockMap: Record<string, number> = {};
      stockBalances?.forEach((sb) => { stockMap[sb.product_id] = sb.quantity_available; });

      const items: CatalogProduct[] = [];
      const catSet = new Set<string>();

      catalogItems?.forEach((ci: any) => {
        if (ci.item_type === "product" && ci.products) {
          const p = ci.products;
          const catName = p.categories?.name || null;
          if (catName) catSet.add(catName);
          items.push({
            id: p.id, type: "product", name: p.name, price: Number(p.price),
            category_name: catName,
            image_path: p.image_path,
            stock_available: p.is_stock_tracked ? (stockMap[p.id] ?? 0) : null,
          });
        } else if (ci.item_type === "combo" && ci.combos) {
          const c = ci.combos;
          catSet.add("Combos");
          items.push({
            id: c.id, type: "combo", name: c.name, price: Number(c.price),
            category_name: "Combos", image_path: null, stock_available: null,
          });
        }
      });

      items.sort((a, b) => a.name.localeCompare(b.name));
      setCategories(["Todos", ...Array.from(catSet).sort()]);
      setProducts(items);
      setLoading(false);
    };
    fetchCatalog();
  }, [eventId, clientId]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchCat = activeCategory === "Todos" || p.category_name === activeCategory;
      const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [products, activeCategory, search]);

  const cartMap = useMemo(() => {
    const m: Record<string, number> = {};
    cartItems.forEach((i) => { m[i.id] = i.quantity; });
    return m;
  }, [cartItems]);

  const addItem = (p: CatalogProduct) => {
    const existing = cartItems.find((i) => i.id === p.id);
    if (existing) {
      setCartItems(cartItems.map((i) => i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCartItems([...cartItems, { id: p.id, type: p.type, name: p.name, price: p.price, quantity: 1 }]);
    }
  };

  const decreaseItem = (id: string) => {
    const item = cartItems.find((i) => i.id === id);
    if (!item) return;
    if (item.quantity <= 1) {
      setCartItems(cartItems.filter((i) => i.id !== id));
    } else {
      setCartItems(cartItems.map((i) => i.id === id ? { ...i, quantity: i.quantity - 1 } : i));
    }
  };

  const increaseItem = (id: string) => {
    setCartItems(cartItems.map((i) => i.id === id ? { ...i, quantity: i.quantity + 1 } : i));
  };

  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <div className="flex flex-col gap-4 pb-24">
      {/* Back + consumer info */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Voltar
        </button>
        {consumer && (
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {consumer.name}
          </span>
        )}
      </div>

      <h2 className="text-xl font-bold">Monte o pedido</h2>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar produto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-12 rounded-2xl border-white/[0.08] bg-white/[0.04] pl-11 text-base"
        />
      </div>

      {/* Category pills */}
      {categories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-all active:scale-95",
                activeCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-white/[0.06] border border-white/[0.08] text-muted-foreground"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">Nenhum produto encontrado</p>
        </div>
      )}

      {/* Product grid */}
      {!loading && (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((product) => {
            const qty = cartMap[product.id] || 0;
            const outOfStock = product.stock_available !== null && product.stock_available <= 0;

            return (
              <div
                key={product.id}
                className={cn(
                  "relative flex flex-col rounded-2xl bg-white/[0.04] border border-white/[0.06] overflow-hidden active:scale-[0.98] transition-transform",
                  outOfStock && "opacity-50"
                )}
              >
                <div className="relative aspect-square w-full bg-white/[0.02] overflow-hidden">
                  {product.image_path ? (
                    <img
                      src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/product-images/${product.image_path}`}
                      alt={product.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <span className="text-4xl">{product.type === "combo" ? "🪣" : "🍺"}</span>
                    </div>
                  )}
                  {outOfStock && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                      <span className="text-xs font-bold text-destructive">Esgotado</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1 p-3">
                  <h3 className="text-[13px] font-semibold text-foreground line-clamp-2 leading-tight">{product.name}</h3>
                  <span className="text-[15px] font-bold text-primary">R$ {product.price.toFixed(2)}</span>
                </div>
                {!outOfStock && qty === 0 && (
                  <button
                    onClick={() => addItem(product)}
                    className="absolute bottom-[52px] right-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_4px_16px_hsl(24,100%,50%,0.4)] active:scale-90 transition-transform"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                )}
                {!outOfStock && qty > 0 && (
                  <div className="flex items-center justify-between w-full px-2 py-1.5 border-t border-white/[0.06]">
                    <button onClick={() => decreaseItem(product.id)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-foreground active:scale-90 transition-transform">
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-bold text-foreground">{qty}</span>
                    <button onClick={() => increaseItem(product.id)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground active:scale-90 transition-transform">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Floating cart bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-[76px] left-0 right-0 z-40 px-5">
          <div className="mx-auto max-w-[480px]">
            <button
              onClick={onContinue}
              className="flex h-14 w-full items-center justify-between rounded-2xl bg-primary px-5 shadow-xl active:scale-[0.98] transition-transform"
              style={{ boxShadow: "0 8px 32px hsl(24 100% 50% / 0.35)" }}
            >
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-foreground/20 text-xs font-bold text-primary-foreground">
                  {cartCount}
                </div>
                <span className="text-[15px] font-semibold text-primary-foreground">Continuar</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[15px] font-bold text-primary-foreground">
                  R$ {cartTotal.toFixed(2)}
                </span>
                <ArrowRight className="h-4 w-4 text-primary-foreground/70" />
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// STEP 3 — Payment
// ═══════════════════════════════════════════════════
function StepPayment({
  eventId,
  clientId,
  consumer,
  cartItems,
  sessionId,
  onBack,
  onDone,
}: {
  eventId: string;
  clientId: string;
  consumer: IdentifiedClient | null;
  cartItems: CartItem[];
  sessionId: string;
  onBack: () => void;
  onDone: (cashAdded: number) => void;
}) {
  const navigate = useNavigate();
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [cashReceived, setCashReceived] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<{ orderId: string; qrToken: string; orderNumber?: number } | null>(null);

  const total = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const cashValue = parseFloat(cashReceived.replace(",", ".")) || 0;
  const change = cashValue - total;

  const handleSubmit = async () => {
    if (!paymentMethod) {
      toast.error("Selecione a forma de pagamento");
      return;
    }
    if (paymentMethod === "cash" && cashValue < total) {
      toast.error("Valor recebido insuficiente");
      return;
    }

    setSubmitting(true);

    const items = cartItems.map((i) => ({
      [i.type === "product" ? "product_id" : "combo_id"]: i.id,
      quantity: i.quantity,
    }));

    const params: any = {
      event_id: eventId,
      items,
      payment_method: paymentMethod === "pos" ? "pos" : paymentMethod,
    };
    if (consumer) params.consumer_id = consumer.id;

    const { data, error } = await supabase.rpc("create_waiter_order", { params });

    setSubmitting(false);

    if (error) {
      console.error("create_waiter_order error:", error);
      toast.error("Erro ao criar pedido");
      return;
    }

    const result = data as any;
    if (!result?.ok) {
      toast.error(result?.error || "Erro ao criar pedido");
      return;
    }

    toast.success("Pedido criado com sucesso!");
    setOrderResult({
      orderId: result.order_id,
      qrToken: result.qr_token,
    });

    onDone(paymentMethod === "cash" ? total : 0);
  };

  // Success screen
  if (orderResult) {
    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15">
          <PartyPopper className="h-10 w-10 text-emerald-400" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold">Pedido criado!</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {consumer ? `Cliente: ${consumer.name}` : "Pedido avulso"}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4">
          <QRCodeSVG value={orderResult.qrToken} size={180} />
        </div>
        <p className="text-xs text-muted-foreground">QR Code para retirada</p>

        <div className="flex flex-col gap-3 w-full mt-4">
          <Button
            className="h-14 rounded-xl text-base font-semibold w-full"
            onClick={() => navigate("/garcom/pedidos")}
          >
            Ver meus pedidos
          </Button>
          <Button
            variant="outline"
            className="h-14 rounded-xl text-base font-semibold w-full border-white/[0.08]"
            onClick={() => navigate("/garcom/pedido")}
          >
            Novo pedido
          </Button>
        </div>
      </div>
    );
  }

  const paymentOptions = [
    ...(consumer
      ? [{ id: "consumer_app", icon: Smartphone, label: "Cobrar pelo app do cliente", desc: "Pedido aparece no app para pagamento" }]
      : []),
    { id: "cash", icon: Banknote, label: "Dinheiro", desc: "Receber em espécie" },
    { id: "pos", icon: CreditCardIcon, label: "Maquininha (POS)", desc: "Cartão de crédito/débito" },
    { id: "pix", icon: DollarSign, label: "PIX", desc: "QR Code PIX" },
  ];

  return (
    <div className="flex flex-col gap-4 pb-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground w-fit">
        <ChevronLeft className="h-4 w-4" /> Voltar
      </button>

      <h2 className="text-xl font-bold">Pagamento</h2>

      {/* Order summary */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Resumo do pedido</p>
        {cartItems.map((item) => (
          <div key={item.id} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {item.quantity}x {item.name}
            </span>
            <span className="text-foreground font-medium">
              R$ {(item.price * item.quantity).toFixed(2)}
            </span>
          </div>
        ))}
        <div className="border-t border-white/[0.06] pt-3 flex items-center justify-between">
          <span className="text-base font-bold text-foreground">Total</span>
          <span className="text-lg font-bold text-primary">R$ {total.toFixed(2)}</span>
        </div>
      </div>

      {consumer && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">{consumer.name}</p>
            <p className="text-xs text-muted-foreground">
              {consumer.cpf ? `CPF: ***.***.${consumer.cpf.slice(-5)}` : "Cliente identificado"}
            </p>
          </div>
        </div>
      )}

      {/* Payment method selection */}
      <p className="text-sm font-semibold text-foreground">Forma de pagamento</p>
      <div className="flex flex-col gap-3">
        {paymentOptions.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setPaymentMethod(opt.id)}
            className={cn(
              "flex items-center gap-4 rounded-2xl border p-4 text-left active:scale-[0.98] transition-all",
              paymentMethod === opt.id
                ? "border-primary bg-primary/10"
                : "border-white/[0.06] bg-white/[0.03]"
            )}
          >
            <div className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
              paymentMethod === opt.id ? "bg-primary/20" : "bg-white/[0.06]"
            )}>
              <opt.icon className={cn("h-6 w-6", paymentMethod === opt.id ? "text-primary" : "text-muted-foreground")} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{opt.label}</p>
              <p className="text-xs text-muted-foreground">{opt.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Cash input */}
      {paymentMethod === "cash" && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-3">
          <label className="text-sm font-semibold text-foreground">Valor recebido</label>
          <Input
            placeholder="0,00"
            value={cashReceived}
            onChange={(e) => setCashReceived(e.target.value)}
            className="h-12 rounded-xl text-lg font-bold text-center bg-white/[0.04] border-white/[0.08]"
            inputMode="decimal"
            autoFocus
          />
          {cashValue >= total && (
            <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
              <span className="text-sm text-muted-foreground">Troco</span>
              <span className="text-lg font-bold text-emerald-400">R$ {change.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      {/* Consumer app info */}
      {paymentMethod === "consumer_app" && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm text-muted-foreground">
            O pedido será enviado para o app do cliente. Ele poderá pagar por lá com PIX ou cartão.
            O pedido ficará com status "pendente" até o pagamento.
          </p>
        </div>
      )}

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={!paymentMethod || submitting}
        className="h-14 rounded-xl text-base font-semibold w-full mt-2"
      >
        {submitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
        Finalizar Pedido · R$ {total.toFixed(2)}
      </Button>
    </div>
  );
}

// Fix: the original default export had a bug, replace it
export default WaiterNovoPedidoPage;
