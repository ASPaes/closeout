import { QRCodeSVG } from "qrcode.react";
import { Clock, CheckCircle2, Package, ChefHat } from "lucide-react";
import { cn } from "@/lib/utils";

const mockActiveOrder = {
  id: "abc-123",
  order_number: 42,
  status: "ready" as const,
  total: 66.0,
  qr_token: "clsout_tk_a1b2c3d4e5f6g7h8i9j0",
  created_at: "2026-03-27T22:15:00",
  items: [
    { name: "Heineken 600ml", quantity: 2, unit_price: 18.0 },
    { name: "Gin Tônica", quantity: 1, unit_price: 28.0 },
  ],
};

const statusConfig = {
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
  const order = mockActiveOrder;
  const config = statusConfig[order.status];
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
              <span
                className={cn(
                  "text-[10px] font-medium",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    "absolute h-0.5 w-12",
                    isActive ? "bg-primary/40" : "bg-border"
                  )}
                  style={{ display: "none" }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* QR Code */}
      <div
        className="relative rounded-3xl border border-border/60 bg-card p-6"
        style={{ boxShadow: order.status === "ready" ? "0 0 40px hsl(145 100% 39% / 0.15)" : undefined }}
      >
        <div className="rounded-2xl bg-white p-4">
          <QRCodeSVG
            value={order.qr_token}
            size={200}
            level="H"
            bgColor="#ffffff"
            fgColor="#0A0A0A"
          />
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Pedido <span className="font-bold text-primary">#{String(order.order_number).padStart(3, "0")}</span>
        </p>
      </div>

      {/* Order summary */}
      <div className="w-full rounded-2xl border border-border/60 bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Resumo do Pedido</h3>
        <div className="flex flex-col gap-2">
          {order.items.map((item, i) => (
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
            <span className="text-base font-bold text-primary">R$ {order.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Time */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        Pedido realizado às 22:15
      </div>
    </div>
  );
}
