import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import "../mocks";

const W = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

// ─── Dashboard Admin ──────────────────────────────────────────────
import Dashboard from "@/pages/Dashboard";

describe("Admin Dashboard", () => {
  it("renderiza sem crash", () => {
    render(<Dashboard />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── Clients ──────────────────────────────────────────────────────
import Clients from "@/pages/Clients";

describe("Clients", () => {
  it("renderiza sem crash", () => {
    render(<Clients />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });

  it("mostra botão de ativar cliente", () => {
    render(<Clients />, { wrapper: W });
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });
});

// ─── UsersRoles ───────────────────────────────────────────────────
import UsersRoles from "@/pages/UsersRoles";

describe("UsersRoles", () => {
  it("renderiza sem crash", () => {
    render(<UsersRoles />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── Settings ─────────────────────────────────────────────────────
import Settings from "@/pages/Settings";

describe("Settings", () => {
  it("renderiza sem crash", () => {
    render(<Settings />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── AuditLogs ────────────────────────────────────────────────────
import AuditLogs from "@/pages/AuditLogs";

describe("AuditLogs", () => {
  it("renderiza sem crash", () => {
    render(<AuditLogs />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── Venues ───────────────────────────────────────────────────────
import Venues from "@/pages/Venues";

describe("Venues", () => {
  it("renderiza sem crash", () => {
    render(<Venues />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});

// ─── Events Admin ─────────────────────────────────────────────────
import Events from "@/pages/Events";

describe("Events (Admin)", () => {
  it("renderiza sem crash", () => {
    render(<Events />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });
});
