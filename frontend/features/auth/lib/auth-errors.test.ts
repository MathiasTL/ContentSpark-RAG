import { describe, expect, it } from "vitest";

import { mapAuthError, type ErrorRule } from "./auth-errors";

const FALLBACK = "No pudimos completar la acción.";

const FLOW_RULES: ErrorRule[] = [
  [
    /invalid login credentials/,
    { field: "password", text: "El correo o la contraseña no coinciden." },
  ],
];

describe("mapAuthError", () => {
  it("traduce un error del flujo y lo atribuye a su campo", () => {
    expect(mapAuthError("Invalid login credentials", FLOW_RULES, FALLBACK)).toEqual({
      field: "password",
      text: "El correo o la contraseña no coinciden.",
    });
  });

  it("ignora mayusculas y minusculas del mensaje de Supabase", () => {
    expect(mapAuthError("INVALID LOGIN CREDENTIALS", FLOW_RULES, FALLBACK).field).toBe(
      "password",
    );
  });

  it("aplica las reglas comunes cuando el flujo no matchea", () => {
    const result = mapAuthError("Too many requests", FLOW_RULES, FALLBACK);
    expect(result.field).toBeNull();
    expect(result.text).toMatch(/demasiados intentos/i);
  });

  it("trata los fallos de red como error del formulario", () => {
    const result = mapAuthError("Failed to fetch", [], FALLBACK);
    expect(result.field).toBeNull();
    expect(result.text).toMatch(/conexión/i);
  });

  // Las reglas del flujo se evaluan primero para que una pantalla pueda dar
  // un mensaje mas especifico que el generico.
  it("da prioridad a la regla del flujo sobre la comun", () => {
    const overriding: ErrorRule[] = [
      [/rate limit/, { field: "email", text: "Ese correo pidió demasiados enlaces." }],
    ];
    expect(mapAuthError("Rate limit exceeded", overriding, FALLBACK)).toEqual({
      field: "email",
      text: "Ese correo pidió demasiados enlaces.",
    });
  });

  it("cae en el fallback del flujo ante un mensaje desconocido", () => {
    expect(mapAuthError("Some unmapped backend failure", FLOW_RULES, FALLBACK)).toEqual({
      field: null,
      text: FALLBACK,
    });
  });

  // Nunca debe filtrarse texto en ingles de Supabase a la interfaz.
  it("no devuelve nunca el mensaje original del backend", () => {
    const original = "Some unmapped backend failure";
    expect(mapAuthError(original, FLOW_RULES, FALLBACK).text).not.toContain(original);
  });
});
