import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";

type ReceiptItem = {
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
};

type SaleData = {
  orderNumber: number;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  qrToken?: string;
};

type ReturnData = {
  orderNumber: number;
  items: ReceiptItem[];
  refundAmount: number;
  reason: string;
  occurrenceType: string;
  authorizedBy: string;
};

type ExchangeData = {
  orderNumber: number;
  originalItem: { name: string; price: number };
  newItem: { name: string; price: number };
  priceDifference: number;
  adjustmentDirection: string;
};

type MovementData = {
  movementType: string;
  direction: string;
  amount: number;
  destination: string;
  notes?: string;
};

type ClosingData = {
  openingBalance: number;
  totalSales: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalReturns: number;
  expectedBalance: number;
  physicalBalance: number;
  difference: number;
  byPayment?: Record<string, { count: number; total: number }>;
  notes?: string;
};

type ReceiptProps = {
  type: "sale" | "return" | "exchange" | "movement" | "closing";
  data: SaleData | ReturnData | ExchangeData | MovementData | ClosingData;
  eventName?: string;
  operatorName?: string;
  venueName?: string;
  venueAddress?: string;
};

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const now = () => new Date().toLocaleString("pt-BR");

const MOVEMENT_LABELS: Record<string, string> = {
  sangria: "SANGRIA",
  suprimento: "SUPRIMENTO",
  pagamento: "PAGAMENTO",
  outro: "MOVIMENTAÇÃO",
};

const DIRECTION_LABELS: Record<string, string> = {
  in: "ENTRADA",
  out: "SAÍDA",
};

function SingleTicket({
  itemName,
  qty,
  unitPrice,
  orderNumber,
  operatorName,
  venueName,
}: {
  itemName: string;
  qty?: number;
  unitPrice?: number;
  orderNumber?: number;
  operatorName?: string;
  venueName?: string;
}) {
  return (
    <div className="party-ticket">
      {venueName && <p className="ticket-venue">{venueName}</p>}
      <p className="ticket-product-name">{itemName}</p>
      {qty != null && <p className="ticket-meta">Qtd: {qty}</p>}
      {unitPrice != null && (
        <p className="ticket-price">Valor: {fmt(unitPrice)}</p>
      )}
      <div className="ticket-info">
        <p>{now()}</p>
        {orderNumber != null && <p>Pedido #{orderNumber}</p>}
        {operatorName && <p>{operatorName}</p>}
      </div>
      <div className="ticket-cta">
        <p>NÃO PERCA TEMPO E INSTALE</p>
        <p>O APP AGORA MESMO</p>
        <p className="ticket-brand">CLOSE OUT</p>
      </div>
    </div>
  );
}

function MovementTicket({
  data,
  operatorName,
  venueName,
}: {
  data: MovementData;
  operatorName?: string;
  venueName?: string;
}) {
  const title = MOVEMENT_LABELS[data.movementType] || "MOVIMENTAÇÃO";
  return (
    <div className="party-ticket">
      {venueName && <p className="ticket-venue">{venueName}</p>}
      <p className="ticket-product-name">{title}</p>
      <p className="ticket-meta">{DIRECTION_LABELS[data.direction] || data.direction}</p>
      <p className="ticket-price">{fmt(data.amount)}</p>
      <p className="ticket-meta">Destino: {data.destination}</p>
      {data.notes && <p className="ticket-meta">Obs: {data.notes}</p>}
      <div className="ticket-info">
        <p>{now()}</p>
        {operatorName && <p>{operatorName}</p>}
      </div>
      <div className="ticket-cta">
        <p>CLOSE OUT</p>
      </div>
    </div>
  );
}

function ClosingTicket({
  data,
  operatorName,
  venueName,
}: {
  data: ClosingData;
  operatorName?: string;
  venueName?: string;
}) {
  return (
    <div className="party-ticket">
      {venueName && <p className="ticket-venue">{venueName}</p>}
      <p className="ticket-product-name">FECHAMENTO</p>
      <div className="ticket-closing-rows">
        <div className="ticket-row"><span>Abertura</span><span>{fmt(data.openingBalance)}</span></div>
        <div className="ticket-row"><span>Vendas</span><span>{fmt(data.totalSales)}</span></div>
        <div className="ticket-row"><span>Depósitos</span><span>{fmt(data.totalDeposits)}</span></div>
        <div className="ticket-row"><span>Sangrias</span><span>{fmt(data.totalWithdrawals)}</span></div>
        <div className="ticket-row"><span>Devoluções</span><span>{fmt(data.totalReturns)}</span></div>
        <div className="ticket-row ticket-row-bold"><span>Esperado</span><span>{fmt(data.expectedBalance)}</span></div>
        <div className="ticket-row ticket-row-bold"><span>Informado</span><span>{fmt(data.physicalBalance)}</span></div>
        <div className="ticket-row ticket-row-bold"><span>Diferença</span><span>{fmt(data.difference)}</span></div>
      </div>
      {data.notes && <p className="ticket-meta">Obs: {data.notes}</p>}
      <div className="ticket-info">
        <p>{now()}</p>
        {operatorName && <p>{operatorName}</p>}
      </div>
      <div className="ticket-cta">
        <p>CLOSE OUT</p>
      </div>
    </div>
  );
}

export const ThermalReceipt = forwardRef<HTMLDivElement, ReceiptProps>(
  ({ type, data, operatorName, venueName }, ref) => {
    const renderTickets = () => {
      if (type === "movement") {
        return <MovementTicket data={data as MovementData} operatorName={operatorName} venueName={venueName} />;
      }

      if (type === "closing") {
        return <ClosingTicket data={data as ClosingData} operatorName={operatorName} venueName={venueName} />;
      }

      // sale, return, exchange — print one ticket per item per quantity
      let items: ReceiptItem[] = [];
      let orderNumber: number | undefined;

      if (type === "sale") {
        const d = data as SaleData;
        items = d.items;
        orderNumber = d.orderNumber;
      } else if (type === "return") {
        const d = data as ReturnData;
        items = d.items;
        orderNumber = d.orderNumber;
      } else if (type === "exchange") {
        const d = data as ExchangeData;
        items = [
          { name: d.newItem.name, qty: 1, unitPrice: d.newItem.price, total: d.newItem.price },
        ];
        orderNumber = d.orderNumber;
      }

      const tickets: React.ReactNode[] = [];
      items.forEach((item, idx) => {
        for (let q = 0; q < item.qty; q++) {
          tickets.push(
            <SingleTicket
              key={`${idx}-${q}`}
              itemName={item.name}
              qty={1}
              unitPrice={item.unitPrice}
              orderNumber={orderNumber}
              operatorName={operatorName}
              venueName={venueName}
            />
          );
        }
      });

      return <>{tickets}</>;
    };

    return (
      <div ref={ref} className="party-ticket-root">
        {renderTickets()}
      </div>
    );
  }
);

ThermalReceipt.displayName = "ThermalReceipt";

export function printThermalReceipt() {
  window.print();
}
