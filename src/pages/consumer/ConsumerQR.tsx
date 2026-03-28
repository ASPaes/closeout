import { QRCodeSVG } from "qrcode.react";
import { Clock, CheckCircle2, Package, ChefHat, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConsumer } from "@/contexts/ConsumerContext";
import { useTranslation } from "@/i18n/use-translation";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

const statusConfig: Record<string, { label: string; sublabel: string; icon: any; color: string; bgColor: string; borderColor: string; step: number }> = {
  paid: {
    label: "Pedido Confirmado",
    sublabel: "Aguardando preparo",
    icon: CheckCircle2,
    color: "text-info",
    bgColor: "bg-info/10",
    borderColor: "border-info/30",
    step: 1,
  },
  preparing: {
    label: "Em Preparo",
    sublabel: "Seu pedido está sendo preparado",
    icon: ChefHat,
    color: "text-warning",
    bgColor: "bg-warning/10",
    borderColor: "border-warning/30",
    step: 2,
  },
  ready: {
    label: "Pronto para Retirada!",
    sublabel: "Apresente o QR Code no balcão",
    icon: Package,
    color: "text-success",
    bgColor: "bg-success/10",
    borderColor: "border-success/30",
    step: 3,
  },
};

const steps = [
  { key: "paid", label: "Confirmado" },
  { key: "preparing", label: "Preparo" },
  { key: "ready", label: "Pronto" },
];

export default function ConsumerQR() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeOrder, loadingOrder } = useConsumer();

  if (loadingOrder) {
    return (
      <div className="flex flex-col items-center gap-5 py-8">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-[260px] w-[260px] rounded-3xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (!activeOrder) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.04] border border-white/[0.06]">
          <Inbox className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">{t("consumer_qr_title")}</h2>
          <p className="text-sm text-muted-foreground mt-1">Nenhum pedido ativo no momento</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/app/cardapio")} className="rounded-xl h-12">
          {t("consumer_tab_menu")}
        </Button>
      </div>
    );
  }

  const config = statusConfig[activeOrder.status] || statusConfig.paid;
  const StatusIcon = config.icon;

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Status banner */}
      <div className={cn("w-full rounded-2xl border p-4 text-center", config.bgColor, config.borderColor)}>
        <StatusIcon className={cn("mx-auto h-8 w-8 mb-2", config.color)} />
        <h1 className={cn("text-lg font-bold", config.color)}>{config.label}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{config.sublabel}</p>
      </div>

      {/* Progress steps */}
      <div className="flex w-full items-center justify-between px-4">
        {steps.map((step, i) => {
          const isActive = config.step >= i + 1;
          const isCurrent = config.step === i + 1;
          return (
            <div key={step.key} className="flex flex-col items-center gap-1.5 flex-1">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all",
                  isCurrent
                    ? "bg-primary text-primary-foreground shadow-[0_0_12px_hsl(24,100%,50%,0.4)] scale-110"
                    : isActive
                    ? "bg-primary/20 text-primary"
                    : "bg-secondary text-muted-foreground"
                )}
              >
                {i + 1}
              </div>
              <span className={cn("text-[10px] font-medium", isActive ? "text-foreground" : "text-muted-foreground")}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* QR Code */}
      <div
        className="relative rounded-3xl border border-border/60 bg-card p-6"
        style={{ boxShadow: activeOrder.status === "ready" ? "0 0 40px hsl(145 100% 39% / 0.15)" : undefined }}
      >
        <div className="rounded-2xl bg-white p-4">
          <QRCodeSVG
            value={activeOrder.qr_token}
            size={200}
            level="H"
            bgColor="#ffffff"
            fgColor="#0A0A0A"
          />
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Pedido <span className="font-bold text-primary">#{String(activeOrder.order_number).padStart(3, "0")}</span>
        </p>
      </div>

      {/* Order summary */}
      <div className="w-full rounded-2xl border border-border/60 bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Resumo do Pedido</h3>
        <div className="flex flex-col gap-2">
          {activeOrder.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {item.quantity}x {item.name}
              </span>
              <span className="text-sm font-medium text-foreground">
                R$ {(item.quantity * item.unit_price).toFixed(2)}
              </span>
            </div>
          ))}
          <div className="mt-2 border-t border-border/40 pt-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Total</span>
            <span className="text-base font-bold text-primary">R$ {activeOrder.total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
