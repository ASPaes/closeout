import { cn } from "@/lib/utils";
import { ChevronRight, ShoppingBag, DollarSign, CalendarDays } from "lucide-react";
import { ReactNode } from "react";

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

const iconBgMap: Record<string, string> = {
  orders: "bg-primary/15",
  spent: "bg-green-500/15",
  events: "bg-blue-500/15",
};

const iconColorMap: Record<string, string> = {
  orders: "text-primary",
  spent: "text-green-400",
  events: "text-blue-400",
};

export function ProfileStatsRow({ stats }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {stats.map((stat) => {
        const Icon = iconMap[stat.icon] || ShoppingBag;
        return (
          <button
            key={stat.label}
            onClick={stat.onClick}
            className="flex items-center gap-3 rounded-2xl border border-border/30 bg-card p-4 active:bg-secondary/60 transition-colors text-left w-full min-h-[56px]"
          >
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl shrink-0",
                iconBgMap[stat.icon]
              )}
            >
              <Icon className={cn("h-5 w-5", iconColorMap[stat.icon])} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-base font-bold text-foreground leading-tight">{stat.value}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
          </button>
        );
      })}
    </div>
  );
}
