"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboardingWizard } from "../hooks/useOnboardingWizard";
import WizardProgress from "./WizardProgress";
import Step1Niche from "./Step1Niche";
import Step2Goals from "./Step2Goals";
import Step3Frequency from "./Step3Frequency";
import Step4Formats from "./Step4Formats";

const STEP_TITLES = [
  "Tu nicho de contenido",
  "Objetivos y voz",
  "Frecuencia de publicación",
  "Formatos y redes",
];

// Orquesta el wizard de onboarding (design D7: el draft y la navegación
// viven en useOnboardingWizard, este componente solo renderiza y gestiona
// el estado transitorio de "¿mostrar errores de este paso?").
export default function OnboardingWizard() {
  const router = useRouter();
  const {
    step,
    totalSteps,
    isFirstStep,
    isLastStep,
    draft,
    updateDraft,
    next,
    back,
    canAdvance,
    frequencyRecommendation,
    submit,
    isSubmitting,
    error,
  } = useOnboardingWizard();

  const [showErrors, setShowErrors] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Limpia los errores del paso anterior al cambiar de paso. Ajuste de
  // estado durante el render (no dentro de un efecto) para evitar el
  // render en cascada que produciría un setState síncrono en useEffect.
  const [renderedStep, setRenderedStep] = useState(step);
  if (renderedStep !== step) {
    setRenderedStep(step);
    setShowErrors(false);
  }

  // Mueve el foco al título del nuevo paso — efecto legítimo: sincroniza
  // el DOM (foco) con el estado de React, no llama a setState.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  async function handlePrimaryAction(): Promise<void> {
    if (!canAdvance) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);

    if (!isLastStep) {
      next();
      return;
    }

    try {
      setSubmitError(null);
      await submit();
      router.push("/chat");
    } catch {
      setSubmitError("No se pudo completar el onboarding. Intenta de nuevo.");
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-4 py-10 sm:px-6">
      <div className="rounded-3xl border border-white/20 bg-surface-container-lowest/40 p-6 shadow-[0_32px_64px_-16px_rgba(110,44,224,0.12)] backdrop-blur-xl sm:p-10">
        <WizardProgress step={step} totalSteps={totalSteps} titles={STEP_TITLES} />

        <h2
          ref={headingRef}
          tabIndex={-1}
          className="mt-6 text-xl font-semibold tracking-tight text-on-surface outline-none sm:text-2xl"
        >
          {STEP_TITLES[step]}
        </h2>

        <div className="mt-6">
          {step === 0 ? (
            <Step1Niche draft={draft} updateDraft={updateDraft} showErrors={showErrors} />
          ) : null}
          {step === 1 ? (
            <Step2Goals draft={draft} updateDraft={updateDraft} showErrors={showErrors} />
          ) : null}
          {step === 2 ? (
            <Step3Frequency
              draft={draft}
              updateDraft={updateDraft}
              frequencyRecommendation={frequencyRecommendation}
            />
          ) : null}
          {step === 3 ? <Step4Formats draft={draft} updateDraft={updateDraft} /> : null}
        </div>

        {submitError || error ? (
          <p
            role="alert"
            className="mt-4 rounded-2xl border border-red-200/60 bg-red-50/80 px-4 py-3 text-sm text-red-700"
          >
            {submitError ?? error}
          </p>
        ) : null}

        <div className="mt-8 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={back}
            disabled={isFirstStep}
            className="rounded-full border border-white/40 bg-surface-container-lowest/20 px-5 py-2.5 text-sm font-medium text-on-surface transition-all hover:bg-surface-container-lowest/40 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Atrás
          </button>
          <button
            type="button"
            onClick={() => void handlePrimaryAction()}
            disabled={isSubmitting}
            className="rounded-full bg-gradient-to-r from-primary to-primary-container px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:hover:scale-100"
          >
            {isLastStep ? (isSubmitting ? "Guardando..." : "Finalizar") : "Siguiente"}
          </button>
        </div>
      </div>
    </div>
  );
}
