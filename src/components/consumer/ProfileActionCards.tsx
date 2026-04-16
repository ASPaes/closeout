import { User, CalendarDays, Gauge, Shield, ChevronRight, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

type ActionItem = {
  key: string;
  label: string;
  icon: React.ElementType;
  accent?: string;
  onClick?: () => void;
};

const actions: ActionItem[] = [
  { key: "profile", label: "Meu perfil", icon: User, accent: "text-primary" },
  { key: "events", label: "Meus eventos", icon: CalendarDays, accent: "text-blue-400" },
  { key: "limits", label: "Meus limites", icon: Gauge, accent: "text-amber-400" },
  { key: "privacy", label: "Segurança e privacidade", icon: Shield, accent: "text-green-400" },
];

type Props = {
  onAction: (key: string) => void;
};

export function ProfileActionCards({ onAction }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <button
            key={a.key}
            onClick={() => onAction(a.key)}
            className={cn(
              "flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 backdrop-blur-sm",
              "active:scale-[0.99] active:bg-white/[0.06] transition-all min-h-[56px] w-full text-left"
            )}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05]">
              <Icon className={cn("h-5 w-5", a.accent)} />
            </div>
            <span className="flex-1 text-sm font-medium text-foreground">{a.label}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
          </button>
        );
      })}
    </div>
  );
}
