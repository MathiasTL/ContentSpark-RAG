"use client";

import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.15 },
  }),
};

export default function FeaturesGrid() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-6 py-24 sm:px-8 sm:py-32">
      {/* Header */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={fadeUp}
        custom={0}
        className="mb-14 text-center sm:mb-16"
      >
        <h2 className="mb-4 text-2xl font-semibold text-white sm:text-3xl">
          Herramientas precisas para el creador moderno
        </h2>
        <p className="font-light text-white/50">
          Diseñadas con la fluidez del cristal líquido y la precisión del vidrio.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-3">
        {/* RAG para creadores — 2 cols */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          custom={1}
          className="group relative col-span-1 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-md sm:rounded-3xl sm:p-10 md:col-span-2"
        >
          <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-[#6e2ce0]/10 blur-3xl transition-all duration-700 group-hover:bg-[#6e2ce0]/20" />
          <div className="relative z-10 flex h-full flex-col">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-white/10 shadow-inner sm:mb-8 sm:h-14 sm:w-14 sm:rounded-2xl">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#b08cff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M3 5v7c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                <path d="M3 12v7c0 1.66 4 3 9 3s9-1.34 9-3v-7" />
              </svg>
            </div>
            <h3 className="mb-3 text-xl font-semibold text-white sm:mb-4 sm:text-2xl">
              RAG para Creadores
            </h3>
            <p className="mb-6 max-w-md font-light leading-relaxed text-white/50 sm:mb-8">
              Transforma tu archivo personal en una base de conocimiento consultable.
              Conecta tu trabajo previo, notas e investigación para generar ideas
              contextuales que suenen exactamente como tú.
            </p>
            <div className="mt-auto flex flex-wrap gap-3 sm:gap-4">
              {["PDFs", "URLs Web", "Qdrant"].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/60 sm:px-4 sm:py-2"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Onboarding inteligente — 1 col */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          custom={2}
          className="col-span-1 flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-md sm:rounded-3xl sm:p-10"
        >
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-white/10 shadow-inner sm:mb-8 sm:h-14 sm:w-14 sm:rounded-2xl">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#b08cff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </div>
          <h3 className="mb-3 text-xl font-semibold text-white sm:mb-4 sm:text-2xl">
            Onboarding Inteligente
          </h3>
          <p className="font-light leading-relaxed text-white/50">
            Comienza tu camino con un sistema que aprende tu voz, metas y
            audiencia objetivo en minutos. Sin plantillas vacías.
          </p>
          <div className="mt-6 w-full rounded-xl border border-white/10 bg-white/5 p-4 sm:mt-8 sm:rounded-2xl">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-[#6e2ce0] to-[#b08cff]" />
            </div>
            <p className="mt-2 text-[10px] font-medium uppercase tracking-widest text-white/30">
              Analizando tono... 67%
            </p>
          </div>
        </motion.div>

        {/* Calendario accionable — 3 cols */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          custom={3}
          className="col-span-1 overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md sm:rounded-3xl md:col-span-3"
        >
          <div className="flex flex-col items-center gap-8 p-8 sm:gap-12 sm:p-10 md:flex-row">
            <div className="md:w-1/2">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-white/10 shadow-inner sm:mb-8 sm:h-14 sm:w-14 sm:rounded-2xl">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#b08cff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <h3 className="mb-3 text-xl font-semibold text-white sm:mb-4 sm:text-2xl">
                Calendario Accionable
              </h3>
              <p className="mb-6 font-light leading-relaxed text-white/50">
                Más que una grilla. Un planificador impulsado por IA que identifica
                horas pico de engagement y sugiere pivotes de contenido basados en
                tendencias reales.
              </p>
              <a href="#" className="group/link inline-flex items-center gap-2 font-semibold text-[#b08cff]">
                Explorar calendario
                <svg className="transition-transform group-hover/link:translate-x-1" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
              </a>
            </div>
            <div className="w-full md:w-1/2">
              <div className="grid aspect-video grid-cols-7 gap-2 rounded-xl border border-white/10 bg-white/5 p-4 sm:gap-4 sm:rounded-2xl sm:p-6">
                <div className="rounded-lg bg-white/10" />
                <div className="rounded-lg bg-white/10" />
                <div className="rounded-lg bg-[#6e2ce0]/40 shadow-lg shadow-[#6e2ce0]/20" />
                <div className="rounded-lg bg-white/10" />
                <div className="rounded-lg bg-white/10" />
                <div className="rounded-lg bg-[#b4005d]/30" />
                <div className="rounded-lg bg-white/10" />
                <div className="col-span-7 mt-2 h-10 rounded-lg border border-white/10 bg-white/10 sm:h-12" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
