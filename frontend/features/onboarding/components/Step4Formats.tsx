"use client";

import { useState } from "react";
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
        <legend className="ml-1 text-xs font-medium uppercase tracking-widest text-[#595c60]">
          Formatos favoritos (opcional)
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {FORMATS.map((format) => {
            const id = `format-${format}`;
            return (
              <label
                key={format}
                htmlFor={id}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/40 bg-white/30 px-3 py-2.5 text-sm text-[#2c2f33] transition-all has-[:checked]:border-[#6e2ce0] has-[:checked]:bg-[#6e2ce0]/10"
              >
                <input
                  id={id}
                  type="checkbox"
                  checked={draft.preferred_formats.includes(format)}
                  onChange={() => toggleFormat(format)}
                  className="h-4 w-4 accent-[#6e2ce0]"
                />
                {FORMAT_LABELS[format] ?? format}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="ml-1 text-xs font-medium uppercase tracking-widest text-[#595c60]">
          Redes sociales (opcional)
        </legend>

        {draft.social_accounts.length > 0 ? (
          <ul className="space-y-2">
            {draft.social_accounts.map((account, index) => (
              <li
                key={`${account.platform}-${account.handle}-${index}`}
                className="flex items-center justify-between rounded-xl border border-white/40 bg-white/30 px-3 py-2 text-sm text-[#2c2f33]"
              >
                <span>
                  {PLATFORM_LABELS[account.platform] ?? account.platform}: @{account.handle}
                </span>
                <button
                  type="button"
                  onClick={() => removeSocialAccount(index)}
                  aria-label={`Eliminar red social ${account.platform} ${account.handle}`}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="social-platform" className="sr-only">
              Plataforma
            </label>
            <select
              id="social-platform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-2.5 text-sm text-[#2c2f33] outline-none focus:border-[#6e2ce0] focus:ring-2 focus:ring-[#6e2ce0]/20"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_LABELS[p] ?? p}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 space-y-1.5">
            <label htmlFor="social-handle" className="sr-only">
              Usuario
            </label>
            <input
              id="social-handle"
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@usuario"
              className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-2.5 text-sm text-[#2c2f33] outline-none placeholder:text-[#75777b]/50 focus:border-[#6e2ce0] focus:ring-2 focus:ring-[#6e2ce0]/20"
            />
          </div>
          <button
            type="button"
            onClick={addSocialAccount}
            className="rounded-full border border-white/40 bg-white/20 px-4 py-2.5 text-sm font-medium text-[#2c2f33] transition-all hover:bg-white/40"
          >
            Agregar
          </button>
        </div>
      </fieldset>
    </div>
  );
}
