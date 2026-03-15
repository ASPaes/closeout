import { type ReactNode } from "react";
import { type LucideIcon, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: LucideIcon;
  message: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
}

export function EmptyState({ icon: Icon = Inbox, message, hint, actionLabel, onAction, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in">
      <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Icon className="h-7 w-7 text-primary/60" />
      </div>
      <p className="text-base font-medium text-foreground/80">{message}</p>
      {hint && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{hint}</p>}
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-4 glow-hover" size="sm">
          {actionLabel}
        </Button>
      )}
      {children}
    </div>
  );
}
