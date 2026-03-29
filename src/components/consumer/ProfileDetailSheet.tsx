import { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
};

export function ProfileDetailSheet({ open, onOpenChange, title, children }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="dark rounded-t-3xl border-t border-white/[0.08] bg-background/95 backdrop-blur-xl px-4 pb-24 pt-4 max-h-[85dvh] overflow-y-auto"
      >
        <SheetHeader className="mb-4">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/10" />
          <SheetTitle className="text-foreground text-lg font-bold text-center">
            {title}
          </SheetTitle>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}
