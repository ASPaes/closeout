import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusVariant = "active" | "inactive" | "draft" | "completed" | "cancelled";

const variantConfig: Record<StatusVariant, { className: string }> = {
  active: { className: "bg-success/15 text-success border-success/25 hover:bg-success/25" },
  inactive: { className: "bg-muted text-muted-foreground border-border hover:bg-muted/80" },
  draft: { className: "bg-warning/15 text-warning border-warning/25 hover:bg-warning/25" },
  completed: { className: "bg-info/15 text-info border-info/25 hover:bg-info/25" },
  cancelled: { className: "bg-destructive/15 text-destructive border-destructive/25 hover:bg-destructive/25" },
};

interface StatusBadgeProps {
  status: StatusVariant;
  label: string;
  onClick?: () => void;
  className?: string;
}

export function StatusBadge({ status, label, onClick, className }: StatusBadgeProps) {
  const config = variantConfig[status] ?? variantConfig.inactive;
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium transition-colors duration-150 capitalize",
        config.className,
        onClick && "cursor-pointer",
        className,
      )}
      onClick={onClick}
    >
      {label}
    </Badge>
  );
}
