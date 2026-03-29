import { cn } from "@/lib/utils";

type StatItem = {
  label: string;
  value: string | number;
};

type Props = {
  stats: [StatItem, StatItem, StatItem];
};

export function ProfileStatsRow({ stats }: Props) {
  return (
    <div className="flex items-stretch rounded-2xl border border-border/40 bg-card overflow-hidden">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={cn(
            "flex flex-1 flex-col items-center justify-center py-3.5",
            i > 0 && "border-l border-border/30"
          )}
        >
          <span className="text-lg font-bold text-foreground leading-none">{stat.value}</span>
          <span className="mt-1 text-[11px] text-muted-foreground uppercase tracking-wider">
            {stat.label}
          </span>
        </div>
      ))}
    </div>
  );
}
