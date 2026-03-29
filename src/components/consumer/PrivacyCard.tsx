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
    <div className="rounded-2xl border border-border/40 bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="h-4.5 w-4.5 text-primary" />
        <span className="text-sm font-semibold text-foreground">Segurança e Privacidade</span>
      </div>

      <div className="flex items-center justify-between min-h-[48px]">
        <div className="flex-1 pr-3">
          <p className="text-sm text-foreground">Aparecer na lista de presentes</p>
          {!hasActiveCheckin && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Info className="h-3 w-3 shrink-0" />
              Faça check-in em um evento para ativar
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
