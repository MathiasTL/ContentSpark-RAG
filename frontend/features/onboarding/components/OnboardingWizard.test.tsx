import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as profileApi from "@/features/profile";
import OnboardingWizard from "./OnboardingWizard";
import OnboardingPage from "@/app/(app)/onboarding/page";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

beforeEach(() => {
  vi.restoreAllMocks();
  pushMock.mockClear();
});

describe("OnboardingWizard — render inicial", () => {
  it("renderiza el primer paso (nicho) al montar", () => {
    render(<OnboardingWizard />);

    expect(
      screen.getByRole("heading", { name: /tu nicho de contenido/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^nicho$/i)).toBeInTheDocument();
  });

  it("comunica el progreso a lectores de pantalla via role=progressbar", () => {
    render(<OnboardingWizard />);

    const progress = screen.getByRole("progressbar");
    expect(progress).toHaveAttribute("aria-valuenow", "25");
    expect(progress).toHaveAttribute("aria-valuemax", "100");
  });
});

describe("OnboardingWizard — validación por paso", () => {
  it("bloquea avanzar y anuncia un error cuando el nicho está vacío", () => {
    render(<OnboardingWizard />);

    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));

    expect(
      screen.getByRole("heading", { name: /tu nicho de contenido/i }),
    ).toBeInTheDocument();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/selecciona un nicho/i);

    const nicheSelect = screen.getByLabelText(/^nicho$/i);
    expect(nicheSelect).toHaveAttribute("aria-describedby", "niche-error");
    expect(nicheSelect).toHaveAttribute("aria-invalid", "true");
  });

  it("tiene el label del nicho asociado al select (form-labels)", () => {
    render(<OnboardingWizard />);

    const nicheSelect = screen.getByLabelText(/^nicho$/i);
    expect(nicheSelect.tagName).toBe("SELECT");
  });
});

describe("OnboardingWizard — flujo completo", () => {
  it("recorre los 4 pasos y envía el onboarding una sola vez", async () => {
    const submitSpy = vi.spyOn(profileApi, "submitOnboarding").mockResolvedValue({
      id: "p1",
      user_id: "u1",
      display_name: null,
      bio: null,
      niche: "tecnologia",
      sub_niche: null,
      primary_goal: "crecer",
      tone: "cercano",
      target_audience: "devs",
      current_frequency: null,
      desired_frequency: null,
      preferred_formats: ["short_video"],
      social_accounts: [],
    });

    render(<OnboardingWizard />);

    // Paso 1: nicho
    fireEvent.change(screen.getByLabelText(/^nicho$/i), {
      target: { value: "tecnologia" },
    });
    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));

    // Paso 2: objetivo, tono, audiencia
    expect(
      screen.getByRole("heading", { name: /objetivos y voz/i }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/objetivo principal/i), {
      target: { value: "crecer" },
    });
    fireEvent.change(screen.getByLabelText(/tono/i), {
      target: { value: "cercano" },
    });
    fireEvent.change(screen.getByLabelText(/audiencia objetivo/i), {
      target: { value: "devs" },
    });
    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));

    // Paso 3: frecuencia (opcional) — avanza sin llenar nada
    expect(
      screen.getByRole("heading", { name: /frecuencia de publicación/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));

    // Paso 4: formatos (opcional)
    expect(
      screen.getByRole("heading", { name: /formatos y redes/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/video corto/i));
    fireEvent.click(screen.getByRole("button", { name: /finalizar/i }));

    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1));
    expect(submitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        niche: "tecnologia",
        primary_goal: "crecer",
        tone: "cercano",
        target_audience: "devs",
      }),
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/chat"));
  });

  it("muestra la recomendación de frecuencia como sugerencia, sin forzarla", () => {
    render(<OnboardingWizard />);

    fireEvent.change(screen.getByLabelText(/^nicho$/i), {
      target: { value: "fitness" },
    });
    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));
    fireEvent.change(screen.getByLabelText(/objetivo principal/i), {
      target: { value: "crecer" },
    });
    fireEvent.change(screen.getByLabelText(/tono/i), {
      target: { value: "cercano" },
    });
    fireEvent.change(screen.getByLabelText(/audiencia objetivo/i), {
      target: { value: "devs" },
    });
    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));

    expect(screen.getByText(/6 veces por semana/i)).toBeInTheDocument();

    const currentFrequency = screen.getByLabelText(/frecuencia actual/i);
    expect(currentFrequency).toHaveValue("");
  });
});

describe("Página /onboarding", () => {
  it("renderiza el wizard en lugar del stub", () => {
    render(<OnboardingPage />);

    expect(screen.queryByText(/onboarding — fase 2/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /tu nicho de contenido/i }),
    ).toBeInTheDocument();
  });
});
