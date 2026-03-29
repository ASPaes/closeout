import { ShoppingBag, DollarSign, CalendarDays } from "lucide-react";
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
  return (
    <div className="grid grid-cols-3 gap-2">
      {stats.map((stat) => {
        const Icon = iconMap[stat.icon] || ShoppingBag;
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
