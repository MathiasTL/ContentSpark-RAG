"use client";

import type { OnboardingDraft } from "../hooks/useOnboardingWizard";

interface Step2GoalsProps {
  draft: OnboardingDraft;
  updateDraft: (partial: Partial<OnboardingDraft>) => void;
  showErrors: boolean;
}

interface FieldConfig {
  id: "primary_goal" | "tone" | "target_audience";
  label: string;
  placeholder: string;
  errorMessage: string;
}

const FIELDS: FieldConfig[] = [
  {
    id: "primary_goal",
    label: "Objetivo principal",
    placeholder: "Ej. crecer mi audiencia, vender un curso...",
    errorMessage: "Cuéntanos tu objetivo principal para continuar.",
  },
  {
    id: "tone",
    label: "Tono de tu contenido",
    placeholder: "Ej. cercano, profesional, divertido...",
    errorMessage: "Describe el tono de tu contenido para continuar.",
  },
  {
    id: "target_audience",
    label: "Audiencia objetivo",
    placeholder: "Ej. desarrolladores junior, mamás primerizas...",
    errorMessage: "Describe tu audiencia objetivo para continuar.",
  },
];

export default function Step2Goals({ draft, updateDraft, showErrors }: Step2GoalsProps) {
  return (
    <div className="space-y-5">
      {FIELDS.map((field) => {
        const value = draft[field.id];
        const isMissing = showErrors && value.trim().length === 0;
        const errorId = `${field.id}-error`;

        return (
          <div key={field.id} className="space-y-1.5">
            <label
              htmlFor={field.id}
              className="ml-1 text-xs font-medium uppercase tracking-widest text-[#595c60]"
            >
              {field.label}
            </label>
            <input
              id={field.id}
              type="text"
              value={value}
              onChange={(e) => updateDraft({ [field.id]: e.target.value })}
              placeholder={field.placeholder}
              aria-required="true"
              aria-invalid={isMissing}
              aria-describedby={isMissing ? errorId : undefined}
              className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm text-[#2c2f33] outline-none transition-all placeholder:text-[#75777b]/50 focus:border-[#6e2ce0] focus:ring-2 focus:ring-[#6e2ce0]/20"
            />
            {isMissing ? (
              <p id={errorId} role="alert" className="ml-1 text-xs text-red-600">
                {field.errorMessage}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
