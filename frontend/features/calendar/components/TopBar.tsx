"use client";

import { useState } from "react";

export default function TopBar() {
  const [view, setView] = useState<"month" | "week">("month");

  return (
    <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-white/5 px-6 py-5 backdrop-blur-xl sm:px-8">
      {/* Breadcrumb */}
      <nav className="flex items-center text-sm font-light text-white/60">
        <span>Workflow</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-2 text-white/30">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="border-b-2 border-[#6e2ce0]/40 pb-0.5 font-bold text-[#b08cff]">
          Visual Workflow
        </span>
      </nav>

      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        {/* Tabs de vista (solo desktop) */}
        <div className="hidden gap-6 sm:flex">
          {["Timeline", "Grid View", "Statistics"].map((tab) => (
            <button
              key={tab}
              className="text-xs font-semibold uppercase tracking-wider text-white/50 transition-colors hover:text-[#b08cff]"
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Toggle mes/semana */}
        <div className="flex rounded-2xl border border-white/10 bg-white/5 p-1 backdrop-blur-md">
          <button
            onClick={() => setView("month")}
            className={`rounded-xl px-4 py-1.5 text-xs font-bold uppercase tracking-widest transition-all ${
              view === "month"
                ? "bg-white/15 text-[#b08cff] shadow-lg"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            Mes
          </button>
          <button
            onClick={() => setView("week")}
            className={`rounded-xl px-4 py-1.5 text-xs font-bold uppercase tracking-widest transition-all ${
              view === "week"
                ? "bg-white/15 text-[#b08cff] shadow-lg"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            Semana
          </button>
        </div>

        {/* Sync Calendar */}
        <button className="rounded-full border border-white/20 bg-white/10 px-5 py-2 text-xs font-bold uppercase tracking-widest text-white/80 shadow-sm backdrop-blur-md transition-all hover:bg-white/20 active:scale-95">
          Sync Calendar
        </button>

        {/* Notificaciones */}
        <button className="text-white/50 transition-colors hover:text-[#b08cff]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>

        {/* Avatar */}
        <div className="h-9 w-9 rounded-full border-2 border-white/30 bg-gradient-to-br from-[#6e2ce0] to-[#b08cff] p-0.5 shadow-md">
          <div className="flex h-full w-full items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">
            M
          </div>
        </div>
      </div>
    </header>
  );
}
