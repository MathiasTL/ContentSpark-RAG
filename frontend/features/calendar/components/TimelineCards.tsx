"use client";

import { motion } from "framer-motion";

interface ContentCard {
  id: string;
  platform: string;
  platformColor: string;
  status: string;
  statusStyle: string;
  title: string;
  description: string;
  scheduledAt: string;
  gradient: string;
}

const sampleCards: ContentCard[] = [
  {
    id: "1",
    platform: "Instagram",
    platformColor: "text-[#6e2ce0]",
    status: "Siguiente",
    statusStyle: "bg-[#6e2ce0] text-white border border-white/20",
    title: "Estrategia de hooks para retener audiencia",
    description: "Técnicas probadas de retención en los primeros 3 segundos de tu contenido.",
    scheduledAt: "Mañana, 10:00 AM",
    gradient: "from-[#6e2ce0]/20 to-[#b08cff]/10",
  },
  {
    id: "2",
    platform: "Twitter",
    platformColor: "text-blue-400",
    status: "Borrador",
    statusStyle: "bg-white/10 text-white/60 border border-white/20",
    title: "Hilo: Algoritmo de TikTok 2025",
    description: "Desglose completo de cómo funciona el algoritmo y cómo aprovecharlo.",
    scheduledAt: "Mié, 02:45 PM",
    gradient: "from-blue-500/20 to-blue-400/10",
  },
  {
    id: "3",
    platform: "TikTok",
    platformColor: "text-pink-400",
    status: "Listo",
    statusStyle: "bg-[#b4005d] text-white border border-white/20",
    title: "Tutorial: Edición con CapCut Pro",
    description: "Cómo lograr transiciones premium en tus videos cortos de forma sencilla.",
    scheduledAt: "Jue, 09:00 AM",
    gradient: "from-pink-500/20 to-pink-400/10",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.5, ease: "easeOut" as const },
  }),
};

export default function TimelineCards() {
  return (
    <section>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
            Visual Timeline
          </h2>
          <p className="mt-1 text-sm font-light text-white/50">
            Tu cola de contenido para las próximas 48 horas
          </p>
        </div>
        <div className="hidden gap-3 sm:flex">
          <button className="rounded-2xl border border-white/20 bg-white/10 p-2.5 shadow-sm backdrop-blur-md transition-all hover:bg-white/20 active:scale-90">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button className="rounded-2xl border border-white/20 bg-white/10 p-2.5 shadow-sm backdrop-blur-md transition-all hover:bg-white/20 active:scale-90">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {sampleCards.map((card, i) => (
          <motion.div
            key={card.id}
            custom={i}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="group overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-2xl backdrop-blur-md transition-all duration-500 hover:scale-[1.02] hover:border-white/20"
          >
            {/* Imagen placeholder con gradiente */}
            <div className={`relative h-44 overflow-hidden bg-gradient-to-br ${card.gradient} sm:h-48`}>
              {/* Patrón decorativo */}
              <div className="absolute inset-0 opacity-30">
                <div className="absolute left-1/4 top-1/4 h-32 w-32 rounded-full bg-white/10 blur-2xl transition-transform duration-700 group-hover:scale-125" />
                <div className="absolute bottom-1/4 right-1/4 h-24 w-24 rounded-full bg-white/5 blur-xl" />
              </div>
              {/* Icono de plataforma */}
              <div className="absolute left-4 top-4">
                <span className={`rounded-full bg-white/90 px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-lg backdrop-blur-xl ${card.platformColor}`}>
                  {card.platform}
                </span>
              </div>
              <div className="absolute bottom-4 right-4">
                <span className={`rounded-full px-3.5 py-1 text-[10px] font-bold uppercase tracking-widest shadow-lg ${card.statusStyle}`}>
                  {card.status}
                </span>
              </div>
            </div>

            {/* Contenido */}
            <div className="p-6">
              <h3 className="mb-2 text-lg font-bold leading-tight text-white">
                {card.title}
              </h3>
              <p className="line-clamp-2 text-sm font-light leading-relaxed text-white/50">
                {card.description}
              </p>
              <div className="mt-5 flex items-center justify-between">
                <span className="rounded-lg bg-[#6e2ce0]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#b08cff]">
                  {card.scheduledAt}
                </span>
                <button className="text-white/30 transition-all hover:text-[#b08cff]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="5" cy="12" r="1.5" />
                    <circle cx="12" cy="12" r="1.5" />
                    <circle cx="19" cy="12" r="1.5" />
                  </svg>
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
