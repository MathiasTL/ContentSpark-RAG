import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MobileNav from "./MobileNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/chat",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/shared/lib/supabase", () => ({
  createClient: () => ({
    auth: {
      getUser: () =>
        Promise.resolve({
          data: {
            user: {
              email: "ana@contentspark.test",
              user_metadata: { full_name: "Ana Perez" },
            },
          },
        }),
    },
  }),
}));

describe("MobileNav", () => {
  it("expone los tres destinos de navegacion primaria", () => {
    render(<MobileNav />);

    expect(screen.getByRole("link", { name: /habla con spark/i })).toHaveAttribute(
      "href",
      "/chat",
    );
    expect(screen.getByRole("link", { name: /calendar/i })).toHaveAttribute(
      "href",
      "/calendar",
    );
    expect(screen.getByRole("link", { name: /perfil/i })).toHaveAttribute(
      "href",
      "/profile",
    );
  });

  it("marca el destino activo segun la ruta", () => {
    render(<MobileNav />);

    expect(
      screen.getByRole("link", { name: /habla con spark/i }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /calendar/i })).not.toHaveAttribute(
      "aria-current",
    );
  });

  // Regresión: AppSidebar es `hidden lg:flex`, así que sin este acceso el menú
  // de usuario —y con él el conmutador de tema— quedan inalcanzables por
  // debajo de 1024px.
  it("monta el acceso al menu de usuario una vez cargada la sesion", async () => {
    render(<MobileNav />);

    const trigger = await screen.findByRole("button", {
      name: "Menu de usuario",
    });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("Cuenta");
  });
});
