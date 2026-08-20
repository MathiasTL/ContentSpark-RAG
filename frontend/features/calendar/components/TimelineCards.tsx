"use client";

import { motion } from "framer-motion";
import { TIME_SLOT_HOURS, TIME_SLOT_LABELS } from "@/shared/constants";
import type { EntryItem } from "../services/calendar-api";
import { useCalendarStore } from "../store/calendarStore";
import { platformLabel } from "./platformStyles";

interface TimelineCardsProps {
  onEditEntry?: (entryId: string) => void;
}

const DAYS_OF_WEEK = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// Ver platformStyles.ts: una plataforma se identifica solo por su etiqueta de
// texto, no por un color propio — el sistema de diseño no tiene una paleta
// de cinco tonos categóricos. El acento primario queda para lo accionable.
const PLATFORM_BADGE_STYLE = "text-on-surface-variant";
const PLATFORM_PANEL_STYLE = "bg-surface-container-lowest/10";

const STATUS_STYLES: Record<string, { label: string; style: string }> = {
  idea: {
    label: "Idea",
    style: "bg-surface-container-lowest/10 text-on-surface-variant border border-glass-edge",
  },
  drafted: {
    label: "Borrador",
    style: "bg-surface-container-lowest/10 text-on-surface-variant border border-glass-edge",
  },
  recorded: {
    label: "Grabado",
    style: "bg-primary text-on-primary border border-glass-edge",
  },
  published: {
    label: "Publicado",
    style: "bg-secondary text-on-primary border border-glass-edge",
  },
};
const DEFAULT_STATUS_STYLE = STATUS_STYLES.idea;

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.5, ease: "easeOut" as const },
  }),
};

function parseEntryDateTime(entry: EntryItem): Date {
  // entry.time_slot is a semantic label ("morning"/"afternoon"/"evening"),
  // never a clock time — map it to a representative hour via the shared
  // constant instead of parsing the label itself as HH:MM. `new Date` on
  // an unmapped/legacy value (or the label itself) would silently produce
  // an Invalid Date, which always compares false and made the week
  // filter permanently empty.
  const hours =
    (entry.time_slot && TIME_SLOT_HOURS[entry.time_slot as keyof typeof TIME_SLOT_HOURS]) ??
    "00:00";
  return new Date(`${entry.date}T${hours}:00`);
}

function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function isWithinCurrentWeek(entry: EntryItem, weekStart: Date): boolean {
  const entryDateTime = parseEntryDateTime(entry);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return entryDateTime >= weekStart && entryDateTime < weekEnd;
}

function formatScheduledAt(entry: EntryItem): string {
  const parsed = new Date(`${entry.date}T00:00:00`);
  const weekday = DAYS_OF_WEEK[parsed.getDay()];
  // Se muestra la etiqueta traducida, nunca el identificador crudo del
  // backend ("morning"), que no es copy de interfaz.
  const slotLabel =
    entry.time_slot &&
    TIME_SLOT_LABELS[entry.time_slot as keyof typeof TIME_SLOT_LABELS];
  return slotLabel ? `${weekday}, ${slotLabel}` : weekday;
}

export default function TimelineCards({ onEditEntry }: TimelineCardsProps) {
  const currentCalendar = useCalendarStore((s) => s.currentCalendar);

  const weekStart = startOfWeek(new Date());
  const upcomingEntries = (currentCalendar?.entries ?? [])
    .filter((entry) => isWithinCurrentWeek(entry, weekStart))
    .sort((a, b) => parseEntryDateTime(a).getTime() - parseEntryDateTime(b).getTime());

  return (
    <section>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-on-surface sm:text-3xl lg:text-4xl">
            Línea de tiempo
          </h2>
          <p className="mt-1 text-sm font-light text-on-surface-variant">
            Tu cola de contenido para esta semana
          </p>
        </div>
        <div className="hidden gap-3 sm:flex">
          <button
            disabled
            title="Próximamente"
            aria-label="Anterior"
            className="rounded-2xl border border-glass-edge bg-surface-container-lowest/10 p-2.5 text-on-surface-variant shadow-sm backdrop-blur-md transition-colors duration-150 hover:bg-surface-container-lowest/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface-container-lowest/10"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            disabled
            title="Próximamente"
            aria-label="Siguiente"
            className="rounded-2xl border border-glass-edge bg-surface-container-lowest/10 p-2.5 text-on-surface-variant shadow-sm backdrop-blur-md transition-colors duration-150 hover:bg-surface-container-lowest/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface-container-lowest/10"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {upcomingEntries.map((entry, i) => {
          const statusStyle = STATUS_STYLES[entry.status] ?? DEFAULT_STATUS_STYLE;

          return (
            <motion.div
              key={entry.id}
              custom={i}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="group overflow-hidden rounded-3xl border border-glass-edge-soft bg-surface-container-lowest/5 shadow-2xl backdrop-blur-md transition-colors duration-150 hover:border-glass-edge"
            >
              {/* Imagen placeholder: superficie de vidrio plana, sin gradiente
                  decorativo (DESIGN.md prohíbe el gradiente como relleno). */}
              <div className={`relative h-44 overflow-hidden ${PLATFORM_PANEL_STYLE} sm:h-48`}>
                {/* Patrón decorativo */}
                <div className="absolute inset-0 opacity-30">
                  <div className="absolute left-1/4 top-1/4 h-32 w-32 rounded-full bg-surface-container-lowest/10 blur-2xl" />
                  <div className="absolute bottom-1/4 right-1/4 h-24 w-24 rounded-full bg-surface-container-lowest/5 blur-xl" />
                </div>
                {/* Icono de plataforma */}
                <div className="absolute left-4 top-4">
                  <span
                    className={`rounded-full bg-surface-container-lowest/90 px-3.5 py-1 text-xs font-bold uppercase tracking-wider shadow-lg backdrop-blur-xl ${PLATFORM_BADGE_STYLE}`}
                  >
                    {platformLabel(entry.platform)}
                  </span>
                </div>
                <div className="absolute bottom-4 right-4">
                  <span
                    className={`rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-widest shadow-lg ${statusStyle.style}`}
                  >
                    {statusStyle.label}
                  </span>
                </div>
              </div>

              {/* Contenido */}
              <div className="p-6">
                <h3 className="mb-2 text-lg font-bold leading-tight text-on-surface">
                  {entry.title}
                </h3>
                <p className="line-clamp-2 text-sm font-light leading-relaxed text-on-surface-variant">
                  {entry.description ?? entry.hook ?? ""}
                </p>
                <div className="mt-5 flex items-center justify-between">
                  <span className="rounded-lg bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary-container">
                    {formatScheduledAt(entry)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onEditEntry?.(entry.id)}
                    aria-label="Más opciones"
                    className="text-on-surface-variant/60 transition-colors duration-150 hover:text-primary-container"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="5" cy="12" r="1.5" />
                      <circle cx="12" cy="12" r="1.5" />
                      <circle cx="19" cy="12" r="1.5" />
                    </svg>
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
