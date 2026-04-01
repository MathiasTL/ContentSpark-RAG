"use client";

import { motion } from "framer-motion";

const activities = [
  {
    title: "Content Batching",
    description: "Grabando 3 reels hoy para mayor eficiencia.",
    iconBg: "bg-[#6e2ce0]/10 border-[#6e2ce0]/20",
    iconColor: "#b08cff",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
  {
    title: "Community Hour",
    description: "Responder comentarios top en post viral.",
    iconBg: "bg-blue-500/10 border-blue-500/20",
    iconColor: "#3b82f6",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    title: "Metric Review",
    description: "Analizando engagement del miércoles.",
    iconBg: "bg-pink-500/10 border-pink-500/20",
    iconColor: "#ec4899",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
];

export default function ActivityPanel() {
  return (
    <motion.section
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.6, duration: 0.5 }}
      className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-md sm:p-8"
    >
      <h3 className="mb-6 text-[11px] font-bold uppercase tracking-widest text-white/80 sm:mb-8">
        Actividad del día
      </h3>

      <div className="space-y-6 sm:space-y-8">
        {activities.map((item, i) => (
          <div key={i} className="group flex items-start gap-4">
            <div
              className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border transition-transform group-hover:scale-110 ${item.iconBg}`}
              style={{ color: item.iconColor }}
            >
              {item.icon}
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">{item.title}</h4>
              <p className="mt-0.5 text-xs font-light text-white/50">{item.description}</p>
            </div>
          </div>
        ))}
      </div>

      <button className="mt-8 w-full rounded-2xl border border-[#6e2ce0]/10 bg-[#6e2ce0]/10 py-3.5 text-xs font-bold uppercase tracking-widest text-[#b08cff] transition-all hover:bg-[#6e2ce0]/20 sm:mt-10">
        Ver log detallado
      </button>
    </motion.section>
  );
}
