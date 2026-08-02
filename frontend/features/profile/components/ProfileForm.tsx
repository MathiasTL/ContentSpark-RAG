"use client";

import { useState } from "react";
import { useProfileStore } from "../store/profileStore";
import type { Profile, ProfileUpdateInput } from "../services/profile-api";
import { FORMATS, NICHES } from "@/shared/constants";

const NICHE_LABELS: Record<string, string> = {
  tecnologia: "Tecnología",
  fitness: "Fitness",
  finanzas: "Finanzas",
  educacion: "Educación",
  lifestyle: "Lifestyle",
  negocios: "Negocios",
};

const FORMAT_LABELS: Record<string, string> = {
  short_video: "Video corto",
  carousel: "Carrusel",
  story: "Historia",
  long_video: "Video largo",
  post: "Publicación",
};

// Campos editables del formulario (todos strings vacíos en vez de null
// para controlar los inputs; se re-mapean a null al armar el diff).
interface EditableFields {
  display_name: string;
  bio: string;
  niche: string;
  sub_niche: string;
  primary_goal: string;
  tone: string;
  target_audience: string;
  current_frequency: string;
  desired_frequency: string;
  preferred_formats: string[];
}

function toEditable(profile: Profile | null): EditableFields {
  return {
    display_name: profile?.display_name ?? "",
    bio: profile?.bio ?? "",
    niche: profile?.niche ?? "",
    sub_niche: profile?.sub_niche ?? "",
    primary_goal: profile?.primary_goal ?? "",
    tone: profile?.tone ?? "",
    target_audience: profile?.target_audience ?? "",
    current_frequency: profile?.current_frequency ?? "",
    desired_frequency: profile?.desired_frequency ?? "",
    preferred_formats: profile?.preferred_formats ?? [],
  };
}

// Diff entre el estado original (baseline) y el editado: solo incluye
// las claves que realmente cambiaron, para no resobrescribir campos
// que el usuario no tocó (consistente con el contrato de PUT parcial
// del backend — spec: "Partial update preserves other fields").
function diffEditable(
  baseline: EditableFields,
  edited: EditableFields,
): ProfileUpdateInput {
  const out: ProfileUpdateInput = {};

  (Object.keys(edited) as (keyof EditableFields)[]).forEach((key) => {
    const before = baseline[key];
    const after = edited[key];

    if (key === "preferred_formats") {
      const beforeArr = before as string[];
      const afterArr = after as string[];
      if (JSON.stringify(beforeArr) !== JSON.stringify(afterArr)) {
        out.preferred_formats = afterArr;
      }
      return;
    }

    if (before === after) return;
    const value = after as string;
    (out as Record<string, unknown>)[key] = value.trim() === "" ? null : value;
  });

  return out;
}

export default function ProfileForm() {
  const profile = useProfileStore((s) => s.profile);
  const error = useProfileStore((s) => s.error);
  const isLoading = useProfileStore((s) => s.isLoading);
  const save = useProfileStore((s) => s.save);

  // Sincroniza baseline/edited con el perfil del store cuando cambia de
  // identidad (p. ej. tras `load()`). Ajuste de estado durante el
  // render, no dentro de un efecto (react-hooks/set-state-in-effect).
  const [formState, setFormState] = useState(() => ({
    syncedProfile: profile,
    baseline: toEditable(profile),
    edited: toEditable(profile),
  }));
  if (formState.syncedProfile !== profile) {
    setFormState({
      syncedProfile: profile,
      baseline: toEditable(profile),
      edited: toEditable(profile),
    });
  }

  function updateField<K extends keyof EditableFields>(
    key: K,
    value: EditableFields[K],
  ): void {
    setFormState((prev) => ({ ...prev, edited: { ...prev.edited, [key]: value } }));
  }

  function toggleFormat(format: string): void {
    setFormState((prev) => {
      const current = prev.edited.preferred_formats;
      const next = current.includes(format)
        ? current.filter((f) => f !== format)
        : [...current, format];
      return { ...prev, edited: { ...prev.edited, preferred_formats: next } };
    });
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const partial = diffEditable(formState.baseline, formState.edited);
    if (Object.keys(partial).length === 0) return;
    try {
      await save(partial);
    } catch {
      // El error queda reflejado por el store (se muestra abajo).
    }
  }

  const { edited } = formState;

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
      {error ? (
        <p
          role="alert"
          className="rounded-2xl border border-red-200/60 bg-red-50/80 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <label
          htmlFor="display_name"
          className="ml-1 text-xs font-medium uppercase tracking-widest text-[#595c60]"
        >
          Nombre
        </label>
        <input
          id="display_name"
          type="text"
          value={edited.display_name}
          onChange={(e) => updateField("display_name", e.target.value)}
          className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm text-[#2c2f33] outline-none transition-all focus:border-[#6e2ce0] focus:ring-2 focus:ring-[#6e2ce0]/20"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="bio"
          className="ml-1 text-xs font-medium uppercase tracking-widest text-[#595c60]"
        >
          Biografía
        </label>
        <textarea
          id="bio"
          value={edited.bio}
          onChange={(e) => updateField("bio", e.target.value)}
          rows={3}
          className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm text-[#2c2f33] outline-none transition-all focus:border-[#6e2ce0] focus:ring-2 focus:ring-[#6e2ce0]/20"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="niche"
          className="ml-1 text-xs font-medium uppercase tracking-widest text-[#595c60]"
        >
          Nicho
        </label>
        <select
          id="niche"
          value={edited.niche}
          onChange={(e) => updateField("niche", e.target.value)}
          className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm text-[#2c2f33] outline-none transition-all focus:border-[#6e2ce0] focus:ring-2 focus:ring-[#6e2ce0]/20"
        >
          <option value="">Selecciona un nicho</option>
          {NICHES.map((n) => (
            <option key={n} value={n}>
              {NICHE_LABELS[n] ?? n}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="sub_niche"
          className="ml-1 text-xs font-medium uppercase tracking-widest text-[#595c60]"
        >
          Sub-nicho
        </label>
        <input
          id="sub_niche"
          type="text"
          value={edited.sub_niche}
          onChange={(e) => updateField("sub_niche", e.target.value)}
          className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm text-[#2c2f33] outline-none transition-all focus:border-[#6e2ce0] focus:ring-2 focus:ring-[#6e2ce0]/20"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="primary_goal"
          className="ml-1 text-xs font-medium uppercase tracking-widest text-[#595c60]"
        >
          Objetivo principal
        </label>
        <input
          id="primary_goal"
          type="text"
          value={edited.primary_goal}
          onChange={(e) => updateField("primary_goal", e.target.value)}
          className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm text-[#2c2f33] outline-none transition-all focus:border-[#6e2ce0] focus:ring-2 focus:ring-[#6e2ce0]/20"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="tone"
          className="ml-1 text-xs font-medium uppercase tracking-widest text-[#595c60]"
        >
          Tono
        </label>
        <input
          id="tone"
          type="text"
          value={edited.tone}
          onChange={(e) => updateField("tone", e.target.value)}
          className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm text-[#2c2f33] outline-none transition-all focus:border-[#6e2ce0] focus:ring-2 focus:ring-[#6e2ce0]/20"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="target_audience"
          className="ml-1 text-xs font-medium uppercase tracking-widest text-[#595c60]"
        >
          Audiencia objetivo
        </label>
        <input
          id="target_audience"
          type="text"
          value={edited.target_audience}
          onChange={(e) => updateField("target_audience", e.target.value)}
          className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm text-[#2c2f33] outline-none transition-all focus:border-[#6e2ce0] focus:ring-2 focus:ring-[#6e2ce0]/20"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label
            htmlFor="current_frequency"
            className="ml-1 text-xs font-medium uppercase tracking-widest text-[#595c60]"
          >
            Frecuencia actual
          </label>
          <input
            id="current_frequency"
            type="text"
            value={edited.current_frequency}
            onChange={(e) => updateField("current_frequency", e.target.value)}
            placeholder="Ej. 3 por semana"
            className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm text-[#2c2f33] outline-none transition-all placeholder:text-[#75777b]/50 focus:border-[#6e2ce0] focus:ring-2 focus:ring-[#6e2ce0]/20"
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="desired_frequency"
            className="ml-1 text-xs font-medium uppercase tracking-widest text-[#595c60]"
          >
            Frecuencia deseada
          </label>
          <input
            id="desired_frequency"
            type="text"
            value={edited.desired_frequency}
            onChange={(e) => updateField("desired_frequency", e.target.value)}
            placeholder="Ej. 5 por semana"
            className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm text-[#2c2f33] outline-none transition-all placeholder:text-[#75777b]/50 focus:border-[#6e2ce0] focus:ring-2 focus:ring-[#6e2ce0]/20"
          />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="ml-1 text-xs font-medium uppercase tracking-widest text-[#595c60]">
          Formatos preferidos
        </legend>
        <div className="flex flex-wrap gap-2">
          {FORMATS.map((format) => (
            <label
              key={format}
              className="flex items-center gap-2 rounded-full border border-white/40 bg-white/20 px-3 py-1.5 text-sm text-[#2c2f33]"
            >
              <input
                type="checkbox"
                checked={edited.preferred_formats.includes(format)}
                onChange={() => toggleFormat(format)}
              />
              {FORMAT_LABELS[format] ?? format}
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-full bg-gradient-to-r from-[#6e2ce0] to-[#b08cff] py-3 font-semibold text-white shadow-lg shadow-[#6e2ce0]/20 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:hover:scale-100"
      >
        {isLoading ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
