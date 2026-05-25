import { ShoppingBag, DollarSign, CalendarDays, Eye, EyeOff } from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

type StatCard = {
  label: string;
  value: string | number;
  icon: "orders" | "spent" | "events";
  onClick?: () => void;
};

type Props = {
  stats: StatCard[];
};

const iconMap: Record<string, React.ElementType> = {
  orders: ShoppingBag,
  spent: DollarSign,
  events: CalendarDays,
};

const accentMap: Record<string, string> = {
  orders: "text-primary",
  spent: "text-green-400",
  events: "text-blue-400",
};

export function ProfileStatsRow({ stats }: Props) {
  const [spentRevealed, setSpentRevealed] = useState(false);
  const [displayValue, setDisplayValue] = useState("");
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrambleAndReveal = useCallback((realValue: string) => {
    setSpentRevealed(true);
    let frame = 0;
    const totalFrames = 18;
    const interval = setInterval(() => {
      frame++;
      if (frame < totalFrames) {
        const rand = Math.floor(Math.random() * 9000) + 100;
        setDisplayValue("R$ " + rand.toLocaleString("pt-BR"));
      } else {
        setDisplayValue(realValue);
        clearInterval(interval);
      }
    }, 35);

    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setSpentRevealed(false), 5000);
  }, []);

  const handleSpentTap = useCallback((realValue: string) => {
    if (spentRevealed) {
      setSpentRevealed(false);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    } else {
      scrambleAndReveal(realValue);
    }
  }, [spentRevealed, scrambleAndReveal]);

  useEffect(() => {
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, []);

  return (
    <div className="grid grid-cols-3 gap-2">
      {stats.map((stat) => {
        const Icon = iconMap[stat.icon] || ShoppingBag;
        if (stat.icon === "spent") {
          return (
            <button
              key={stat.label}
              onClick={() => handleSpentTap(String(stat.value))}
              className={cn(
                "flex flex-col items-center gap-1 rounded-2xl border p-3 backdrop-blur-sm transition-all min-h-[76px] relative overflow-hidden",
                spentRevealed
                  ? "border-primary/30 bg-primary/[0.04]"
                  : "border-white/[0.06] bg-white/[0.03] active:bg-white/[0.08]"
              )}
            >
              <Icon className={cn("h-4.5 w-4.5", accentMap[stat.icon])} />
              <div className="relative">
                <span
                  className={cn(
                    "text-base font-bold text-foreground leading-tight transition-all duration-500 select-none",
                    !spentRevealed && "blur-[8px]"
                  )}
                >
                  {spentRevealed ? displayValue : stat.value}
                </span>
                {!spentRevealed && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <EyeOff className="h-4 w-4 text-muted-foreground/30" />
                  </span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground leading-tight">
                {stat.label}
              </span>
              {!spentRevealed && (
                <span className="text-[8px] text-muted-foreground/20 leading-tight">
                  toque para ver
                </span>
              )}
            </button>
          );
        }
        return (
          <button
            key={stat.label}
            onClick={stat.onClick}
            className="flex flex-col items-center gap-1 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 backdrop-blur-sm active:bg-white/[0.08] transition-colors min-h-[76px]"
          >
            <Icon className={cn("h-4.5 w-4.5", accentMap[stat.icon])} />
            <span className="text-base font-bold text-foreground leading-tight">
              {stat.value}
            </span>
            <span className="text-[10px] text-muted-foreground leading-tight">
              {stat.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
