import { cn } from "@/lib/utils";
import { ReactNode, useState } from "react";

type Tab = { key: string; label: string; content: ReactNode };

type Props = { tabs: Tab[] };

export function ProfileSegmentedTabs({ tabs }: Props) {
  const [active, setActive] = useState(tabs[0]?.key || "");

  return (
    <div className="flex flex-col gap-3">
      {/* Segmented control */}
      <div className="flex rounded-xl bg-white/[0.04] p-1 border border-white/[0.06]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={cn(
              "flex-1 rounded-lg py-2 text-xs font-semibold transition-all min-h-[36px]",
              active === t.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground active:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tabs.find((t) => t.key === active)?.content}
    </div>
  );
}
