import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyResolvedTheme,
  DARK_MEDIA_QUERY,
  isThemePreference,
  persistPreference,
  readStoredPreference,
  resolveTheme,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
} from "./theme";

describe("isThemePreference", () => {
  it("acepta los tres valores validos", () => {
    expect(isThemePreference("light")).toBe(true);
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("system")).toBe(true);
  });

  it("rechaza cualquier otro valor", () => {
    expect(isThemePreference("Dark")).toBe(false);
    expect(isThemePreference(null)).toBe(false);
    expect(isThemePreference(undefined)).toBe(false);
    expect(isThemePreference(1)).toBe(false);
  });
});

describe("readStoredPreference", () => {
  it("devuelve la preferencia persistida cuando es valida", () => {
    const storage = { getItem: vi.fn().mockReturnValue("dark") };
    expect(readStoredPreference(storage)).toBe("dark");
    expect(storage.getItem).toHaveBeenCalledWith(THEME_STORAGE_KEY);
  });

  it("cae en system cuando no hay nada guardado", () => {
    expect(readStoredPreference({ getItem: () => null })).toBe("system");
  });

  it("cae en system cuando el valor guardado esta corrupto", () => {
    expect(readStoredPreference({ getItem: () => "purple" })).toBe("system");
  });

  it("cae en system cuando el storage no existe", () => {
    expect(readStoredPreference(null)).toBe("system");
    expect(readStoredPreference(undefined)).toBe("system");
  });

  it("cae en system cuando el storage lanza (modo privado)", () => {
    const storage = {
      getItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(readStoredPreference(storage)).toBe("system");
  });
});

describe("persistPreference", () => {
  it("escribe la preferencia bajo la clave del sistema", () => {
    const storage = { setItem: vi.fn() };
    persistPreference(storage, "light");
    expect(storage.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, "light");
  });

  it("no lanza cuando el storage falla o no existe", () => {
    expect(() => persistPreference(null, "dark")).not.toThrow();
    expect(() =>
      persistPreference(
        {
          setItem: () => {
            throw new Error("QuotaExceededError");
          },
        },
        "dark",
      ),
    ).not.toThrow();
  });
});

describe("resolveTheme", () => {
  it("respeta la eleccion explicita ignorando al sistema", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("sigue al sistema cuando la preferencia es system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("applyResolvedTheme", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement("html");
  });

  it("agrega la clase dark y declara el color-scheme oscuro", () => {
    applyResolvedTheme(root, "dark");
    expect(root.classList.contains("dark")).toBe(true);
    expect(root.style.colorScheme).toBe("dark");
  });

  it("quita la clase dark y declara el color-scheme claro", () => {
    root.classList.add("dark");
    applyResolvedTheme(root, "light");
    expect(root.classList.contains("dark")).toBe(false);
    expect(root.style.colorScheme).toBe("light");
  });

  it("conserva las demas clases del elemento raiz", () => {
    root.classList.add("__variable_inter");
    applyResolvedTheme(root, "dark");
    expect(root.classList.contains("__variable_inter")).toBe(true);
  });
});

describe("THEME_INIT_SCRIPT", () => {
  const runScript = (options: {
    stored: string | null | (() => never);
    systemPrefersDark: boolean;
  }) => {
    document.documentElement.className = "";
    document.documentElement.style.colorScheme = "";

    const getItem =
      typeof options.stored === "function"
        ? options.stored
        : () => options.stored as string | null;

    vi.stubGlobal("localStorage", { getItem });
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === DARK_MEDIA_QUERY && options.systemPrefersDark,
      })),
    );

    new Function(THEME_INIT_SCRIPT)();

    const result = {
      dark: document.documentElement.classList.contains("dark"),
      colorScheme: document.documentElement.style.colorScheme,
    };
    vi.unstubAllGlobals();
    return result;
  };

  it("aplica oscuro cuando la preferencia guardada es dark, sin importar el sistema", () => {
    expect(runScript({ stored: "dark", systemPrefersDark: false })).toEqual({
      dark: true,
      colorScheme: "dark",
    });
  });

  it("aplica claro cuando la preferencia guardada es light, sin importar el sistema", () => {
    expect(runScript({ stored: "light", systemPrefersDark: true })).toEqual({
      dark: false,
      colorScheme: "light",
    });
  });

  it("sigue al sistema cuando no hay preferencia guardada", () => {
    expect(runScript({ stored: null, systemPrefersDark: true })).toEqual({
      dark: true,
      colorScheme: "dark",
    });
    expect(runScript({ stored: null, systemPrefersDark: false })).toEqual({
      dark: false,
      colorScheme: "light",
    });
  });

  it("trata un valor corrupto como system", () => {
    expect(runScript({ stored: "banana", systemPrefersDark: true })).toEqual({
      dark: true,
      colorScheme: "dark",
    });
  });

  it("no rompe la pagina cuando localStorage lanza", () => {
    expect(() =>
      runScript({
        stored: () => {
          throw new Error("SecurityError");
        },
        systemPrefersDark: false,
      }),
    ).not.toThrow();
  });

  it("usa la misma clave de storage que el modulo", () => {
    expect(THEME_INIT_SCRIPT).toContain(JSON.stringify(THEME_STORAGE_KEY));
  });
});
