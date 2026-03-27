import { forwardRef } from "react";

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

const SEP = "--------------------------------";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const now = () => {
  const d = new Date();
  return d.toLocaleString("pt-BR");
};

const TYPE_LABELS: Record<string, string> = {
  sale: "CUPOM DE VENDA",
  return: "CUPOM DE DEVOLUÇÃO",
  exchange: "CUPOM DE TROCA",
  movement: "COMPROVANTE DE MOVIMENTAÇÃO",
  closing: "RELATÓRIO DE FECHAMENTO",
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Dinheiro",
  credit: "Crédito",
  debit: "Débito",
  pix: "PIX",
};

const DIRECTION_LABELS: Record<string, string> = {
  in: "ENTRADA",
  out: "SAÍDA",
};

const MOVEMENT_LABELS: Record<string, string> = {
  sangria: "Sangria",
  suprimento: "Suprimento",
  pagamento: "Pagamento",
  outro: "Outro",
};

export const ThermalReceipt = forwardRef<HTMLDivElement, ReceiptProps>(
  ({ type, data, eventName, operatorName, venueName, venueAddress }, ref) => {
    return (
      <div ref={ref} className="thermal-receipt">
        {/* Header */}
        <p className="receipt-center receipt-bold">CLOSE OUT</p>
        {venueName && <p className="receipt-center">{venueName}</p>}
        {venueAddress && <p className="receipt-center receipt-small">{venueAddress}</p>}
        {eventName && <p className="receipt-center receipt-small">{eventName}</p>}
        <p className="receipt-sep">{SEP}</p>
        <p className="receipt-center receipt-bold">{TYPE_LABELS[type]}</p>
        <p className="receipt-center receipt-small">{now()}</p>
        <p className="receipt-sep">{SEP}</p>

        {type === "sale" && <SaleBody data={data as SaleData} />}
        {type === "return" && <ReturnBody data={data as ReturnData} />}
        {type === "exchange" && <ExchangeBody data={data as ExchangeData} />}
        {type === "movement" && <MovementBody data={data as MovementData} />}
        {type === "closing" && <ClosingBody data={data as ClosingData} />}

        <p className="receipt-sep">{SEP}</p>
        {operatorName && <p>Operador: {operatorName}</p>}
        <p className="receipt-sep">{SEP}</p>
        <p className="receipt-center">Obrigado pela preferência!</p>
        <p className="receipt-center receipt-small">Powered by Close Out</p>
        <p>&nbsp;</p>
        <p>&nbsp;</p>
      </div>
    );
  }
);

ThermalReceipt.displayName = "ThermalReceipt";

function SaleBody({ data }: { data: SaleData }) {
  return (
    <>
      <p>Pedido #{data.orderNumber}</p>
      <p className="receipt-sep">{SEP}</p>
      <div className="receipt-row">
        <span>Item</span>
        <span>Qtd</span>
        <span>Unit</span>
        <span>Total</span>
      </div>
      <p className="receipt-sep">{SEP}</p>
      {data.items.map((item, i) => (
        <div key={i}>
          <p>{item.name}</p>
          <div className="receipt-row">
            <span>&nbsp;</span>
            <span>{item.qty}</span>
            <span>{fmt(item.unitPrice)}</span>
            <span>{fmt(item.total)}</span>
          </div>
        </div>
      ))}
      <p className="receipt-sep">{SEP}</p>
      <div className="receipt-row">
        <span>Subtotal</span>
        <span>{fmt(data.subtotal)}</span>
      </div>
      {data.discount > 0 && (
        <div className="receipt-row">
          <span>Desconto</span>
          <span>-{fmt(data.discount)}</span>
        </div>
      )}
      <div className="receipt-row receipt-bold">
        <span>TOTAL</span>
        <span>{fmt(data.total)}</span>
      </div>
      <p className="receipt-sep">{SEP}</p>
      <p>Pagamento: {PAYMENT_LABELS[data.paymentMethod] || data.paymentMethod}</p>
    </>
  );
}

function ReturnBody({ data }: { data: ReturnData }) {
  return (
    <>
      <p>Pedido Original #{data.orderNumber}</p>
      <p className="receipt-sep">{SEP}</p>
      <p className="receipt-bold">Itens devolvidos:</p>
      {data.items.map((item, i) => (
        <div key={i} className="receipt-row">
          <span>{item.name} x{item.qty}</span>
          <span>{fmt(item.total)}</span>
        </div>
      ))}
      <p className="receipt-sep">{SEP}</p>
      <div className="receipt-row receipt-bold">
        <span>REEMBOLSO</span>
        <span>{fmt(data.refundAmount)}</span>
      </div>
      <p>Motivo: {data.reason}</p>
      <p>Tipo: {data.occurrenceType}</p>
      <p>Autorizado por: {data.authorizedBy}</p>
    </>
  );
}

function ExchangeBody({ data }: { data: ExchangeData }) {
  return (
    <>
      <p>Pedido Original #{data.orderNumber}</p>
      <p className="receipt-sep">{SEP}</p>
      <div className="receipt-row">
        <span>Item original:</span>
        <span>{fmt(data.originalItem.price)}</span>
      </div>
      <p className="receipt-small">{data.originalItem.name}</p>
      <div className="receipt-row">
        <span>Novo item:</span>
        <span>{fmt(data.newItem.price)}</span>
      </div>
      <p className="receipt-small">{data.newItem.name}</p>
      <p className="receipt-sep">{SEP}</p>
      <div className="receipt-row receipt-bold">
        <span>Diferença</span>
        <span>{fmt(data.priceDifference)}</span>
      </div>
      <p>
        {data.adjustmentDirection === "refund"
          ? "Valor devolvido ao cliente"
          : data.adjustmentDirection === "charge"
          ? "Valor cobrado do cliente"
          : "Sem diferença"}
      </p>
    </>
  );
}

function MovementBody({ data }: { data: MovementData }) {
  return (
    <>
      <div className="receipt-row">
        <span>Tipo:</span>
        <span>{MOVEMENT_LABELS[data.movementType] || data.movementType}</span>
      </div>
      <div className="receipt-row">
        <span>Direção:</span>
        <span>{DIRECTION_LABELS[data.direction] || data.direction}</span>
      </div>
      <div className="receipt-row receipt-bold">
        <span>Valor:</span>
        <span>{fmt(data.amount)}</span>
      </div>
      <p>Destino: {data.destination}</p>
      {data.notes && <p>Obs: {data.notes}</p>}
    </>
  );
}

function ClosingBody({ data }: { data: ClosingData }) {
  return (
    <>
      <div className="receipt-row">
        <span>Saldo Inicial</span>
        <span>{fmt(data.openingBalance)}</span>
      </div>
      <div className="receipt-row">
        <span>Vendas</span>
        <span>{fmt(data.totalSales)}</span>
      </div>
      <div className="receipt-row">
        <span>Depósitos</span>
        <span>{fmt(data.totalDeposits)}</span>
      </div>
      <div className="receipt-row">
        <span>Sangrias</span>
        <span>{fmt(data.totalWithdrawals)}</span>
      </div>
      <div className="receipt-row">
        <span>Devoluções</span>
        <span>{fmt(data.totalReturns)}</span>
      </div>
      <p className="receipt-sep">{SEP}</p>
      {data.byPayment && Object.keys(data.byPayment).length > 0 && (
        <>
          <p className="receipt-bold">Por forma de pagamento:</p>
          {Object.entries(data.byPayment).map(([method, { count, total }]) => (
            <div key={method} className="receipt-row">
              <span>{PAYMENT_LABELS[method] || method} ({count})</span>
              <span>{fmt(total)}</span>
            </div>
          ))}
          <p className="receipt-sep">{SEP}</p>
        </>
      )}
      <div className="receipt-row receipt-bold">
        <span>Saldo Esperado</span>
        <span>{fmt(data.expectedBalance)}</span>
      </div>
      <div className="receipt-row receipt-bold">
        <span>Saldo Informado</span>
        <span>{fmt(data.physicalBalance)}</span>
      </div>
      <div className="receipt-row receipt-bold">
        <span>Diferença</span>
        <span>{fmt(data.difference)}</span>
      </div>
      {data.notes && <p>Obs: {data.notes}</p>}
    </>
  );
}

export function printThermalReceipt() {
  window.print();
}
