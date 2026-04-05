import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import "../mocks";

const W = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

// ─── BarFilaPedidos ───────────────────────────────────────────────
import BarFilaPedidos from "@/pages/bar/BarFilaPedidos";

describe("BarFilaPedidos", () => {
  it("renderiza sem crash", () => {
    render(<BarFilaPedidos />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── BarLeitorQR ──────────────────────────────────────────────────
import BarLeitorQR from "@/pages/bar/BarLeitorQR";

describe("BarLeitorQR", () => {
  it("renderiza sem crash", () => {
    render(<BarLeitorQR />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── BarProntos ───────────────────────────────────────────────────
import BarProntos from "@/pages/bar/BarProntos";

describe("BarProntos", () => {
  it("renderiza sem crash", () => {
    render(<BarProntos />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── BarHistorico ─────────────────────────────────────────────────
import BarHistorico from "@/pages/bar/BarHistorico";

describe("BarHistorico", () => {
  it("renderiza sem crash", () => {
    render(<BarHistorico />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});
