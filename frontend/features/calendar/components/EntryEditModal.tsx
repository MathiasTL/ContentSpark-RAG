"use client";

import { useEffect, useRef, useState } from "react";
import { Type, Zap } from "lucide-react";
import Alert from "@/shared/components/ui/Alert";
import Button from "@/shared/components/ui/Button";
import Field, { FIELD_ICON_CLASS, FIELD_LABEL_CLASS, inputClass } from "@/shared/components/ui/Field";
import { FORMATS, PLATFORMS, TIME_SLOT_LABELS, TIME_SLOTS } from "@/shared/constants";
import type { EntryItem, EntryUpdateInput } from "../services/calendar-api";
import { useCalendarStore } from "../store/calendarStore";

interface EntryEditModalProps {
  entry: EntryItem;
  onClose: () => void;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

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
  const error = useCalendarStore((s) => s.error);
  const [fields, setFields] = useState<EditableFields>(toFields(entry));
  const initial = toFields(entry);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    firstFocusable?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      triggerRef.current?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // updateEntry catches its own failures (calendarStore) and records them
    // in `error` instead of throwing — read the store directly right after
    // the await so the modal stays open and shows the message on failure,
    // instead of closing silently.
    if (!useCalendarStore.getState().error) {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Editar entrada"
        className="w-full max-w-lg rounded-3xl border border-glass-edge bg-surface-container-lowest/10 p-6 shadow-2xl backdrop-blur-xl sm:p-8"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-on-surface sm:text-2xl">
            Editar entrada
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-on-surface-variant/60 transition-colors duration-150 hover:text-primary-container"
          >
            ✕
          </button>
        </div>

        {error && (
          <Alert tone="danger" className="mb-4">
            {error}
          </Alert>
        )}

        <div className="space-y-4">
          <Field
            id="entry-title"
            label="Título"
            type="text"
            value={fields.title}
            onChange={(e) => updateField("title", e.target.value)}
            icon={<Type aria-hidden="true" size={18} strokeWidth={1.5} className={FIELD_ICON_CLASS} />}
          />

          <Field
            id="entry-hook"
            label="Hook"
            type="text"
            value={fields.hook}
            onChange={(e) => updateField("hook", e.target.value)}
            icon={<Zap aria-hidden="true" size={18} strokeWidth={1.5} className={FIELD_ICON_CLASS} />}
          />

          <div className="space-y-1.5">
            <label htmlFor="entry-description" className={FIELD_LABEL_CLASS}>
              Descripción
            </label>
            <textarea
              id="entry-description"
              value={fields.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={3}
              className={inputClass(false, false)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="entry-format" className={FIELD_LABEL_CLASS}>
                Formato
              </label>
              <select
                id="entry-format"
                value={fields.format}
                onChange={(e) => updateField("format", e.target.value)}
                className={inputClass(false, false)}
              >
                {FORMATS.map((format) => (
                  <option key={format} value={format}>
                    {FORMAT_LABELS[format] ?? format}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="entry-platform" className={FIELD_LABEL_CLASS}>
                Plataforma
              </label>
              <select
                id="entry-platform"
                value={fields.platform}
                onChange={(e) => updateField("platform", e.target.value)}
                className={inputClass(false, false)}
              >
                {PLATFORMS.map((platform) => (
                  <option key={platform} value={platform}>
                    {PLATFORM_LABELS[platform] ?? platform}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="entry-status" className={FIELD_LABEL_CLASS}>
                Estado
              </label>
              <select
                id="entry-status"
                value={fields.status}
                onChange={(e) => updateField("status", e.target.value)}
                className={inputClass(false, false)}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="entry-time-slot" className={FIELD_LABEL_CLASS}>
                Horario
              </label>
              <select
                id="entry-time-slot"
                value={fields.time_slot}
                onChange={(e) => updateField("time_slot", e.target.value)}
                className={inputClass(false, false)}
              >
                <option value="">Sin definir</option>
                {TIME_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {TIME_SLOT_LABELS[slot]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose} className="!w-auto px-5">
            Cancelar
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => void handleSubmit()}
            className="!w-auto px-5 shadow-lg"
          >
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}
