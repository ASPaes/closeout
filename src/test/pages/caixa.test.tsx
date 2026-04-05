import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import "../mocks";

const W = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

// ─── CaixaDashboard ───────────────────────────────────────────────
import CaixaDashboard from "@/pages/caixa/CaixaDashboard";

describe("CaixaDashboard", () => {
  it("renderiza sem crash", () => {
    render(<CaixaDashboard />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── CaixaVenda ───────────────────────────────────────────────────
import CaixaVenda from "@/pages/caixa/CaixaVenda";

describe("CaixaVenda", () => {
  it("renderiza sem crash", () => {
    render(<CaixaVenda />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── CaixaMovimentacoes ───────────────────────────────────────────
import CaixaMovimentacoes from "@/pages/caixa/CaixaMovimentacoes";

describe("CaixaMovimentacoes", () => {
  it("renderiza sem crash", () => {
    render(<CaixaMovimentacoes />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── CaixaDevolucoes ──────────────────────────────────────────────
import CaixaDevolucoes from "@/pages/caixa/CaixaDevolucoes";

describe("CaixaDevolucoes", () => {
  it("renderiza sem crash", () => {
    render(<CaixaDevolucoes />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── CaixaTrocas ──────────────────────────────────────────────────
import CaixaTrocas from "@/pages/caixa/CaixaTrocas";

describe("CaixaTrocas", () => {
  it("renderiza sem crash", () => {
    render(<CaixaTrocas />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── CaixaFechamento ──────────────────────────────────────────────
import CaixaFechamento from "@/pages/caixa/CaixaFechamento";

describe("CaixaFechamento", () => {
  it("renderiza sem crash", () => {
    render(<CaixaFechamento />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});
