import { type ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  /** "wide" = centered dialog (default), "compact" = narrower centered dialog */
  size?: "wide" | "compact";
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
  size = "default",
}: ModalFormProps) {
  const { t } = useTranslation();

  const formContent = (
    <form onSubmit={onSubmit} className="space-y-4">
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
  );

  if (size === "wide") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[1000px] w-[95vw] max-h-[90vh] p-0 bg-card/95 backdrop-blur-sm border-border/60 flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 px-6 pb-6 pt-2">
            {formContent}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto bg-card/95 backdrop-blur-sm border-border/60">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="mt-6">
          {formContent}
        </div>
      </SheetContent>
    </Sheet>
  );
}
