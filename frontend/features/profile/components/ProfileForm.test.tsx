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
