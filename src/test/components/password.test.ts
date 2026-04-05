import { describe, it, expect } from "vitest";
import { validatePassword } from "@/components/PasswordRequirements";

describe("validatePassword", () => {
  it("rejeita senha vazia", () => {
    const r = validatePassword("");
    expect(r.isValid).toBe(false);
    expect(r.minLength).toBe(false);
  });

  it("rejeita senha curta", () => {
    const r = validatePassword("Ab1!");
    expect(r.isValid).toBe(false);
    expect(r.minLength).toBe(false);
  });

  it("rejeita senha sem maiúscula", () => {
    const r = validatePassword("abcdef1!");
    expect(r.isValid).toBe(false);
    expect(r.hasUpper).toBe(false);
  });

  it("rejeita senha sem minúscula", () => {
    const r = validatePassword("ABCDEF1!");
    expect(r.isValid).toBe(false);
    expect(r.hasLower).toBe(false);
  });

  it("rejeita senha sem número", () => {
    const r = validatePassword("Abcdef!@");
    expect(r.isValid).toBe(false);
    expect(r.hasNumber).toBe(false);
  });

  it("rejeita senha sem caractere especial", () => {
    const r = validatePassword("Abcdef12");
    expect(r.isValid).toBe(false);
    expect(r.hasSpecial).toBe(false);
  });

  it("aceita senha válida completa", () => {
    const r = validatePassword("Abcde1!");
    expect(r.isValid).toBe(true);
    expect(r.minLength).toBe(true);
    expect(r.hasUpper).toBe(true);
    expect(r.hasLower).toBe(true);
    expect(r.hasNumber).toBe(true);
    expect(r.hasSpecial).toBe(true);
  });

  it("aceita senha forte", () => {
    const r = validatePassword("MyP@ssw0rd!");
    expect(r.isValid).toBe(true);
  });
});
