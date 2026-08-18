"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PipelineDiagram from "./PipelineDiagram";

// Un único momento orquestado al cargar: el copy y la pieza visual entran en
// stagger, no cada elemento con su propia animación suelta.
const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export default function HeroSection() {
  return (
    <section className="relative mx-auto grid max-w-7xl gap-16 px-6 pt-40 pb-24 sm:px-8 sm:pt-48 lg:grid-cols-12 lg:items-center lg:gap-8 lg:pb-32">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={container}
        className="lg:col-span-7"
      >
        <motion.span
          variants={item}
          className="mb-6 block text-xs font-medium tracking-[0.2em] text-[var(--landing-accent-text)] uppercase"
        >
          IA para creadores de contenido
        </motion.span>

        <motion.h1
          variants={item}
          className="font-display max-w-2xl text-5xl leading-[1.05] tracking-[-0.02em] text-[var(--landing-ink)] sm:text-6xl md:text-7xl"
        >
          Tu conocimiento,
          <br />
          convertido en calendario.
        </motion.h1>

        <motion.p
          variants={item}
          className="mt-8 max-w-lg text-base leading-relaxed font-light text-[var(--landing-ink-muted)] sm:text-lg"
        >
          ContentSpark lee tus guías y aprendizajes propios, los combina con
          tu perfil de creador y responde como alguien que conoce tu nicho —
          hasta convertir esa conversación en un calendario de contenido
          listo para publicar.
        </motion.p>

        <motion.div
          variants={item}
          className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center"
        >
          <Link
            href="/signup"
            className="group inline-flex items-center justify-center gap-2 rounded-full bg-[var(--landing-accent)] px-8 py-4 text-base font-semibold text-[var(--landing-accent-on)] transition-colors duration-150 hover:bg-[var(--landing-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--landing-accent-text)]"
          >
            Comenzar gratis
            <ArrowRight
              size={18}
              className="transition-transform duration-150 group-hover:translate-x-0.5"
            />
          </Link>
          <a
            href="#features"
            className="inline-flex items-center justify-center rounded-full border border-[var(--landing-border-strong)] px-8 py-4 text-base font-medium text-[var(--landing-ink)] transition-colors duration-150 hover:border-[var(--landing-accent-text)]"
          >
            Ver cómo funciona
          </a>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="lg:col-span-5"
      >
        <PipelineDiagram />
      </motion.div>
    </section>
  );
}
