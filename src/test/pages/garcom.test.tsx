import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import "../mocks";

const W = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

// ─── WaiterLogin ──────────────────────────────────────────────────
import WaiterLogin from "@/pages/garcom/WaiterLogin";

describe("WaiterLogin", () => {
  it("renderiza sem crash", () => {
    render(<WaiterLogin />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── WaiterDashboard ──────────────────────────────────────────────
import WaiterDashboard from "@/pages/garcom/WaiterDashboard";

describe("WaiterDashboard", () => {
  it("renderiza sem crash", () => {
    render(<WaiterDashboard />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── WaiterChamados ───────────────────────────────────────────────
import WaiterChamados from "@/pages/garcom/WaiterChamados";

describe("WaiterChamados", () => {
  it("renderiza sem crash", () => {
    render(<WaiterChamados />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── WaiterNovoPedido ─────────────────────────────────────────────
import WaiterNovoPedido from "@/pages/garcom/WaiterNovoPedido";

describe("WaiterNovoPedido", () => {
  it("renderiza sem crash", () => {
    render(<WaiterNovoPedido />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── WaiterPedidoAvulso ───────────────────────────────────────────
import WaiterPedidoAvulso from "@/pages/garcom/WaiterPedidoAvulso";

describe("WaiterPedidoAvulso", () => {
  it("renderiza sem crash", () => {
    render(<WaiterPedidoAvulso />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── WaiterPedidos ────────────────────────────────────────────────
import WaiterPedidos from "@/pages/garcom/WaiterPedidos";

describe("WaiterPedidos", () => {
  it("renderiza sem crash", () => {
    render(<WaiterPedidos />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── WaiterLeitorQR ───────────────────────────────────────────────
import WaiterLeitorQR from "@/pages/garcom/WaiterLeitorQR";

describe("WaiterLeitorQR", () => {
  it("renderiza sem crash", () => {
    render(<WaiterLeitorQR />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── WaiterTurno ──────────────────────────────────────────────────
import WaiterTurno from "@/pages/garcom/WaiterTurno";

describe("WaiterTurno", () => {
  it("renderiza sem crash", () => {
    render(<WaiterTurno />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── WaiterHistorico ──────────────────────────────────────────────
import WaiterHistorico from "@/pages/garcom/WaiterHistorico";

describe("WaiterHistorico", () => {
  it("renderiza sem crash", () => {
    render(<WaiterHistorico />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── WaiterJoinEvent ──────────────────────────────────────────────
import WaiterJoinEvent from "@/pages/garcom/WaiterJoinEvent";

describe("WaiterJoinEvent", () => {
  it("renderiza sem crash", () => {
    render(<WaiterJoinEvent />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});
