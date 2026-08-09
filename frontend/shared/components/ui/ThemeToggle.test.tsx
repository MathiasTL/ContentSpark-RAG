import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ThemeToggle from "./ThemeToggle";
import { THEME_STORAGE_KEY } from "@/shared/lib/theme";

/** jsdom no implementa matchMedia: lo suplantamos con un control manual. */
function stubMatchMedia(prefersDark: boolean) {
  const listeners = new Set<() => void>();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: prefersDark,
      addEventListener: (_: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    })),
  );
  return listeners;
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.style.colorScheme = "";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ofrece las tres opciones de tema como un grupo de radios", () => {
    stubMatchMedia(false);
    render(<ThemeToggle />);

    expect(
      screen.getByRole("radiogroup", { name: "Tema de la interfaz" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: /claro/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /sistema/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /oscuro/i })).toBeInTheDocument();
  });

  it("marca la preferencia persistida al montar", () => {
    stubMatchMedia(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");

    render(<ThemeToggle />);

    expect(screen.getByRole("radio", { name: /oscuro/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: /claro/i })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("marca Sistema cuando no hay nada persistido", () => {
    stubMatchMedia(false);
    render(<ThemeToggle />);

    expect(screen.getByRole("radio", { name: /sistema/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("aplica la clase dark al documento al elegir Oscuro", () => {
    stubMatchMedia(false);
    render(<ThemeToggle />);

    expect(document.documentElement.classList.contains("dark")).toBe(false);

    fireEvent.click(screen.getByRole("radio", { name: /oscuro/i }));

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("persiste la eleccion del usuario", () => {
    stubMatchMedia(false);
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("radio", { name: /oscuro/i }));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    fireEvent.click(screen.getByRole("radio", { name: /claro/i }));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("sigue al sistema cuando la preferencia es Sistema", () => {
    stubMatchMedia(true);
    render(<ThemeToggle />);

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("ignora al sistema cuando hay una eleccion explicita en contra", () => {
    stubMatchMedia(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");

    render(<ThemeToggle />);

    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
