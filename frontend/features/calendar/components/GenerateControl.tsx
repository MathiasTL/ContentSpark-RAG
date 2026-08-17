"use client";

import { Repeat2 } from "lucide-react";
import Alert from "@/shared/components/ui/Alert";
import Button from "@/shared/components/ui/Button";
import Field, { FIELD_ICON_CLASS, FIELD_LABEL_CLASS, inputClass } from "@/shared/components/ui/Field";
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
  const { draft, updateDraft, submit, isGenerating, error } = useCalendarGeneration();

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
    <section className="rounded-3xl border border-glass-edge bg-surface-container-lowest/10 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
      <h2 className="mb-6 text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">
        Generar calendario
      </h2>

      <div className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="generate-period" className={FIELD_LABEL_CLASS}>
            Periodo
          </label>
          <select
            id="generate-period"
            value={draft.period}
            onChange={(e) =>
              updateDraft({ period: e.target.value as typeof draft.period })
            }
            className={inputClass(false, false)}
          >
            {PERIOD_OPTIONS.map((period) => (
              <option key={period} value={period}>
                {PERIOD_LABELS[period]}
              </option>
            ))}
          </select>
        </div>

        <Field
          id="generate-frequency"
          label="Frecuencia (opcional)"
          type="number"
          min={1}
          max={14}
          value={draft.frequency ?? ""}
          onChange={(e) =>
            updateDraft({
              frequency: e.target.value === "" ? null : Number(e.target.value),
            })
          }
          placeholder="Usar recomendación del servidor"
          icon={<Repeat2 aria-hidden="true" size={18} strokeWidth={1.5} className={FIELD_ICON_CLASS} />}
        />

        <fieldset className="space-y-2">
          <legend className={FIELD_LABEL_CLASS}>Cantidad por formato (opcional)</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FORMATS.map((format) => {
              const id = `generate-format-${format}`;
              return (
                <div key={format} className="space-y-1">
                  <label htmlFor={id} className="ml-1 text-xs text-on-surface-variant">
                    {FORMAT_LABELS[format] ?? format}
                  </label>
                  <input
                    id={id}
                    type="number"
                    min={0}
                    value={draft.formats?.[format] ?? ""}
                    onChange={(e) => handleFormatCountChange(format, e.target.value)}
                    className="w-full rounded-xl border border-glass-edge bg-surface-container-lowest/30 px-3 py-2 text-sm text-on-surface outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-primary/25"
                  />
                </div>
              );
            })}
          </div>
        </fieldset>

        {error && <Alert tone="danger">{error}</Alert>}

        <Button type="button" onClick={() => void submit()} disabled={isGenerating} className="shadow-lg">
          {isGenerating ? "Generando…" : "Generar con AI"}
        </Button>
      </div>
    </section>
  );
}
