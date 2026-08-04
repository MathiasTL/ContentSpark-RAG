"use client";

import { useState } from "react";
import type { GenerateInput } from "../services/calendar-api";
import { useCalendarStore } from "../store/calendarStore";

// Estado local del draft de generacion (mismo D7 que useOnboardingWizard):
// NO vive en el store de Zustand. El store solo guarda el calendario ya
// generado; un formulario a medio llenar no es estado de aplicacion.
export interface CalendarGenerationDraft {
  period: GenerateInput["period"];
  frequency: number | null;
  formats: Record<string, number> | null;
}

const INITIAL_DRAFT: CalendarGenerationDraft = {
  period: "current_week",
  frequency: null,
  formats: null,
};

export function useCalendarGeneration() {
  const [draft, setDraft] = useState<CalendarGenerationDraft>(INITIAL_DRAFT);
  const generate = useCalendarStore((state) => state.generate);
  const isGenerating = useCalendarStore((state) => state.isGenerating);
  const error = useCalendarStore((state) => state.error);

  function updateDraft(partial: Partial<CalendarGenerationDraft>): void {
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  async function submit(): Promise<void> {
    // frequency/formats se omiten (no se envian como null) cuando el
    // usuario los deja sin definir, para que el fallback del backend siga
    // siendo alcanzable (Generation Configuration Control's "period only").
    const input: GenerateInput = { period: draft.period };
    if (draft.frequency !== null) input.frequency = draft.frequency;
    if (draft.formats !== null) input.formats = draft.formats;
    await generate(input);
  }

  return {
    draft,
    updateDraft,
    submit,
    isGenerating,
    error,
  };
}
