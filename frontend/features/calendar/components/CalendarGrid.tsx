"use client";

import { motion } from "framer-motion";

interface CalendarEvent {
  day: number;
  label: string;
  color: string;
  textColor: string;
  isHighlight?: boolean;
}

const events: CalendarEvent[] = [
  { day: 1, label: "IG: Morning Reel", color: "border-[#6e2ce0] bg-[#6e2ce0]/10", textColor: "text-[#b08cff]" },
  { day: 3, label: "TT: Vlog Recap", color: "border-pink-500 bg-pink-500/10", textColor: "text-pink-400" },
  { day: 7, label: "Live Event", color: "border-[#6e2ce0] bg-[#6e2ce0]", textColor: "text-white", isHighlight: true },
  { day: 10, label: "YT: Tutorial", color: "border-red-500 bg-red-500/10", textColor: "text-red-400" },
  { day: 14, label: "IG: Carrusel", color: "border-[#6e2ce0] bg-[#6e2ce0]/10", textColor: "text-[#b08cff]" },
  { day: 18, label: "TT: Trend", color: "border-pink-500 bg-pink-500/10", textColor: "text-pink-400" },
  { day: 22, label: "Thread X", color: "border-blue-400 bg-blue-400/10", textColor: "text-blue-400" },
  { day: 25, label: "IG: Story Q&A", color: "border-[#6e2ce0] bg-[#6e2ce0]/10", textColor: "text-[#b08cff]" },
  { day: 28, label: "TT: Collab", color: "border-pink-500 bg-pink-500/10", textColor: "text-pink-400" },
];

const DAYS_OF_WEEK = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// Octubre 2024 empieza en martes (índice 2)
const FIRST_DAY_OFFSET = 2;
const DAYS_IN_MONTH = 31;
const PREV_MONTH_DAYS = [29, 30]; // Últimos días del mes anterior

export default function CalendarGrid() {
  const cells: { day: number; isCurrentMonth: boolean }[] = [];

  // Días del mes anterior
  PREV_MONTH_DAYS.forEach((d) => cells.push({ day: d, isCurrentMonth: false }));

  // Días del mes actual
  for (let d = 1; d <= DAYS_IN_MONTH; d++) {
    cells.push({ day: d, isCurrentMonth: true });
  }

  // Completar última fila
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, isCurrentMonth: false });
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-md sm:rounded-[3rem] sm:p-8 lg:p-10"
    >
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Calendario completo
        </h2>
        <span className="text-base font-light text-white/50 sm:text-lg">Octubre 2024</span>
      </div>

      {/* Grid del calendario */}
      <div className="overflow-hidden rounded-2xl border border-white/10 sm:rounded-[2rem]">
        {/* Headers de días */}
        <div className="grid grid-cols-7">
          {DAYS_OF_WEEK.map((day) => (
            <div
              key={day}
              className="bg-white/5 p-2 text-center text-[9px] font-bold uppercase tracking-[0.15em] text-white/30 sm:p-3 sm:text-[10px] sm:tracking-[0.2em]"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Celdas del calendario */}
        <div className="grid grid-cols-7 gap-px bg-white/5">
          {cells.map((cell, idx) => {
            const event = cell.isCurrentMonth
              ? events.find((e) => e.day === cell.day)
              : undefined;

            return (
              <div
                key={idx}
                className={`min-h-[80px] p-2 transition-colors sm:min-h-[120px] sm:p-3 lg:min-h-[130px] lg:p-4 ${
                  cell.isCurrentMonth
                    ? "bg-white/[0.02] hover:bg-white/[0.06]"
                    : "bg-white/[0.01] opacity-30"
                } ${event?.isHighlight ? "relative" : ""}`}
              >
                <span
                  className={`text-xs font-bold sm:text-sm ${
                    cell.isCurrentMonth ? "text-white/70" : "text-white/30"
                  }`}
                >
                  {cell.day}
                </span>

                {event && (
                  <div
                    className={`mt-2 rounded-lg border-l-[3px] p-1.5 shadow-sm sm:mt-3 sm:rounded-xl sm:p-2 ${event.color} ${
                      event.isHighlight
                        ? "text-center shadow-xl"
                        : ""
                    }`}
                  >
                    <p
                      className={`truncate text-[8px] font-bold uppercase tracking-tight sm:text-[10px] sm:tracking-tighter ${event.textColor}`}
                    >
                      {event.label}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}
