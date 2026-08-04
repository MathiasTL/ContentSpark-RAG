"use client";

import { useState } from "react";
import { FORMATS, PLATFORMS } from "@/shared/constants";
import type { EntryItem, EntryUpdateInput } from "../services/calendar-api";
import { useCalendarStore } from "../store/calendarStore";

interface EntryEditModalProps {
  entry: EntryItem;
  onClose: () => void;
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

const STATUS_OPTIONS = ["idea", "drafted", "recorded", "published"] as const;
const STATUS_LABELS: Record<string, string> = {
  idea: "Idea",
  drafted: "Borrador",
  recorded: "Grabado",
  published: "Publicado",
};

interface EditableFields {
  title: string;
  hook: string;
  description: string;
  format: string;
  platform: string;
  status: string;
  time_slot: string;
}

function toFields(entry: EntryItem): EditableFields {
  return {
    title: entry.title,
    hook: entry.hook ?? "",
    description: entry.description ?? "",
    format: entry.format,
    platform: entry.platform,
    status: entry.status,
    time_slot: entry.time_slot ?? "",
  };
}

export default function EntryEditModal({ entry, onClose }: EntryEditModalProps) {
  const updateEntry = useCalendarStore((s) => s.updateEntry);
  const [fields, setFields] = useState<EditableFields>(toFields(entry));
  const initial = toFields(entry);

  function updateField<K extends keyof EditableFields>(key: K, value: EditableFields[K]): void {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(): Promise<void> {
    const partial: EntryUpdateInput = {};
    (Object.keys(fields) as (keyof EditableFields)[]).forEach((key) => {
      if (fields[key] !== initial[key]) {
        partial[key] = fields[key];
      }
    });
    await updateEntry(entry.id, partial);
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg rounded-[2rem] border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-on-surface sm:text-2xl">
            Editar entrada
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-on-surface-variant/60 transition-all hover:text-primary-container"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="entry-title"
              className="ml-1 text-xs font-medium uppercase tracking-widest text-on-surface-variant"
            >
              Título
            </label>
            <input
              id="entry-title"
              type="text"
              value={fields.title}
              onChange={(e) => updateField("title", e.target.value)}
              className="w-full rounded-2xl border border-white/40 bg-surface-container-lowest/30 px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="entry-hook"
              className="ml-1 text-xs font-medium uppercase tracking-widest text-on-surface-variant"
            >
              Hook
            </label>
            <input
              id="entry-hook"
              type="text"
              value={fields.hook}
              onChange={(e) => updateField("hook", e.target.value)}
              className="w-full rounded-2xl border border-white/40 bg-surface-container-lowest/30 px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="entry-description"
              className="ml-1 text-xs font-medium uppercase tracking-widest text-on-surface-variant"
            >
              Descripción
            </label>
            <textarea
              id="entry-description"
              value={fields.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-white/40 bg-surface-container-lowest/30 px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="entry-format"
                className="ml-1 text-xs font-medium uppercase tracking-widest text-on-surface-variant"
              >
                Formato
              </label>
              <select
                id="entry-format"
                value={fields.format}
                onChange={(e) => updateField("format", e.target.value)}
                className="w-full rounded-2xl border border-white/40 bg-surface-container-lowest/30 px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {FORMATS.map((format) => (
                  <option key={format} value={format}>
                    {FORMAT_LABELS[format] ?? format}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="entry-platform"
                className="ml-1 text-xs font-medium uppercase tracking-widest text-on-surface-variant"
              >
                Plataforma
              </label>
              <select
                id="entry-platform"
                value={fields.platform}
                onChange={(e) => updateField("platform", e.target.value)}
                className="w-full rounded-2xl border border-white/40 bg-surface-container-lowest/30 px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {PLATFORMS.map((platform) => (
                  <option key={platform} value={platform}>
                    {PLATFORM_LABELS[platform] ?? platform}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="entry-status"
                className="ml-1 text-xs font-medium uppercase tracking-widest text-on-surface-variant"
              >
                Estado
              </label>
              <select
                id="entry-status"
                value={fields.status}
                onChange={(e) => updateField("status", e.target.value)}
                className="w-full rounded-2xl border border-white/40 bg-surface-container-lowest/30 px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="entry-time-slot"
                className="ml-1 text-xs font-medium uppercase tracking-widest text-on-surface-variant"
              >
                Horario
              </label>
              <input
                id="entry-time-slot"
                type="time"
                value={fields.time_slot}
                onChange={(e) => updateField("time_slot", e.target.value)}
                className="w-full rounded-2xl border border-white/40 bg-surface-container-lowest/30 px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/40 bg-surface-container-lowest/20 px-5 py-2.5 text-sm font-medium text-on-surface transition-all hover:bg-surface-container-lowest/40"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.01] active:scale-95"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
