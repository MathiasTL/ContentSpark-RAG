"use client";

import type { ReactNode } from "react";
import { Sparkles, Target, Users } from "lucide-react";
import Field, { FIELD_ICON_CLASS } from "@/shared/components/ui/Field";
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
  icon: ReactNode;
}

const FIELDS: FieldConfig[] = [
  {
    id: "primary_goal",
    label: "Objetivo principal",
    placeholder: "Ej. crecer mi audiencia, vender un curso...",
    errorMessage: "Cuéntanos tu objetivo principal para continuar.",
    icon: <Target aria-hidden="true" size={18} strokeWidth={1.5} className={FIELD_ICON_CLASS} />,
  },
  {
    id: "tone",
    label: "Tono de tu contenido",
    placeholder: "Ej. cercano, profesional, divertido...",
    errorMessage: "Describe el tono de tu contenido para continuar.",
    icon: <Sparkles aria-hidden="true" size={18} strokeWidth={1.5} className={FIELD_ICON_CLASS} />,
  },
  {
    id: "target_audience",
    label: "Audiencia objetivo",
    placeholder: "Ej. desarrolladores junior, mamás primerizas...",
    errorMessage: "Describe tu audiencia objetivo para continuar.",
    icon: <Users aria-hidden="true" size={18} strokeWidth={1.5} className={FIELD_ICON_CLASS} />,
  },
];

export default function Step2Goals({ draft, updateDraft, showErrors }: Step2GoalsProps) {
  return (
    <div className="space-y-5">
      {FIELDS.map((field) => {
        const value = draft[field.id];
        const isMissing = showErrors && value.trim().length === 0;

        return (
          <Field
            key={field.id}
            id={field.id}
            type="text"
            label={field.label}
            value={value}
            onChange={(e) => updateDraft({ [field.id]: e.target.value })}
            placeholder={field.placeholder}
            required
            error={isMissing ? field.errorMessage : null}
            icon={field.icon}
          />
        );
      })}
    </div>
  );
}
