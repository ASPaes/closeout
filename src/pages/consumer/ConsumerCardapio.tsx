import { useState } from "react";
import { Search, Plus, Minus, ShoppingCart, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

const categories = ["Todos", "Cervejas", "Drinks", "Shots", "Combos", "Sem Álcool"];

const mockProducts = [
  { id: "1", name: "Heineken 600ml", price: 18.0, category: "Cervejas", emoji: "🍺", popular: true, desc: "Cerveja premium importada" },
  { id: "2", name: "Brahma Chopp 300ml", price: 10.0, category: "Cervejas", emoji: "🍻", desc: "Chopp gelado" },
  { id: "3", name: "Gin Tônica", price: 28.0, category: "Drinks", emoji: "🍸", popular: true, desc: "Gin, tônica, limão e especiarias" },
  { id: "4", name: "Caipirinha Clássica", price: 22.0, category: "Drinks", emoji: "🍹", desc: "Cachaça, limão e açúcar" },
  { id: "5", name: "Tequila Shot", price: 15.0, category: "Shots", emoji: "🥃", desc: "Shot 50ml com limão e sal" },
  { id: "6", name: "Jägerbomb", price: 20.0, category: "Shots", emoji: "💣", popular: true, desc: "Jägermeister + energético" },
  { id: "7", name: "Combo Balde 5 Heineken", price: 75.0, category: "Combos", emoji: "🪣", desc: "5 long necks no balde de gelo" },
  { id: "8", name: "Combo Casal — 2 Drinks", price: 45.0, category: "Combos", emoji: "💑", desc: "2 drinks à escolha" },
  { id: "9", name: "Red Bull", price: 16.0, category: "Sem Álcool", emoji: "⚡", desc: "Energético 250ml" },
  { id: "10", name: "Água Mineral", price: 6.0, category: "Sem Álcool", emoji: "💧", desc: "Garrafa 500ml" },
];

export default function ConsumerCardapio() {
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const navigate = useNavigate();

  const filtered = mockProducts.filter((p) => {
    const matchCat = activeCategory === "Todos" || p.category === activeCategory;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const p = mockProducts.find((x) => x.id === id);
    return sum + (p?.price ?? 0) * qty;
  }, 0);

  const addItem = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const removeItem = (id: string) =>
    setCart((c) => {
      const next = { ...c };
      if (next[id] > 1) next[id]--;
      else delete next[id];
      return next;
    });

  return (
    <div className="flex flex-col gap-5 pb-4">
      {/* Large title */}
      <div>
        <h1 className="text-[28px] font-extrabold text-foreground leading-tight tracking-tight">
          Cardápio
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Neon Nights — Club Aurora</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar produto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-12 rounded-2xl border-white/[0.08] bg-white/[0.04] pl-11 text-base placeholder:text-muted-foreground/60 focus-visible:ring-primary/30"
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-all active:scale-95",
              activeCategory === cat
                ? "bg-primary text-primary-foreground shadow-[0_0_16px_hsl(24,100%,50%,0.25)]"
                : "bg-white/[0.06] border border-white/[0.08] text-muted-foreground"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Product list — Keeta style */}
      <div className="flex flex-col gap-4">
        {filtered.map((product) => {
          const qty = cart[product.id] || 0;
          return (
            <div
              key={product.id}
              className="flex items-center gap-3 active:opacity-90 transition-opacity"
            >
              {/* Text content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-[15px] font-semibold text-foreground truncate">{product.name}</h3>
                  {product.popular && (
                    <span className="text-[10px]">🔥</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{product.desc}</p>
                <p className="text-[15px] font-bold text-primary mt-1">
                  R$ {product.price.toFixed(2)}
                </p>
              </div>

              {/* Image + action */}
              <div className="relative shrink-0">
                <div className="flex h-[72px] w-[72px] items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.06] text-3xl select-none">
                  {product.emoji}
                </div>

                {/* Add / stepper overlay at bottom-right of image */}
                {qty === 0 ? (
                  <button
                    onClick={() => addItem(product.id)}
                    className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-90 transition-transform"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                ) : (
                  <div className="absolute -bottom-2 -right-2 flex items-center gap-0.5 rounded-full bg-primary shadow-lg">
                    <button
                      onClick={() => removeItem(product.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-primary-foreground active:scale-90 transition-transform"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-[20px] text-center text-sm font-bold text-primary-foreground">
                      {qty}
                    </span>
                    <button
                      onClick={() => addItem(product.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-primary-foreground active:scale-90 transition-transform"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Checkout bar — fixed above tab bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-[76px] left-0 right-0 z-40 px-5">
          <div className="mx-auto max-w-[480px]">
            <button
              onClick={() => navigate("/app/carrinho")}
              className="flex h-14 w-full items-center justify-between rounded-2xl bg-primary px-5 shadow-xl active:scale-[0.98] transition-transform"
              style={{ boxShadow: "0 8px 32px hsl(24 100% 50% / 0.35)" }}
            >
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-foreground/20 text-xs font-bold text-primary-foreground">
                  {cartCount}
                </div>
                <span className="text-[15px] font-semibold text-primary-foreground">
                  Finalizar
                </span>
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
