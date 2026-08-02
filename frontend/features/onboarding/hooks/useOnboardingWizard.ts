"use client";

import { useState } from "react";
import { submitOnboarding } from "@/features/profile";
import type {
  Profile,
  ProfileOnboardingInput,
  SocialAccount,
} from "@/features/profile";
import { FREQUENCY_RECOMMENDATIONS } from "@/shared/constants";

// Estado local del draft del wizard (design D7): NO vive en el store de
// Zustand. El store solo guarda el perfil ya persistido; un draft a medio
// llenar no es estado de aplicación.
export interface OnboardingDraft {
  display_name: string | null;
  bio: string | null;
  niche: string;
  sub_niche: string | null;
  primary_goal: string;
  tone: string;
  target_audience: string;
  current_frequency: string | null;
  desired_frequency: string | null;
  preferred_formats: string[];
  social_accounts: SocialAccount[];
}

const INITIAL_DRAFT: OnboardingDraft = {
  display_name: null,
  bio: null,
  niche: "",
  sub_niche: null,
  primary_goal: "",
  tone: "",
  target_audience: "",
  current_frequency: null,
  desired_frequency: null,
  preferred_formats: [],
  social_accounts: [],
};

// 4 pasos: 0=niche, 1=goals/tone/audience, 2=frecuencia (opcional), 3=formatos (opcional).
export const TOTAL_ONBOARDING_STEPS = 4;

// IMPORTANTE: esto es validación de UX a nivel de paso (¿el usuario llenó
// los campos de ESTE paso para poder avanzar?). NO es la regla de
// completitud del perfil — esa vive únicamente en el backend y se consulta
// vía GET /api/profile/status (is_complete/missing_fields). Este hook nunca
// re-deriva esa regla.
function isStepValid(step: number, draft: OnboardingDraft): boolean {
  switch (step) {
    case 0:
      return draft.niche.trim().length > 0;
    case 1:
      return (
        draft.primary_goal.trim().length > 0 &&
        draft.tone.trim().length > 0 &&
        draft.target_audience.trim().length > 0
      );
    default:
      // Pasos de frecuencia y formatos son opcionales (ver spec:
      // Frequency Recommendation Fallback).
      return true;
  }
}

export function useOnboardingWizard() {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<OnboardingDraft>(INITIAL_DRAFT);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateDraft(partial: Partial<OnboardingDraft>): void {
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  function next(): void {
    if (!isStepValid(step, draft)) return;
    setStep((s) => Math.min(s + 1, TOTAL_ONBOARDING_STEPS - 1));
  }

  function back(): void {
    setStep((s) => Math.max(s - 1, 0));
  }

  // Sugerencia de frecuencia una vez elegido el niche (spec: Frequency
  // Recommendation Fallback). Solo se muestra — nunca se persiste sola;
  // el usuario debe elegirla explícitamente para que termine en el draft.
  const frequencyRecommendation: number | null = draft.niche
    ? (FREQUENCY_RECOMMENDATIONS[draft.niche] ?? null)
    : null;

  async function submit(): Promise<Profile> {
    setIsSubmitting(true);
    setError(null);
    try {
      const payload: ProfileOnboardingInput = {
        display_name: draft.display_name,
        bio: draft.bio,
        niche: draft.niche,
        sub_niche: draft.sub_niche,
        primary_goal: draft.primary_goal,
        tone: draft.tone,
        target_audience: draft.target_audience,
        current_frequency: draft.current_frequency,
        desired_frequency: draft.desired_frequency,
        preferred_formats: draft.preferred_formats,
        social_accounts: draft.social_accounts,
      };
      const profile = await submitOnboarding(payload);
      return profile;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo completar el onboarding",
      );
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    step,
    totalSteps: TOTAL_ONBOARDING_STEPS,
    isFirstStep: step === 0,
    isLastStep: step === TOTAL_ONBOARDING_STEPS - 1,
    draft,
    updateDraft,
    next,
    back,
    canAdvance: isStepValid(step, draft),
    frequencyRecommendation,
    submit,
    isSubmitting,
    error,
  };
}
