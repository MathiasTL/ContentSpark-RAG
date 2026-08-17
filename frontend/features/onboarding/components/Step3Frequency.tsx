"use client";

import { CalendarClock, CalendarRange } from "lucide-react";
import Field, { FIELD_ICON_CLASS } from "@/shared/components/ui/Field";
import type { OnboardingDraft } from "../hooks/useOnboardingWizard";

interface Step3FrequencyProps {
  draft: OnboardingDraft;
  updateDraft: (partial: Partial<OnboardingDraft>) => void;
  frequencyRecommendation: number | null;
}

// Paso opcional (spec: Frequency Recommendation Fallback). La recomendación
// es solo una sugerencia de visualización: nunca se escribe sola en el
// draft, el usuario debe elegirla explícitamente.
export default function Step3Frequency({
  draft,
  updateDraft,
  frequencyRecommendation,
}: Step3FrequencyProps) {
  return (
    <div className="space-y-5">
      {frequencyRecommendation !== null ? (
        <p className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-on-surface">
          Para tu nicho recomendamos publicar aproximadamente{" "}
          <strong>{frequencyRecommendation} veces por semana</strong>. Es solo
          una sugerencia — puedes dejarlo en blanco o elegir tu propio ritmo.
        </p>
      ) : null}

      <Field
        id="current_frequency"
        label="Frecuencia actual (opcional)"
        type="text"
        value={draft.current_frequency ?? ""}
        onChange={(e) => updateDraft({ current_frequency: e.target.value || null })}
        placeholder="Ej. 3 por semana"
        icon={<CalendarClock aria-hidden="true" size={18} strokeWidth={1.5} className={FIELD_ICON_CLASS} />}
      />

      <Field
        id="desired_frequency"
        label="Frecuencia deseada (opcional)"
        type="text"
        value={draft.desired_frequency ?? ""}
        onChange={(e) => updateDraft({ desired_frequency: e.target.value || null })}
        placeholder="Ej. 5 por semana"
        icon={<CalendarRange aria-hidden="true" size={18} strokeWidth={1.5} className={FIELD_ICON_CLASS} />}
      />
    </div>
  );
}
