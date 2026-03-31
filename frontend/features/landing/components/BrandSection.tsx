"use client";

import { motion } from "framer-motion";

export default function BrandSection() {
  return (
    <section id="about" className="relative overflow-hidden py-24 sm:py-32">
      <div className="absolute inset-0 bg-white/5" />
      <div className="relative mx-auto flex max-w-7xl flex-col items-center justify-between gap-12 px-6 sm:px-8 md:flex-row md:gap-16">
        {/* Text */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="md:w-1/2"
        >
          <h2 className="mb-6 text-3xl font-semibold leading-tight text-white sm:mb-8 sm:text-4xl md:text-5xl">
            Tu creatividad,
            <br />
            <span className="text-[#b08cff]">potenciada por datos.</span>
          </h2>
          <p className="mb-10 text-base font-light leading-relaxed text-white/50 sm:mb-12 sm:text-lg">
            ContentSpark no es solo una herramienta; es un socio estratégico.
            Analizamos tu producción creativa y entregamos insights accionables
            que te ayudan a escalar sin burnout.
          </p>
          <div className="space-y-5 sm:space-y-6">
            {[
              { icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", text: "Algoritmos IA alineados a tu voz" },
              { icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6", text: "Predicción de engagement en tiempo real" },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#6e2ce0]/15 text-[#b08cff]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d={icon} />
                  </svg>
                </div>
                <span className="font-medium text-white/80">{text}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Visual */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="relative md:w-1/2"
        >
          <div className="aspect-[4/3] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#6e2ce0]/20 via-[#b4005d]/15 to-[#005da6]/20 shadow-2xl sm:rounded-[2.5rem]">
            <div className="flex h-full flex-col items-center justify-center p-8">
              <svg className="mb-4 text-white/20" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
              </svg>
              <p className="text-sm font-light text-white/30">Vista previa del dashboard</p>
            </div>
          </div>

          {/* Stat card */}
          <div className="absolute -right-4 -top-6 rounded-2xl border border-white/20 bg-white/10 p-5 shadow-xl backdrop-blur-xl sm:-right-10 sm:-top-10 sm:rounded-3xl sm:p-6">
            <div className="mb-2 flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <span className="text-xs font-bold uppercase tracking-wider text-white/70">
                Eficiencia
              </span>
            </div>
            <div className="text-3xl font-bold text-white">+142%</div>
            <p className="text-[10px] text-white/30">Output desde la activación</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
