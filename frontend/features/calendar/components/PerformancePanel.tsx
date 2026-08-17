"use client";

import { motion } from "framer-motion";

export default function PerformancePanel() {
  return (
    <motion.section
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="rounded-3xl border border-glass-edge-soft bg-surface-container-lowest/5 p-6 shadow-2xl backdrop-blur-md sm:p-8"
    >
      <div className="mb-6 flex items-center justify-between sm:mb-8">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
          Performance Peak
        </h3>
        <svg className="text-primary-container" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
      </div>

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
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
        <p className="text-sm font-light leading-relaxed text-on-surface-variant">
          Aún no hay datos de rendimiento.
        </p>
        <p className="text-xs font-light leading-relaxed text-on-surface-variant/70">
          Cuando confirmes y publiques entradas de tu calendario, vas a ver tu alcance acá.
        </p>
      </div>
    </motion.section>
  );
}
