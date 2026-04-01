"use client";

import { motion } from "framer-motion";

const bars = [40, 60, 30, 90, 50, 75, 45];

export default function PerformancePanel() {
  return (
    <motion.section
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-md sm:p-8"
    >
      <div className="mb-6 flex items-center justify-between sm:mb-8">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/80">
          Performance Peak
        </h3>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b08cff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
      </div>

      {/* Gráfico de barras */}
      <div className="relative flex h-32 items-end justify-between gap-1.5 px-2 sm:h-36">
        {bars.map((height, i) => (
          <motion.div
            key={i}
            initial={{ height: 0 }}
            animate={{ height: `${height}%` }}
            transition={{ delay: 0.6 + i * 0.08, duration: 0.6, ease: "easeOut" }}
            className={`w-2.5 rounded-t-full ${
              height === Math.max(...bars)
                ? "bg-gradient-to-t from-[#6e2ce0] to-[#b08cff] shadow-lg shadow-[#6e2ce0]/20"
                : "bg-[#6e2ce0]/20"
            }`}
          />
        ))}
      </div>

      {/* Stats */}
      <div className="mt-6 flex items-center justify-between sm:mt-8">
        <div>
          <p className="text-2xl font-bold text-white sm:text-3xl">8.4k</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
            Alcance
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-emerald-400 sm:text-3xl">+12%</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
            Semanal
          </p>
        </div>
      </div>
    </motion.section>
  );
}
