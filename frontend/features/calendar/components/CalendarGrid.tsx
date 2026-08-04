"use client";

import { motion } from "framer-motion";
import type { EntryItem } from "../services/calendar-api";
import { useCalendarStore } from "../store/calendarStore";

interface CalendarGridProps {
  onEditEntry?: (entryId: string) => void;
}

interface GridCell {
  date: Date;
  isCurrentMonth: boolean;
}

const DAYS_OF_WEEK = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const PLATFORM_CHIP_STYLES: Record<string, { color: string; textColor: string }> = {
  instagram: { color: "border-primary bg-primary/10", textColor: "text-primary-container" },
  tiktok: { color: "border-pink-500 bg-pink-500/10", textColor: "text-pink-400" },
  youtube: { color: "border-red-500 bg-red-500/10", textColor: "text-red-400" },
  x: { color: "border-blue-400 bg-blue-400/10", textColor: "text-blue-400" },
  linkedin: { color: "border-sky-500 bg-sky-500/10", textColor: "text-sky-400" },
};
const DEFAULT_CHIP_STYLE = {
  color: "border-white/20 bg-surface-container-lowest/10",
  textColor: "text-on-surface-variant",
};

function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthCells(anchor: Date): GridCell[] {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingOffset = new Date(year, month, 1).getDay();

  const cells: GridCell[] = [];
  for (let i = leadingOffset; i > 0; i--) {
    cells.push({ date: new Date(year, month, 1 - i), isCurrentMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: new Date(year, month, day), isCurrentMonth: true });
  }
  const trailing = (7 - (cells.length % 7)) % 7;
  for (let day = 1; day <= trailing; day++) {
    cells.push({ date: new Date(year, month + 1, day), isCurrentMonth: false });
  }
  return cells;
}

function getWeekCells(anchor: Date): GridCell[] {
  const weekStart = new Date(anchor);
  weekStart.setDate(anchor.getDate() - anchor.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    return { date, isCurrentMonth: date.getMonth() === anchor.getMonth() };
  });
}

export default function CalendarGrid({ onEditEntry }: CalendarGridProps) {
  const currentCalendar = useCalendarStore((s) => s.currentCalendar);
  const viewMode = useCalendarStore((s) => s.viewMode);

  const anchor = currentCalendar?.start_date
    ? new Date(`${currentCalendar.start_date}T00:00:00`)
    : new Date();

  const cells = viewMode === "week" ? getWeekCells(anchor) : getMonthCells(anchor);
  const headerLabel = `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`;

  const entriesByDate = new Map<string, EntryItem[]>();
  (currentCalendar?.entries ?? []).forEach((entry) => {
    const list = entriesByDate.get(entry.date) ?? [];
    list.push(entry);
    entriesByDate.set(entry.date, list);
  });

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="rounded-[2rem] border border-white/10 bg-surface-container-lowest/5 p-6 shadow-2xl backdrop-blur-md sm:rounded-[3rem] sm:p-8 lg:p-10"
    >
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">
          Calendario completo
        </h2>
        <span className="text-base font-light text-on-surface-variant sm:text-lg">
          {headerLabel}
        </span>
      </div>

      {/* Grid del calendario */}
      <div className="overflow-hidden rounded-2xl border border-white/10 sm:rounded-[2rem]">
        {/* Headers de días */}
        <div className="grid grid-cols-7">
          {DAYS_OF_WEEK.map((day) => (
            <div
              key={day}
              className="bg-surface-container-lowest/5 p-2 text-center text-[9px] font-bold uppercase tracking-[0.15em] text-on-surface-variant/70 sm:p-3 sm:text-[10px] sm:tracking-[0.2em]"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Celdas del calendario */}
        <div className="grid grid-cols-7 gap-px bg-surface-container-lowest/5">
          {cells.map((cell) => {
            const isoDate = toISODate(cell.date);
            const dayEntries = cell.isCurrentMonth ? entriesByDate.get(isoDate) : undefined;
            const entry = dayEntries?.[0];
            const chipStyle = entry
              ? PLATFORM_CHIP_STYLES[entry.platform] ?? DEFAULT_CHIP_STYLE
              : undefined;

            return (
              <div
                key={isoDate}
                data-testid={`calendar-cell-${isoDate}`}
                className={`min-h-[80px] p-2 transition-colors sm:min-h-[120px] sm:p-3 lg:min-h-[130px] lg:p-4 ${
                  cell.isCurrentMonth
                    ? "bg-surface-container-lowest/[0.02] hover:bg-surface-container-lowest/[0.06]"
                    : "bg-surface-container-lowest/[0.01] opacity-30"
                }`}
              >
                <span
                  className={`text-xs font-bold sm:text-sm ${
                    cell.isCurrentMonth ? "text-on-surface-variant" : "text-on-surface-variant/60"
                  }`}
                >
                  {cell.date.getDate()}
                </span>

                {entry && chipStyle && (
                  <button
                    type="button"
                    onClick={() => onEditEntry?.(entry.id)}
                    aria-label={`Editar ${entry.title}`}
                    className={`mt-2 block w-full rounded-lg border-l-[3px] p-1.5 text-left shadow-sm transition-transform hover:scale-[1.02] sm:mt-3 sm:rounded-xl sm:p-2 ${chipStyle.color}`}
                  >
                    <p
                      className={`truncate text-[8px] font-bold uppercase tracking-tight sm:text-[10px] sm:tracking-tighter ${chipStyle.textColor}`}
                    >
                      {entry.title}
                    </p>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}
