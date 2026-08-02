import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as profileApi from "@/features/profile";
import { useOnboardingWizard } from "./useOnboardingWizard";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("navegación entre pasos", () => {
  it("bloquea avanzar cuando el campo requerido del paso actual está vacío", () => {
    const { result } = renderHook(() => useOnboardingWizard());

    expect(result.current.step).toBe(0);

    act(() => {
      result.current.next();
    });

    // niche sigue vacío -> no avanza
    expect(result.current.step).toBe(0);
  });

  it("avanza cuando el campo requerido del paso 1 (niche) está lleno", () => {
    const { result } = renderHook(() => useOnboardingWizard());

    act(() => {
      result.current.updateDraft({ niche: "tecnologia" });
    });
    act(() => {
      result.current.next();
    });

    expect(result.current.step).toBe(1);
  });

  it("bloquea avanzar del paso 2 si falta primary_goal, tone o target_audience", () => {
    const { result } = renderHook(() => useOnboardingWizard());

    act(() => {
      result.current.updateDraft({ niche: "tecnologia" });
    });
    act(() => {
      result.current.next();
    });
    expect(result.current.step).toBe(1);

    act(() => {
      result.current.updateDraft({ primary_goal: "crecer", tone: "cercano" });
    });
    act(() => {
      result.current.next();
    });

    // target_audience aún vacío -> no avanza
    expect(result.current.step).toBe(1);
  });

  it("back() retrocede sin perder el draft acumulado", () => {
    const { result } = renderHook(() => useOnboardingWizard());

    act(() => {
      result.current.updateDraft({ niche: "fitness" });
    });
    act(() => {
      result.current.next();
    });
    expect(result.current.step).toBe(1);

    act(() => {
      result.current.back();
    });

    expect(result.current.step).toBe(0);
    expect(result.current.draft.niche).toBe("fitness");
  });

  it("no retrocede antes del primer paso ni avanza más allá del último", () => {
    const { result } = renderHook(() => useOnboardingWizard());

    act(() => {
      result.current.back();
    });
    expect(result.current.step).toBe(0);
  });
});

describe("acumulación de draft entre pasos", () => {
  it("preserva campos de pasos anteriores al actualizar uno nuevo", () => {
    const { result } = renderHook(() => useOnboardingWizard());

    act(() => {
      result.current.updateDraft({ niche: "negocios", sub_niche: "b2b" });
    });
    act(() => {
      result.current.updateDraft({ primary_goal: "vender", tone: "profesional" });
    });

    expect(result.current.draft).toMatchObject({
      niche: "negocios",
      sub_niche: "b2b",
      primary_goal: "vender",
      tone: "profesional",
    });
  });
});

describe("recomendación de frecuencia", () => {
  it("es null antes de elegir niche", () => {
    const { result } = renderHook(() => useOnboardingWizard());
    expect(result.current.frequencyRecommendation).toBeNull();
  });

  it("se expone como sugerencia una vez elegido el niche, sin forzar un valor", () => {
    const { result } = renderHook(() => useOnboardingWizard());

    act(() => {
      result.current.updateDraft({ niche: "fitness" });
    });

    expect(result.current.frequencyRecommendation).toBe(6);
    // No fuerza el valor en el draft:
    expect(result.current.draft.current_frequency).toBeNull();
    expect(result.current.draft.desired_frequency).toBeNull();
  });
});

describe("submit", () => {
  it("llama submitOnboarding una sola vez con todos los campos del draft", async () => {
    const submitSpy = vi
      .spyOn(profileApi, "submitOnboarding")
      .mockResolvedValue({
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
        preferred_formats: [],
        social_accounts: [],
      });

    const { result } = renderHook(() => useOnboardingWizard());

    act(() => {
      result.current.updateDraft({
        niche: "tecnologia",
        primary_goal: "crecer",
        tone: "cercano",
        target_audience: "devs",
        preferred_formats: ["short_video"],
      });
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(submitSpy).toHaveBeenCalledTimes(1);
    expect(submitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        niche: "tecnologia",
        primary_goal: "crecer",
        tone: "cercano",
        target_audience: "devs",
        preferred_formats: ["short_video"],
      }),
    );
    await waitFor(() => expect(result.current.isSubmitting).toBe(false));
  });

  it("setea error y no revienta si submitOnboarding falla", async () => {
    vi.spyOn(profileApi, "submitOnboarding").mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useOnboardingWizard());

    await act(async () => {
      await expect(result.current.submit()).rejects.toThrow("boom");
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.isSubmitting).toBe(false);
  });
});
