import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as profileApi from "../services/profile-api";
import { useProfileStore } from "../store/profileStore";
import ProfileForm from "./ProfileForm";
import ProfilePage from "@/app/(app)/profile/page";

const fakeProfile = {
  id: "p1",
  user_id: "u1",
  display_name: "Ana",
  bio: "Creo contenido de tecnología",
  niche: "tecnologia",
  sub_niche: "desarrollo web",
  primary_goal: "crecer",
  tone: "cercano",
  target_audience: "devs junior",
  current_frequency: "3 por semana",
  desired_frequency: "5 por semana",
  preferred_formats: ["short_video"],
  timezone: "America/Argentina/Buenos_Aires",
  social_accounts: [],
};

function resetStore() {
  useProfileStore.setState({ profile: fakeProfile, isLoading: false, error: null });
}

beforeEach(() => {
  resetStore();
  vi.restoreAllMocks();
});

describe("ProfileForm — render", () => {
  it("renderiza los valores actuales del perfil", () => {
    render(<ProfileForm />);

    expect(screen.getByLabelText(/nombre/i)).toHaveValue("Ana");
    expect(screen.getByLabelText(/biograf/i)).toHaveValue(
      "Creo contenido de tecnología",
    );
    expect(screen.getByLabelText(/^nicho$/i)).toHaveValue("tecnologia");
    expect(screen.getByLabelText(/objetivo principal/i)).toHaveValue("crecer");
    expect(screen.getByLabelText(/tono/i)).toHaveValue("cercano");
    expect(screen.getByLabelText(/audiencia objetivo/i)).toHaveValue(
      "devs junior",
    );
  });
});

describe("ProfileForm — zona horaria", () => {
  it("renderiza un select de timezone con una opción vacía 'Sin especificar'", () => {
    render(<ProfileForm />);

    const select = screen.getByLabelText(/zona horaria/i);
    expect(select.tagName).toBe("SELECT");
    expect(screen.getByRole("option", { name: /sin especificar/i })).toBeInTheDocument();
  });

  it("toEditable siembra el select desde profile?.timezone ?? ''", () => {
    render(<ProfileForm />);

    expect(screen.getByLabelText(/zona horaria/i)).toHaveValue(
      "America/Argentina/Buenos_Aires",
    );
  });

  it("incluye timezone en el diff cuando cambia", async () => {
    const updateSpy = vi
      .spyOn(profileApi, "updateProfile")
      .mockResolvedValue({ ...fakeProfile, timezone: "America/Bogota" });

    render(<ProfileForm />);

    fireEvent.change(screen.getByLabelText(/zona horaria/i), {
      target: { value: "America/Bogota" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1));
    expect(updateSpy).toHaveBeenCalledWith({ timezone: "America/Bogota" });
  });

  it("antepone la zona detectada por el navegador cuando no está en la lista curada", () => {
    const resolvedOptionsSpy = vi
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockReturnValue({
        timeZone: "Pacific/Kiritimati",
      } as Intl.ResolvedDateTimeFormatOptions);

    useProfileStore.setState({
      profile: { ...fakeProfile, timezone: null },
      isLoading: false,
      error: null,
    });

    render(<ProfileForm />);

    expect(
      screen.getByRole("option", { name: "Pacific/Kiritimati" }),
    ).toBeInTheDocument();

    resolvedOptionsSpy.mockRestore();
  });

  it("conserva la zona guardada fuera de la lista curada aunque el navegador reporte otra que sí está", () => {
    // Caso real: el creador guardó su zona desde otro dispositivo, o viajó,
    // o usa VPN. Si solo se antepone la zona detectada, el <select> se queda
    // sin <option> para el valor guardado y cae a "Sin especificar",
    // pisando en silencio la zona real al guardar.
    const resolvedOptionsSpy = vi
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockReturnValue({
        timeZone: "America/Bogota",
      } as Intl.ResolvedDateTimeFormatOptions);

    useProfileStore.setState({
      profile: { ...fakeProfile, timezone: "Pacific/Kiritimati" },
      isLoading: false,
      error: null,
    });

    render(<ProfileForm />);

    expect(
      screen.getByRole("option", { name: "Pacific/Kiritimati" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/zona horaria/i)).toHaveValue(
      "Pacific/Kiritimati",
    );

    resolvedOptionsSpy.mockRestore();
  });
});

describe("ProfileForm — edición", () => {
  it("al editar y guardar llama a profileStore.save solo con los campos cambiados", async () => {
    const updateSpy = vi
      .spyOn(profileApi, "updateProfile")
      .mockResolvedValue({ ...fakeProfile, bio: "Nueva bio" });

    render(<ProfileForm />);

    fireEvent.change(screen.getByLabelText(/biograf/i), {
      target: { value: "Nueva bio" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1));
    expect(updateSpy).toHaveBeenCalledWith({ bio: "Nueva bio" });
  });

  it("muestra el estado de error del store cuando falla el guardado", async () => {
    vi.spyOn(profileApi, "updateProfile").mockRejectedValue(
      new Error("No se pudo guardar el perfil"),
    );

    render(<ProfileForm />);

    fireEvent.change(screen.getByLabelText(/biograf/i), {
      target: { value: "Bio rota" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /no se pudo guardar el perfil/i,
      );
    });
  });
});

describe("Página /profile", () => {
  it("renderiza el formulario de perfil en lugar del stub", () => {
    render(<ProfilePage />);

    expect(screen.queryByText(/perfil — fase 2/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
  });
});
