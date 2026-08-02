"use client";

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
        <p className="rounded-2xl border border-[#6e2ce0]/20 bg-[#6e2ce0]/5 px-4 py-3 text-sm text-[#2c2f33]">
          Para tu nicho recomendamos publicar aproximadamente{" "}
          <strong>{frequencyRecommendation} veces por semana</strong>. Es solo
          una sugerencia — puedes dejarlo en blanco o elegir tu propio ritmo.
        </p>
      ) : null}

      <div className="space-y-1.5">
        <label
          htmlFor="current_frequency"
          className="ml-1 text-xs font-medium uppercase tracking-widest text-[#595c60]"
        >
          Frecuencia actual (opcional)
        </label>
        <input
          id="current_frequency"
          type="text"
          value={draft.current_frequency ?? ""}
          onChange={(e) => updateDraft({ current_frequency: e.target.value || null })}
          placeholder="Ej. 3 por semana"
          className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm text-[#2c2f33] outline-none transition-all placeholder:text-[#75777b]/50 focus:border-[#6e2ce0] focus:ring-2 focus:ring-[#6e2ce0]/20"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="desired_frequency"
          className="ml-1 text-xs font-medium uppercase tracking-widest text-[#595c60]"
        >
          Frecuencia deseada (opcional)
        </label>
        <input
          id="desired_frequency"
          type="text"
          value={draft.desired_frequency ?? ""}
          onChange={(e) => updateDraft({ desired_frequency: e.target.value || null })}
          placeholder="Ej. 5 por semana"
          className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm text-[#2c2f33] outline-none transition-all placeholder:text-[#75777b]/50 focus:border-[#6e2ce0] focus:ring-2 focus:ring-[#6e2ce0]/20"
        />
      </div>
    </div>
  );
}
