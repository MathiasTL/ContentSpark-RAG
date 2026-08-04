"use client";

import { FORMATS } from "@/shared/constants";
import { useCalendarGeneration } from "../hooks/useCalendarGeneration";

const FORMAT_LABELS: Record<string, string> = {
  short_video: "Video corto",
  carousel: "Carrusel",
  story: "Historia",
  long_video: "Video largo",
  post: "Post",
};

const PERIOD_LABELS: Record<string, string> = {
  current_week: "Esta semana",
  next_week: "Próxima semana",
  month: "Este mes",
};

const PERIOD_OPTIONS = ["current_week", "next_week", "month"] as const;

export default function GenerateControl() {
  const { draft, updateDraft, submit, isGenerating } = useCalendarGeneration();

  function handleFormatCountChange(format: string, rawValue: string): void {
    const count = rawValue === "" ? null : Number(rawValue);
    const nextFormats = { ...(draft.formats ?? {}) };
    if (count === null || Number.isNaN(count)) {
      delete nextFormats[format];
    } else {
      nextFormats[format] = count;
    }
    updateDraft({ formats: Object.keys(nextFormats).length > 0 ? nextFormats : null });
  }

  return (
    <section className="rounded-[2rem] border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-xl sm:rounded-[3rem] sm:p-8">
      <h2 className="mb-6 text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">
        Generar calendario
      </h2>

      <div className="space-y-5">
        <div className="space-y-1.5">
          <label
            htmlFor="generate-period"
            className="ml-1 text-xs font-medium uppercase tracking-widest text-on-surface-variant"
          >
            Periodo
          </label>
          <select
            id="generate-period"
            value={draft.period}
            onChange={(e) =>
              updateDraft({ period: e.target.value as typeof draft.period })
            }
            className="w-full rounded-2xl border border-white/40 bg-surface-container-lowest/30 px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            {PERIOD_OPTIONS.map((period) => (
              <option key={period} value={period}>
                {PERIOD_LABELS[period]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="generate-frequency"
            className="ml-1 text-xs font-medium uppercase tracking-widest text-on-surface-variant"
          >
            Frecuencia (opcional)
          </label>
          <input
            id="generate-frequency"
            type="number"
            min={0}
            value={draft.frequency ?? ""}
            onChange={(e) =>
              updateDraft({
                frequency: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            placeholder="Usar recomendación del servidor"
            className="w-full rounded-2xl border border-white/40 bg-surface-container-lowest/30 px-4 py-3 text-sm text-on-surface outline-none transition-all placeholder:text-[#75777b]/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="ml-1 text-xs font-medium uppercase tracking-widest text-on-surface-variant">
            Cantidad por formato (opcional)
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FORMATS.map((format) => {
              const id = `generate-format-${format}`;
              return (
                <div key={format} className="space-y-1">
                  <label htmlFor={id} className="ml-1 text-[11px] text-on-surface-variant">
                    {FORMAT_LABELS[format] ?? format}
                  </label>
                  <input
                    id={id}
                    type="number"
                    min={0}
                    value={draft.formats?.[format] ?? ""}
                    onChange={(e) => handleFormatCountChange(format, e.target.value)}
                    className="w-full rounded-xl border border-white/40 bg-surface-container-lowest/30 px-3 py-2 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              );
            })}
          </div>
        </fieldset>

        <button
          type="button"
          onClick={() => void submit()}
          disabled={isGenerating}
          className="w-full rounded-2xl bg-primary px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.01] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isGenerating ? "Generando…" : "Generar con AI"}
        </button>
      </div>
    </section>
  );
}
