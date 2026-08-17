"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";
import Alert from "@/shared/components/ui/Alert";
import Button from "@/shared/components/ui/Button";
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
      <div className="rounded-3xl border border-glass-edge bg-surface-container-lowest/40 p-6 shadow-[0_32px_64px_-16px_rgba(110,44,224,0.12)] backdrop-blur-xl sm:p-10">
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
          <Alert tone="danger" className="mt-4">
            {submitError ?? error}
          </Alert>
        ) : null}

        <div className="mt-8 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={back}
            disabled={isFirstStep}
            className="!w-auto !py-2.5 px-6"
          >
            Atrás
          </Button>
          <Button
            onClick={() => void handlePrimaryAction()}
            disabled={isSubmitting}
            className="!w-auto inline-flex items-center justify-center gap-2 !py-2.5 px-6"
          >
            {isLastStep ? <CheckCircle className="h-4 w-4" aria-hidden="true" /> : null}
            {isLastStep ? (isSubmitting ? "Guardando..." : "Finalizar registro") : "Siguiente"}
          </Button>
        </div>
      </div>
    </div>
  );
}
