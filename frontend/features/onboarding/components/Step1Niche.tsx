"use client";

import { Tag } from "lucide-react";
import Field, { FIELD_ICON_CLASS, FIELD_LABEL_CLASS, inputClass } from "@/shared/components/ui/Field";
import { NICHES } from "@/shared/constants";
import type { OnboardingDraft } from "../hooks/useOnboardingWizard";

interface Step1NicheProps {
  draft: OnboardingDraft;
  updateDraft: (partial: Partial<OnboardingDraft>) => void;
  showErrors: boolean;
}

const NICHE_LABELS: Record<string, string> = {
  tecnologia: "Tecnología",
  fitness: "Fitness",
  finanzas: "Finanzas",
  educacion: "Educación",
  lifestyle: "Lifestyle",
  negocios: "Negocios",
};

export default function Step1Niche({ draft, updateDraft, showErrors }: Step1NicheProps) {
  const nicheMissing = showErrors && draft.niche.trim().length === 0;

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="niche" className={FIELD_LABEL_CLASS}>
          Nicho
        </label>
        <select
          id="niche"
          value={draft.niche}
          onChange={(e) => updateDraft({ niche: e.target.value })}
          aria-required="true"
          aria-invalid={nicheMissing}
          aria-describedby={nicheMissing ? "niche-error" : undefined}
          className={inputClass(nicheMissing, false)}
        >
          <option value="">Selecciona un nicho</option>
          {NICHES.map((n) => (
            <option key={n} value={n}>
              {NICHE_LABELS[n] ?? n}
            </option>
          ))}
        </select>
        {nicheMissing ? (
          <p id="niche-error" role="alert" className="ml-1 text-xs font-light text-danger">
            Selecciona un nicho para continuar.
          </p>
        ) : null}
      </div>

      <Field
        id="sub_niche"
        label="Sub-nicho (opcional)"
        type="text"
        value={draft.sub_niche ?? ""}
        onChange={(e) => updateDraft({ sub_niche: e.target.value || null })}
        placeholder="Ej. desarrollo web, nutrición deportiva..."
        icon={<Tag aria-hidden="true" size={18} strokeWidth={1.5} className={FIELD_ICON_CLASS} />}
      />
    </div>
  );
}
