import { describe, it, expect } from "vitest";
import type { Profile } from "@/features/profile";
import {
  GENERIC_PROMPTS,
  buildPersonalizationSummary,
  buildSuggestedPrompts,
} from "./personalization";

function makeProfile(partial: Partial<Profile> = {}): Profile {
  return {
    id: "p1",
    user_id: "u1",
    display_name: null,
    bio: null,
    niche: null,
    sub_niche: null,
    primary_goal: null,
    tone: null,
    target_audience: null,
    current_frequency: null,
    desired_frequency: null,
    preferred_formats: [],
    timezone: null,
    social_accounts: [],
    ...partial,
  };
}

describe("buildPersonalizationSummary", () => {
  it("devuelve null sin perfil", () => {
    expect(buildPersonalizationSummary(null)).toBeNull();
  });

  it("devuelve null cuando el perfil no tiene nada que resumir", () => {
    expect(buildPersonalizationSummary(makeProfile())).toBeNull();
  });

  it("traduce nicho, plataforma y formato a etiquetas legibles", () => {
    const summary = buildPersonalizationSummary(
      makeProfile({
        niche: "fitness",
        preferred_formats: ["short_video"],
        social_accounts: [
          { platform: "tiktok", handle: "@x", url: null, follower_count: null },
        ],
      }),
    );
    expect(summary).toBe("Fitness · TikTok · Video corto");
  });

  it("omite las partes ausentes en vez de dejar huecos", () => {
    expect(buildPersonalizationSummary(makeProfile({ niche: "finanzas" }))).toBe("Finanzas");
  });

  it("cae al valor crudo si el backend manda un nicho fuera de la lista curada", () => {
    expect(buildPersonalizationSummary(makeProfile({ niche: "astrologia" }))).toBe("astrologia");
  });
});

describe("buildSuggestedPrompts", () => {
  it("usa los genericos sin perfil, en vez de inventar personalizacion", () => {
    expect(buildSuggestedPrompts(null)).toEqual(GENERIC_PROMPTS);
  });

  it("usa los genericos cuando hay perfil pero no hay nicho", () => {
    expect(buildSuggestedPrompts(makeProfile({ tone: "cercano" }))).toEqual(GENERIC_PROMPTS);
  });

  it("deriva los prompts del nicho, el formato y la plataforma", () => {
    const prompts = buildSuggestedPrompts(
      makeProfile({
        niche: "fitness",
        preferred_formats: ["carousel"],
        social_accounts: [
          { platform: "instagram", handle: "@x", url: null, follower_count: null },
        ],
      }),
    );
    expect(prompts[0]).toBe("Dame hooks de fitness para carrusel");
    expect(prompts[1]).toBe("Estrategia de esta semana en Instagram");
  });

  it("prefiere el sub-nicho sobre el nicho cuando existe", () => {
    const prompts = buildSuggestedPrompts(
      makeProfile({ niche: "fitness", sub_niche: "Calistenia" }),
    );
    expect(prompts[0]).toBe("Dame hooks de calistenia");
  });

  it("usa el objetivo del creador para el tercer prompt", () => {
    const prompts = buildSuggestedPrompts(
      makeProfile({ niche: "negocios", primary_goal: "Vender mi curso" }),
    );
    expect(prompts[2]).toBe("Ideas de negocios para vender mi curso");
  });

  it("siempre devuelve tres prompts", () => {
    expect(buildSuggestedPrompts(makeProfile({ niche: "lifestyle" }))).toHaveLength(3);
  });
});
