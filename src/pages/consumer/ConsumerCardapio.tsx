import { useState } from "react";
import { Search, Plus, Minus, ShoppingCart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

const categories = ["Todos", "Cervejas", "Drinks", "Shots", "Combos", "Sem Álcool"];

const mockProducts = [
  { id: "1", name: "Heineken 600ml", price: 18.0, category: "Cervejas", emoji: "🍺", popular: true },
  { id: "2", name: "Brahma Chopp 300ml", price: 10.0, category: "Cervejas", emoji: "🍻" },
  { id: "3", name: "Gin Tônica", price: 28.0, category: "Drinks", emoji: "🍸", popular: true },
  { id: "4", name: "Caipirinha Clássica", price: 22.0, category: "Drinks", emoji: "🍹" },
  { id: "5", name: "Tequila Shot", price: 15.0, category: "Shots", emoji: "🥃" },
  { id: "6", name: "Jägerbomb", price: 20.0, category: "Shots", emoji: "💣", popular: true },
  { id: "7", name: "Combo Balde 5 Heineken", price: 75.0, category: "Combos", emoji: "🪣" },
  { id: "8", name: "Combo Casal — 2 Drinks", price: 45.0, category: "Combos", emoji: "💑" },
  { id: "9", name: "Red Bull", price: 16.0, category: "Sem Álcool", emoji: "⚡" },
  { id: "10", name: "Água Mineral", price: 6.0, category: "Sem Álcool", emoji: "💧" },
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
    <div className="flex flex-col gap-4 pb-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Cardápio</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Neon Nights — Club Aurora</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar produto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 rounded-xl border-border/60 bg-card pl-10 text-base placeholder:text-muted-foreground"
        />
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-xs font-medium transition-all active:scale-95",
              activeCategory === cat
                ? "bg-primary text-primary-foreground shadow-[0_0_12px_hsl(24,100%,50%,0.3)]"
                : "bg-card border border-border/60 text-muted-foreground"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Products */}
      <div className="flex flex-col gap-2.5">
        {filtered.map((product) => {
          const qty = cart[product.id] || 0;
          return (
            <div
              key={product.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border bg-card p-3 transition-all",
                qty > 0 ? "border-primary/40" : "border-border/60"
              )}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-2xl shrink-0">
                {product.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold text-foreground truncate">{product.name}</h3>
                  {product.popular && (
                    <Badge variant="outline" className="text-[9px] border-primary/40 text-primary px-1 py-0">
                      🔥
                    </Badge>
                  )}
                </div>
                <p className="text-sm font-bold text-primary mt-0.5">
                  R$ {product.price.toFixed(2)}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {qty > 0 && (
                  <>
                    <button
                      onClick={() => removeItem(product.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-foreground active:scale-90 transition-transform"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-5 text-center text-sm font-bold text-foreground">{qty}</span>
                  </>
                )}
                <button
                  onClick={() => addItem(product.id)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg active:scale-90 transition-transform",
                    qty > 0
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/15 text-primary"
                  )}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating cart button */}
      {cartCount > 0 && (
        <div className="fixed bottom-20 left-0 right-0 z-40 px-4">
          <div className="mx-auto max-w-[480px]">
            <Button
              onClick={() => navigate("/app/carrinho")}
              className="h-14 w-full rounded-2xl bg-gradient-to-r from-primary to-primary-glow text-base font-semibold text-primary-foreground shadow-xl active:scale-[0.97] transition-transform"
              style={{ boxShadow: "0 8px 32px hsl(24 100% 50% / 0.4)" }}
            >
              <ShoppingCart className="mr-2 h-5 w-5" />
              Ver Carrinho ({cartCount}) · R$ {cartTotal.toFixed(2)}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
