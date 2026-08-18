import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CopyButton from "./CopyButton";

function stubClipboard(impl: () => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn(impl) },
    configurable: true,
    writable: true,
  });
}

describe("CopyButton", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("copia el texto al portapapeles y confirma", async () => {
    stubClipboard(() => Promise.resolve());
    render(<CopyButton text="hook copiable" />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar respuesta" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("hook copiable");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Copiado"));
  });

  it("avisa cuando el portapapeles falla, sin romper", async () => {
    stubClipboard(() => Promise.reject(new Error("denegado")));
    render(<CopyButton text="x" />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar respuesta" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("No se pudo copiar"));
  });

  it("avisa cuando el portapapeles no existe (contexto no seguro)", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    render(<CopyButton text="x" />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar respuesta" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("No se pudo copiar"));
  });

  it("acepta una etiqueta accesible propia", () => {
    stubClipboard(() => Promise.resolve());
    render(<CopyButton text="x" label="Copiar el tercer mensaje" />);
    expect(screen.getByRole("button", { name: "Copiar el tercer mensaje" })).toBeInTheDocument();
  });
});
