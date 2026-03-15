import { type ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n/use-translation";

interface ModalFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  saving?: boolean;
  submitLabel?: string;
  disabled?: boolean;
}

export function ModalForm({
  open,
  onOpenChange,
  title,
  children,
  onSubmit,
  saving = false,
  submitLabel,
  disabled = false,
}: ModalFormProps) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto bg-card/95 backdrop-blur-sm border-border/60">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {children}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              className="flex-1 glow-hover"
              disabled={saving || disabled}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitLabel ?? t("save")}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
