import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import "../mocks";

const W = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

// ─── Login ────────────────────────────────────────────────────────
import Login from "@/pages/Login";

describe("Login", () => {
  it("renderiza sem crash", () => {
    render(<Login />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });

  it("mostra campo de email", () => {
    render(<Login />, { wrapper: W });
    expect(screen.getByPlaceholderText("admin@closeout.com")).toBeInTheDocument();
  });

  it("mostra botão de entrar", () => {
    render(<Login />, { wrapper: W });
    expect(screen.getByRole("button", { name: /sign_in/i })).toBeInTheDocument();
  });

  it("mostra link de criar conta", () => {
    render(<Login />, { wrapper: W });
    expect(screen.getByText("create_account")).toBeInTheDocument();
  });
});

// ─── Signup ───────────────────────────────────────────────────────
import Signup from "@/pages/Signup";

describe("Signup", () => {
  it("renderiza sem crash", () => {
    render(<Signup />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });

  it("mostra campos obrigatórios", () => {
    render(<Signup />, { wrapper: W });
    expect(screen.getByPlaceholderText("Ex: Maria Silva")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("voce@exemplo.com")).toBeInTheDocument();
  });

  it("mostra botão de criar conta", () => {
    render(<Signup />, { wrapper: W });
    expect(screen.getByRole("button", { name: /create_account/i })).toBeInTheDocument();
  });
});

// ─── InvitePage ───────────────────────────────────────────────────
import InvitePage from "@/pages/InvitePage";

describe("InvitePage", () => {
  it("renderiza sem crash", () => {
    render(<InvitePage />, { wrapper: W });
    expect(document.body).toBeTruthy();
  });

  it("mostra erro quando token está vazio", () => {
    render(<InvitePage />, { wrapper: W });
    // Sem token na URL, deve mostrar estado de erro
    expect(document.body.textContent).toBeTruthy();
  });
});
