"use client";

import { useState } from "react";
import { AtSign, Plus, X } from "lucide-react";
import Button from "@/shared/components/ui/Button";
import Field, { FIELD_ICON_CLASS, FIELD_LABEL_CLASS, inputClass } from "@/shared/components/ui/Field";
import { FORMATS, PLATFORMS } from "@/shared/constants";
import type { OnboardingDraft } from "../hooks/useOnboardingWizard";

interface Step4FormatsProps {
  draft: OnboardingDraft;
  updateDraft: (partial: Partial<OnboardingDraft>) => void;
}

const FORMAT_LABELS: Record<string, string> = {
  short_video: "Video corto",
  carousel: "Carrusel",
  story: "Historia",
  long_video: "Video largo",
  post: "Post",
};

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  x: "X",
};

// Paso opcional: formatos preferidos + redes sociales (spec: la sección de
// redes vive dentro del flujo de perfil/onboarding, no como paso propio).
export default function Step4Formats({ draft, updateDraft }: Step4FormatsProps) {
  const [platform, setPlatform] = useState<string>(PLATFORMS[0]);
  const [handle, setHandle] = useState("");
  // Revelado progresivo (design critique P1): el selector de plataforma +
  // usuario arranca oculto para no apilar dos decisiones de +4 opciones en
  // la misma pantalla. Se abre al pedirlo y queda abierto para agregar
  // varias redes sin volver a tocar el toggle.
  const [isAddingAccount, setIsAddingAccount] = useState(false);

  function toggleFormat(format: string): void {
    const isSelected = draft.preferred_formats.includes(format);
    updateDraft({
      preferred_formats: isSelected
        ? draft.preferred_formats.filter((f) => f !== format)
        : [...draft.preferred_formats, format],
    });
  }

  function addSocialAccount(): void {
    if (!handle.trim()) return;
    updateDraft({
      social_accounts: [
        ...draft.social_accounts,
        { platform, handle: handle.trim(), url: null, follower_count: null },
      ],
    });
    setHandle("");
  }

  function removeSocialAccount(index: number): void {
    updateDraft({
      social_accounts: draft.social_accounts.filter((_, i) => i !== index),
    });
  }

  return (
    <div className="space-y-6">
      <fieldset className="space-y-2">
        <legend className={FIELD_LABEL_CLASS}>Formatos favoritos (opcional)</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {FORMATS.map((format) => {
            const id = `format-${format}`;
            return (
              <label
                key={format}
                htmlFor={id}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-glass-edge bg-surface-container-lowest/30 px-3 py-2.5 text-sm text-on-surface transition-colors duration-150 has-[:checked]:border-primary has-[:checked]:bg-primary/10"
              >
                <input
                  id={id}
                  type="checkbox"
                  checked={draft.preferred_formats.includes(format)}
                  onChange={() => toggleFormat(format)}
                  className="h-4 w-4 accent-primary"
                />
                {FORMAT_LABELS[format] ?? format}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className={FIELD_LABEL_CLASS}>Redes sociales (opcional)</legend>

        {draft.social_accounts.length > 0 ? (
          <ul className="space-y-2">
            {draft.social_accounts.map((account, index) => (
              <li
                key={`${account.platform}-${account.handle}-${index}`}
                className="flex items-center justify-between rounded-xl border border-glass-edge bg-surface-container-lowest/30 px-3 py-2 text-sm text-on-surface"
              >
                <span>
                  {PLATFORM_LABELS[account.platform] ?? account.platform}: @{account.handle}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => removeSocialAccount(index)}
                  aria-label={`Eliminar red social ${account.platform} ${account.handle}`}
                  className="!w-auto !rounded-sm !p-1.5 !text-danger"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        {isAddingAccount ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <label htmlFor="social-platform" className={FIELD_LABEL_CLASS}>
                Plataforma
              </label>
              <select
                id="social-platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className={inputClass(false, false)}
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_LABELS[p] ?? p}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <Field
                id="social-handle"
                label="Usuario"
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@usuario"
                icon={<AtSign aria-hidden="true" size={18} strokeWidth={1.5} className={FIELD_ICON_CLASS} />}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={addSocialAccount}
              className="!w-auto inline-flex items-center justify-center gap-2 !py-2.5 px-4"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Agregar
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsAddingAccount(true)}
            className="!w-auto inline-flex items-center justify-center gap-2 !py-2.5 px-4"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Agregar red social
          </Button>
        )}
      </fieldset>
    </div>
  );
}
