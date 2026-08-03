"use client";

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
        <label
          htmlFor="niche"
          className="ml-1 text-xs font-medium uppercase tracking-widest text-on-surface-variant"
        >
          Nicho
        </label>
        <select
          id="niche"
          value={draft.niche}
          onChange={(e) => updateDraft({ niche: e.target.value })}
          aria-required="true"
          aria-invalid={nicheMissing}
          aria-describedby={nicheMissing ? "niche-error" : undefined}
          className="w-full rounded-2xl border border-white/40 bg-surface-container-lowest/30 px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Selecciona un nicho</option>
          {NICHES.map((n) => (
            <option key={n} value={n}>
              {NICHE_LABELS[n] ?? n}
            </option>
          ))}
        </select>
        {nicheMissing ? (
          <p id="niche-error" role="alert" className="ml-1 text-xs text-red-600">
            Selecciona un nicho para continuar.
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="sub_niche"
          className="ml-1 text-xs font-medium uppercase tracking-widest text-on-surface-variant"
        >
          Sub-nicho (opcional)
        </label>
        <input
          id="sub_niche"
          type="text"
          value={draft.sub_niche ?? ""}
          onChange={(e) => updateDraft({ sub_niche: e.target.value || null })}
          placeholder="Ej. desarrollo web, nutrición deportiva..."
          className="w-full rounded-2xl border border-white/40 bg-surface-container-lowest/30 px-4 py-3 text-sm text-on-surface outline-none transition-all placeholder:text-[#75777b]/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>
    </div>
  );
}
