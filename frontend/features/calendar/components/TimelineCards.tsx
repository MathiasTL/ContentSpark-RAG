"use client";

import { motion } from "framer-motion";
import type { EntryItem } from "../services/calendar-api";
import { useCalendarStore } from "../store/calendarStore";

interface TimelineCardsProps {
  onEditEntry?: (entryId: string) => void;
}

const NEXT_WINDOW_HOURS = 48;

const DAYS_OF_WEEK = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const PLATFORM_STYLES: Record<string, { label: string; color: string; gradient: string }> = {
  instagram: {
    label: "Instagram",
    color: "text-primary",
    gradient: "from-primary/20 to-primary-container/10",
  },
  tiktok: {
    label: "TikTok",
    color: "text-pink-400",
    gradient: "from-pink-500/20 to-pink-400/10",
  },
  x: {
    label: "X",
    color: "text-blue-400",
    gradient: "from-blue-500/20 to-blue-400/10",
  },
  youtube: {
    label: "YouTube",
    color: "text-red-400",
    gradient: "from-red-500/20 to-red-400/10",
  },
  linkedin: {
    label: "LinkedIn",
    color: "text-sky-400",
    gradient: "from-sky-500/20 to-sky-400/10",
  },
};
const DEFAULT_PLATFORM_STYLE = {
  label: "Contenido",
  color: "text-on-surface-variant",
  gradient: "from-surface-container-lowest/20 to-surface-container-lowest/10",
};

const STATUS_STYLES: Record<string, { label: string; style: string }> = {
  idea: {
    label: "Idea",
    style: "bg-surface-container-lowest/10 text-on-surface-variant border border-white/20",
  },
  drafted: {
    label: "Borrador",
    style: "bg-surface-container-lowest/10 text-on-surface-variant border border-white/20",
  },
  recorded: {
    label: "Grabado",
    style: "bg-primary text-white border border-white/20",
  },
  published: {
    label: "Publicado",
    style: "bg-secondary text-white border border-white/20",
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
  const time = entry.time_slot ?? "00:00";
  return new Date(`${entry.date}T${time}:00`);
}

function isWithinNextWindow(entry: EntryItem, now: Date, windowHours: number): boolean {
  const entryDateTime = parseEntryDateTime(entry);
  const windowEnd = new Date(now.getTime() + windowHours * 60 * 60 * 1000);
  return entryDateTime >= now && entryDateTime <= windowEnd;
}

function formatScheduledAt(entry: EntryItem): string {
  const parsed = new Date(`${entry.date}T00:00:00`);
  const weekday = DAYS_OF_WEEK[parsed.getDay()];
  return entry.time_slot ? `${weekday}, ${entry.time_slot}` : weekday;
}

export default function TimelineCards({ onEditEntry }: TimelineCardsProps) {
  const currentCalendar = useCalendarStore((s) => s.currentCalendar);

  const now = new Date();
  const upcomingEntries = (currentCalendar?.entries ?? [])
    .filter((entry) => isWithinNextWindow(entry, now, NEXT_WINDOW_HOURS))
    .sort((a, b) => parseEntryDateTime(a).getTime() - parseEntryDateTime(b).getTime());

  return (
    <section>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-on-surface sm:text-3xl lg:text-4xl">
            Visual Timeline
          </h2>
          <p className="mt-1 text-sm font-light text-on-surface-variant">
            Tu cola de contenido para las próximas 48 horas
          </p>
        </div>
        <div className="hidden gap-3 sm:flex">
          <button
            disabled
            title="Próximamente"
            aria-label="Anterior"
            className="rounded-2xl border border-white/20 bg-surface-container-lowest/10 p-2.5 shadow-sm backdrop-blur-md transition-all hover:bg-surface-container-lowest/20 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface-container-lowest/10 disabled:active:scale-100"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            disabled
            title="Próximamente"
            aria-label="Siguiente"
            className="rounded-2xl border border-white/20 bg-surface-container-lowest/10 p-2.5 shadow-sm backdrop-blur-md transition-all hover:bg-surface-container-lowest/20 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface-container-lowest/10 disabled:active:scale-100"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {upcomingEntries.map((entry, i) => {
          const platformStyle = PLATFORM_STYLES[entry.platform] ?? DEFAULT_PLATFORM_STYLE;
          const statusStyle = STATUS_STYLES[entry.status] ?? DEFAULT_STATUS_STYLE;

          return (
            <motion.div
              key={entry.id}
              custom={i}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="group overflow-hidden rounded-[2rem] border border-white/10 bg-surface-container-lowest/5 shadow-2xl backdrop-blur-md transition-all duration-500 hover:scale-[1.02] hover:border-white/20"
            >
              {/* Imagen placeholder con gradiente */}
              <div
                className={`relative h-44 overflow-hidden bg-gradient-to-br ${platformStyle.gradient} sm:h-48`}
              >
                {/* Patrón decorativo */}
                <div className="absolute inset-0 opacity-30">
                  <div className="absolute left-1/4 top-1/4 h-32 w-32 rounded-full bg-surface-container-lowest/10 blur-2xl transition-transform duration-700 group-hover:scale-125" />
                  <div className="absolute bottom-1/4 right-1/4 h-24 w-24 rounded-full bg-surface-container-lowest/5 blur-xl" />
                </div>
                {/* Icono de plataforma */}
                <div className="absolute left-4 top-4">
                  <span
                    className={`rounded-full bg-surface-container-lowest/90 px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-lg backdrop-blur-xl ${platformStyle.color}`}
                  >
                    {platformStyle.label}
                  </span>
                </div>
                <div className="absolute bottom-4 right-4">
                  <span
                    className={`rounded-full px-3.5 py-1 text-[10px] font-bold uppercase tracking-widest shadow-lg ${statusStyle.style}`}
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
                  <span className="rounded-lg bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-primary-container">
                    {formatScheduledAt(entry)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onEditEntry?.(entry.id)}
                    aria-label="Más opciones"
                    className="text-on-surface-variant/60 transition-all hover:text-primary-container"
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
