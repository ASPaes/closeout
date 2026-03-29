import { Switch } from "@/components/ui/switch";
import { Shield, Info } from "lucide-react";

type Props = {
  isVisible: boolean;
  hasActiveCheckin: boolean;
  onToggle: (val: boolean) => void;
  loading?: boolean;
};

export function PrivacyCard({ isVisible, hasActiveCheckin, onToggle, loading }: Props) {
  return (
    <div className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-4 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
          <Shield className="h-4 w-4 text-primary" />
        </div>
        <span className="text-sm font-semibold text-foreground">
          Privacidade
        </span>
      </div>

      <div className="flex items-center justify-between min-h-[48px]">
        <div className="flex-1 pr-3">
          <p className="text-sm text-foreground">Aparecer na lista de presentes</p>
          {!hasActiveCheckin && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Info className="h-3 w-3 shrink-0" />
              Faça check-in para ativar
            </p>
          )}
        </div>
        <Switch
          checked={isVisible}
          onCheckedChange={onToggle}
          disabled={!hasActiveCheckin || loading}
        />
      </div>
    </div>
  );
}
