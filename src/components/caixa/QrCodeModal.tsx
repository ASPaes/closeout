import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Printer, X } from "lucide-react";
import { useTranslation } from "@/i18n/use-translation";

type Props = {
  open: boolean;
  onClose: () => void;
  token: string;
  orderNumber: number;
  onPrint: () => void;
};

export function QrCodeModal({ open, onClose, token, orderNumber, onPrint }: Props) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CheckCircle2 className="h-5 w-5 text-success" />
            {t("pos_order_confirmed" as any)}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <p className="text-sm text-muted-foreground text-center">
            {t("pos_qr_instruction" as any)}
          </p>

          <div className="bg-white p-4 rounded-xl">
            <QRCodeSVG value={token} size={200} level="M" />
          </div>

          <p className="text-2xl font-bold text-primary">
            #{String(orderNumber).padStart(3, "0")}
          </p>

          <div className="flex gap-3 w-full">
            <Button variant="outline" className="flex-1" onClick={onPrint}>
              <Printer className="h-4 w-4 mr-2" />
              {t("pos_print_qr")}
            </Button>
            <Button className="flex-1" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              {t("pos_next_sale")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
