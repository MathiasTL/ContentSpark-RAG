"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function CTASection() {
  return (
    <section className="px-6 py-24 sm:px-8 sm:py-32">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-[var(--landing-border-strong)] bg-[var(--landing-canvas-raised)] p-10 text-center sm:p-16"
        style={{ boxShadow: "var(--landing-shadow-accent)" }}
      >
        <h2 className="font-display text-3xl text-[var(--landing-ink)] sm:text-4xl md:text-5xl">
          Convertí tu conocimiento
          <br />
          en tu próximo calendario.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed font-light text-[var(--landing-ink-muted)] sm:text-lg">
          Sumá tus guías, definí tu perfil de creador y dejá que ContentSpark
          conecte la conversación con la ejecución.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/signup"
            className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--landing-accent)] px-10 py-4 text-base font-semibold text-[var(--landing-accent-on)] transition-colors duration-150 hover:bg-[var(--landing-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--landing-accent-text)] sm:w-auto"
          >
            Comenzar gratis
            <ArrowRight
              size={18}
              className="transition-transform duration-150 group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
