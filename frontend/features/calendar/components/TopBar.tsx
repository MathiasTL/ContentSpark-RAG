"use client";

import { useCalendarStore } from "../store/calendarStore";

export default function TopBar() {
  const view = useCalendarStore((s) => s.viewMode);
  const setView = useCalendarStore((s) => s.setViewMode);

  return (
    <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-4 border-b border-glass-edge-soft bg-surface-container-lowest/5 px-6 py-5 backdrop-blur-xl sm:px-8">
      <h1 className="text-xl font-semibold tracking-tight text-on-surface">Calendar</h1>

      {/* Toggle mes/semana */}
      <div className="flex rounded-2xl border border-glass-edge-soft bg-surface-container-lowest/5 p-1 backdrop-blur-md">
        <button
          onClick={() => setView("month")}
          className={`rounded-xl px-4 py-1.5 text-xs font-bold uppercase tracking-widest transition-all ${
            view === "month"
              ? "bg-surface-container-lowest/15 text-primary-container shadow-lg"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          Mes
        </button>
        <button
          onClick={() => setView("week")}
          className={`rounded-xl px-4 py-1.5 text-xs font-bold uppercase tracking-widest transition-all ${
            view === "week"
              ? "bg-surface-container-lowest/15 text-primary-container shadow-lg"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          Semana
        </button>
      </div>
    </header>
  );
}
