import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as profileApi from "../services/profile-api";
import { useProfileStore } from "../store/profileStore";
import TimezoneNudge from "./TimezoneNudge";

const DISMISS_KEY = "cs.timezone-nudge.dismissed";

const fakeProfile = {
  id: "p1",
  user_id: "u1",
  display_name: "Ana",
  bio: null,
  niche: "tecnologia",
  sub_niche: null,
  primary_goal: "crecer",
  tone: "cercano",
  target_audience: "devs",
  current_frequency: null,
  desired_frequency: null,
  preferred_formats: [],
  timezone: null as string | null,
  social_accounts: [],
};

function resetStore(overrides: Partial<ReturnType<typeof useProfileStore.getState>> = {}) {
  useProfileStore.setState({
    profile: null,
    isLoading: false,
    error: null,
    ...overrides,
  });
}

beforeEach(() => {
  window.localStorage.clear();
  resetStore();
  vi.restoreAllMocks();
});

describe("TimezoneNudge — visibilidad", () => {
  it("se renderiza cuando el perfil está cargado y timezone es null", () => {
    resetStore({ profile: { ...fakeProfile, timezone: null } });

    render(<TimezoneNudge />);

    expect(screen.getByText(/utc/i)).toBeInTheDocument();
  });

  it("no se renderiza cuando el perfil aún no cargó (profile === null)", () => {
    resetStore({ profile: null, isLoading: true });

    render(<TimezoneNudge />);

    expect(screen.queryByText(/utc/i)).not.toBeInTheDocument();
  });

  it("no se renderiza cuando timezone tiene cualquier valor no nulo, incluyendo 'UTC'", () => {
    resetStore({ profile: { ...fakeProfile, timezone: "UTC" } });

    render(<TimezoneNudge />);

    expect(screen.queryByText(/generando.*utc/i)).not.toBeInTheDocument();
  });

  it("no se renderiza si ya fue descartado (localStorage pre-seeded)", () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    resetStore({ profile: { ...fakeProfile, timezone: null } });

    render(<TimezoneNudge />);

    expect(screen.queryByText(/utc/i)).not.toBeInTheDocument();
  });
});

describe("TimezoneNudge — interacción", () => {
  it("el botón de descartar escribe la clave de dismissal en localStorage", () => {
    resetStore({ profile: { ...fakeProfile, timezone: null } });

    render(<TimezoneNudge />);

    fireEvent.click(screen.getByRole("button", { name: /descartar|cerrar/i }));

    expect(window.localStorage.getItem(DISMISS_KEY)).toBe("1");
  });

  it("contiene un link a /profile", () => {
    resetStore({ profile: { ...fakeProfile, timezone: null } });

    render(<TimezoneNudge />);

    expect(screen.getByRole("link")).toHaveAttribute("href", "/profile");
  });
});

describe("TimezoneNudge — storage no disponible", () => {
  // El componente se monta en app/(app)/layout.tsx, que envuelve todas las
  // rutas autenticadas. Si localStorage lanza (Safari en navegación privada,
  // políticas empresariales), una excepción sin atrapar durante el render
  // inicial tumbaría cada página de la app, no solo el aviso.
  it("se renderiza igual cuando getItem lanza, en vez de romper el layout", () => {
    const getItemSpy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new DOMException("storage disabled", "SecurityError");
      });
    resetStore({ profile: { ...fakeProfile, timezone: null } });

    expect(() => render(<TimezoneNudge />)).not.toThrow();
    expect(screen.getByRole("status")).toBeInTheDocument();

    getItemSpy.mockRestore();
  });

  it("descarta el aviso en la sesión actual aunque setItem lance", () => {
    const setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("storage disabled", "SecurityError");
      });
    resetStore({ profile: { ...fakeProfile, timezone: null } });

    render(<TimezoneNudge />);

    expect(() =>
      fireEvent.click(screen.getByRole("button", { name: /descartar|cerrar/i })),
    ).not.toThrow();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    setItemSpy.mockRestore();
  });
});

describe("TimezoneNudge — carga idempotente", () => {
  it("dispara load() a lo sumo una vez entre dos montajes cuando profile es null", async () => {
    const loadSpy = vi.spyOn(profileApi, "getProfile").mockResolvedValue({
      ...fakeProfile,
      timezone: null,
    });
    resetStore({ profile: null, isLoading: false });

    const { unmount } = render(<TimezoneNudge />);
    unmount();
    render(<TimezoneNudge />);

    await waitFor(() => expect(loadSpy).toHaveBeenCalledTimes(1));
  });
});
