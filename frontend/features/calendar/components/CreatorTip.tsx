"use client";

import { motion } from "framer-motion";

export default function CreatorTip() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7, duration: 0.5 }}
      className="rounded-[2rem] border border-white/20 bg-white/10 p-6 shadow-xl backdrop-blur-2xl sm:p-8"
    >
      <div className="mb-3 flex items-center gap-2.5 text-[#b08cff] sm:mb-4">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
        </svg>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Tip del creador</span>
      </div>
      <p className="text-sm font-light leading-relaxed text-white/70">
        Tu audiencia está más activa a las{" "}
        <span className="font-bold text-[#b08cff]">7:00 PM</span>. Programa tu
        próximo Reel a esa hora para un{" "}
        <span className="font-bold text-white">20% más de alcance</span>.
      </p>
    </motion.div>
  );
}
