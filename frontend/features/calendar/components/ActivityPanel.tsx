"use client";

import { motion } from "framer-motion";

export default function ActivityPanel() {
  return (
    <motion.section
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.6, duration: 0.5 }}
      className="rounded-[2rem] border border-white/10 bg-surface-container-lowest/5 p-6 shadow-2xl backdrop-blur-md sm:p-8"
    >
      <h3 className="mb-6 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant sm:mb-8">
        Actividad del día
      </h3>

      <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
        <svg
          className="text-on-surface-variant/50"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <p className="text-sm font-light leading-relaxed text-on-surface-variant">
          Aún no hay actividad reciente.
        </p>
        <p className="text-xs font-light leading-relaxed text-on-surface-variant/70">
          Las acciones sobre tu calendario van a aparecer acá a medida que ocurran.
        </p>
      </div>

      <button
        disabled
        title="Próximamente"
        className="mt-8 w-full rounded-2xl border border-primary/10 bg-primary/10 py-3.5 text-xs font-bold uppercase tracking-widest text-primary-container transition-all hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-primary/10 sm:mt-10"
      >
        Ver log detallado
      </button>
    </motion.section>
  );
}
