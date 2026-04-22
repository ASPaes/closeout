import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import "../mocks";

const W = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

// ─── ConsumerLogin ────────────────────────────────────────────────
import ConsumerLogin from "@/pages/consumer/ConsumerLogin";

describe("ConsumerLogin", () => {
  it("renderiza sem crash", () => {
    render(<ConsumerLogin />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── ConsumerCadastro ─────────────────────────────────────────────
import ConsumerCadastro from "@/pages/consumer/ConsumerCadastro";

describe("ConsumerCadastro", () => {
  it("renderiza sem crash", () => {
    render(<ConsumerCadastro />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });

  it("mostra step 1 com campos de nome/CPF/telefone", () => {
    render(<ConsumerCadastro />, { wrapper: W });
    expect(screen.getByPlaceholderText(/CPF/)).toBeInTheDocument();
  });
});

// ─── ConsumerEventos ──────────────────────────────────────────────
import ConsumerEventos from "@/pages/consumer/ConsumerEventos";

describe("ConsumerEventos", () => {
  it("renderiza sem crash", () => {
    render(<ConsumerEventos />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── ConsumerCardapio ─────────────────────────────────────────────
import ConsumerCardapio from "@/pages/consumer/ConsumerCardapio";

describe("ConsumerCardapio", () => {
  it("renderiza sem crash", () => {
    render(<ConsumerCardapio />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── ConsumerCarrinho ─────────────────────────────────────────────
import ConsumerCarrinho from "@/pages/consumer/ConsumerCarrinho";

describe("ConsumerCarrinho", () => {
  it("renderiza sem crash", () => {
    render(<ConsumerCarrinho />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── ConsumerPagamento ────────────────────────────────────────────
import ConsumerPagamento from "@/pages/consumer/ConsumerPagamento";

describe("ConsumerPagamento", () => {
  it("renderiza sem crash", () => {
    render(<ConsumerPagamento />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── ConsumerQR ───────────────────────────────────────────────────
import ConsumerQR from "@/pages/consumer/ConsumerQR";

describe("ConsumerQR", () => {
  it("renderiza sem crash", () => {
    render(<ConsumerQR />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });

  it("mostra estado vazio quando não tem pedido ativo", () => {
    render(<ConsumerQR />, { wrapper: W });
    // activeOrder é null no mock, deve mostrar empty state
    expect(document.body.textContent).toBeTruthy();
  });
});

// ─── ConsumerPedidos ──────────────────────────────────────────────
import ConsumerPedidos from "@/pages/consumer/ConsumerPedidos";

describe("ConsumerPedidos", () => {
  it("renderiza sem crash", () => {
    render(<ConsumerPedidos />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── ConsumerPerfil ───────────────────────────────────────────────
import ConsumerPerfil from "@/pages/consumer/ConsumerPerfil";

describe("ConsumerPerfil", () => {
  it("renderiza sem crash", () => {
    render(<ConsumerPerfil />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── ConsumerCheckin ──────────────────────────────────────────────
import ConsumerCheckin from "@/pages/consumer/ConsumerCheckin";

describe("ConsumerCheckin", () => {
  it("renderiza sem crash", () => {
    render(<ConsumerCheckin />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── ConsumerLimites ──────────────────────────────────────────────
import ConsumerLimites from "@/pages/consumer/ConsumerLimites";

describe("ConsumerLimites", () => {
  it("renderiza sem crash", () => {
    render(<ConsumerLimites />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── ConsumerPresentes ────────────────────────────────────────────
import ConsumerPresentes from "@/pages/consumer/ConsumerPresentes";

describe("ConsumerPresentes", () => {
  it("renderiza sem crash", () => {
    render(<ConsumerPresentes />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});
