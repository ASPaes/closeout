import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import "../mocks";

const W = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

// ─── GestorDashboard ──────────────────────────────────────────────
import GestorDashboard from "@/pages/gestor/GestorDashboard";

describe("GestorDashboard", () => {
  it("renderiza sem crash", () => {
    render(<GestorDashboard />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── GestorEventos ────────────────────────────────────────────────
import GestorEventos from "@/pages/gestor/GestorEventos";

describe("GestorEventos", () => {
  it("renderiza sem crash", () => {
    render(<GestorEventos />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── GestorLocais ─────────────────────────────────────────────────
import GestorLocais from "@/pages/gestor/GestorLocais";

describe("GestorLocais", () => {
  it("renderiza sem crash", () => {
    render(<GestorLocais />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── GestorProdutos ───────────────────────────────────────────────
import GestorProdutos from "@/pages/gestor/GestorProdutos";

describe("GestorProdutos", () => {
  it("renderiza sem crash", () => {
    render(<GestorProdutos />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── GestorCategorias ─────────────────────────────────────────────
import GestorCategorias from "@/pages/gestor/GestorCategorias";

describe("GestorCategorias", () => {
  it("renderiza sem crash", () => {
    render(<GestorCategorias />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── GestorCombos ─────────────────────────────────────────────────
import GestorCombos from "@/pages/gestor/GestorCombos";

describe("GestorCombos", () => {
  it("renderiza sem crash", () => {
    render(<GestorCombos />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── GestorCatalogos ──────────────────────────────────────────────
import GestorCatalogos from "@/pages/gestor/GestorCatalogos";

describe("GestorCatalogos", () => {
  it("renderiza sem crash", () => {
    render(<GestorCatalogos />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── GestorCampanhas ──────────────────────────────────────────────
import GestorCampanhas from "@/pages/gestor/GestorCampanhas";

describe("GestorCampanhas", () => {
  it("renderiza sem crash", () => {
    render(<GestorCampanhas />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── GestorEstoque ────────────────────────────────────────────────
import GestorEstoque from "@/pages/gestor/GestorEstoque";

describe("GestorEstoque", () => {
  it("renderiza sem crash", () => {
    render(<GestorEstoque />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── GestorEquipe ─────────────────────────────────────────────────
import GestorEquipe from "@/pages/gestor/GestorEquipe";

describe("GestorEquipe", () => {
  it("renderiza sem crash", () => {
    render(<GestorEquipe />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── GestorUsuarios ───────────────────────────────────────────────
import GestorUsuarios from "@/pages/gestor/GestorUsuarios";

describe("GestorUsuarios", () => {
  it("renderiza sem crash", () => {
    render(<GestorUsuarios />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── GestorGarcons ────────────────────────────────────────────────
import GestorGarcons from "@/pages/gestor/GestorGarcons";

describe("GestorGarcons", () => {
  it("renderiza sem crash", () => {
    render(<GestorGarcons />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── GestorCaixas ─────────────────────────────────────────────────
import GestorCaixas from "@/pages/gestor/GestorCaixas";

describe("GestorCaixas", () => {
  it("renderiza sem crash", () => {
    render(<GestorCaixas />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── GestorBarOperacao ────────────────────────────────────────────
import GestorBarOperacao from "@/pages/gestor/GestorBarOperacao";

describe("GestorBarOperacao", () => {
  it("renderiza sem crash", () => {
    render(<GestorBarOperacao />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── GestorEventoFechamento ───────────────────────────────────────
import GestorEventoFechamento from "@/pages/gestor/GestorEventoFechamento";

describe("GestorEventoFechamento", () => {
  it("renderiza sem crash", () => {
    render(<GestorEventoFechamento />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});
