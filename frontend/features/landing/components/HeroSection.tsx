"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 pt-36 text-center sm:px-8 sm:pt-40">
      {/* Badge */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-1.5 backdrop-blur-md"
      >
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#b08cff]" />
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#b08cff]">
          IA para creadores de contenido
        </span>
      </motion.div>

      {/* Headline */}
      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.15 }}
        className="mb-6 text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl md:text-[5.5rem] md:mb-8"
      >
        Diseña el futuro
        <br />
        <span className="bg-gradient-to-r from-[#b08cff] to-[#ffc1d1] bg-clip-text text-transparent">
          de tu contenido.
        </span>
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="mx-auto mb-10 max-w-2xl text-base font-light leading-relaxed text-white/60 sm:text-lg md:text-xl md:mb-12"
      >
        Potencia tu flujo creativo con un ecosistema inteligente que conecta
        inspiración, datos y planificación en una sola plataforma.
      </motion.p>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.45 }}
        className="mb-20 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6 md:mb-24"
      >
        <Link
          href="/signup"
          className="w-full rounded-full bg-gradient-to-r from-[#6e2ce0] to-[#b08cff] px-10 py-4 text-lg font-semibold text-white shadow-xl shadow-[#6e2ce0]/30 transition-all duration-300 hover:scale-105 active:scale-95 sm:w-auto sm:py-5"
        >
          Comienza gratis
        </Link>
        <button className="w-full rounded-full border border-white/20 bg-white/10 px-10 py-4 text-lg font-medium text-white backdrop-blur-md transition-all duration-300 hover:scale-105 hover:bg-white/15 sm:w-auto sm:py-5">
          Ver demo
        </button>
      </motion.div>

      {/* App Preview */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="relative mx-auto max-w-5xl"
      >
        {/* Glow */}
        <div className="absolute -inset-4 rounded-[3rem] bg-gradient-to-r from-[#6e2ce0]/20 via-[#b4005d]/20 to-[#005da6]/20 opacity-50 blur-2xl" />

        {/* Window */}
        <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-md sm:rounded-3xl">
          {/* Titlebar */}
          <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-5 py-3 sm:px-6 sm:py-4">
            <div className="flex gap-2">
              <div className="h-3 w-3 rounded-full bg-red-400/50" />
              <div className="h-3 w-3 rounded-full bg-amber-400/50" />
              <div className="h-3 w-3 rounded-full bg-emerald-400/50" />
            </div>
            <span className="text-[10px] font-medium uppercase tracking-widest text-white/30">
              ContentSpark // AI Studio
            </span>
            <div className="w-8" />
          </div>

          {/* Content */}
          <div className="grid min-h-[300px] grid-cols-12 sm:min-h-[420px] md:min-h-[500px]">
            {/* Sidebar */}
            <div className="col-span-3 flex flex-col gap-8 border-r border-white/10 bg-white/5 p-4 sm:p-6">
              <div className="space-y-4">
                <div className="h-2 w-16 rounded-full bg-[#b08cff]/30 sm:w-24" />
                <div className="h-2 w-20 rounded-full bg-white/10 sm:w-32" />
                <div className="h-2 w-12 rounded-full bg-white/10 sm:w-20" />
              </div>
              <div className="mt-auto hidden sm:block">
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-3">
                  <div className="h-8 w-8 rounded-full bg-[#6e2ce0]/40" />
                  <div className="flex-1 space-y-1">
                    <div className="h-1.5 w-12 rounded-full bg-white/30" />
                    <div className="h-1 w-8 rounded-full bg-white/15" />
                  </div>
                </div>
              </div>
            </div>

            {/* Chat area */}
            <div className="col-span-9 flex flex-col p-4 sm:p-6 md:p-8">
              <div className="max-w-2xl space-y-5 sm:space-y-6">
                {/* Bot message */}
                <div className="flex gap-3 sm:gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#b08cff]/20 bg-white/10 sm:h-10 sm:w-10">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b08cff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
                    </svg>
                  </div>
                  <div className="space-y-3 rounded-2xl rounded-tl-none border border-white/10 bg-white/10 p-4 sm:p-5">
                    <div className="h-2 w-32 rounded-full bg-white/15 sm:w-48" />
                    <div className="h-2 w-44 rounded-full bg-white/15 sm:w-64" />
                    <div className="h-2 w-20 rounded-full bg-white/15 sm:w-32" />
                  </div>
                </div>

                {/* User message */}
                <div className="flex flex-row-reverse gap-3 sm:gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#6e2ce0]/30 bg-[#6e2ce0]/20 sm:h-10 sm:w-10">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b08cff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <div className="space-y-3 rounded-2xl rounded-tr-none border border-[#6e2ce0]/20 bg-[#6e2ce0]/10 p-4 sm:p-5">
                    <div className="h-2 w-36 rounded-full bg-[#b08cff]/25 sm:w-56" />
                    <div className="h-2 w-16 rounded-full bg-[#b08cff]/15 sm:w-24" />
                  </div>
                </div>
              </div>

              {/* Input */}
              <div className="mt-auto pt-4">
                <div className="flex items-center gap-3 rounded-full border border-white/20 bg-white/10 p-3 backdrop-blur-md sm:gap-4 sm:p-4">
                  <svg className="ml-1 text-white/20 sm:ml-2" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                  <div className="h-2 flex-1 rounded-full bg-white/10" />
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-[#6e2ce0] to-[#b08cff] sm:h-10 sm:w-10">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
