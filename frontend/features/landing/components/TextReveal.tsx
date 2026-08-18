"use client";

import { useRef, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

/**
 * Adaptado de Magic UI "Text Reveal" (magicui.design/docs/components/text-reveal)
 * al stack del proyecto: sin dependencias nuevas (framer-motion ya es
 * dependencia existente), tokens de landing en vez de Tailwind por defecto.
 * Cada palabra sube de opacidad atada al progreso de scroll del contenedor
 * alto que lo envuelve, en vez de animar por tiempo.
 */
export default function TextReveal({ text }: { text: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 0.8", "end 0.4"],
  });

  const words = text.split(" ");

  return (
    <div ref={containerRef} className="relative h-[140vh]">
      <div className="sticky top-0 flex h-screen items-center">
        <p className="font-display mx-auto max-w-4xl px-6 text-center text-3xl leading-snug tracking-[-0.01em] sm:px-8 sm:text-4xl md:text-5xl">
          {words.map((word, i) => {
            const start = i / words.length;
            const end = start + 1 / words.length;
            return (
              <Word key={i} range={[start, end]} progress={scrollYProgress}>
                {word}
              </Word>
            );
          })}
        </p>
      </div>
    </div>
  );
}

function Word({
  children,
  range,
  progress,
}: {
  children: ReactNode;
  range: [number, number];
  progress: ReturnType<typeof useScroll>["scrollYProgress"];
}) {
  const opacity = useTransform(progress, range, [0.2, 1]);
  return (
    <span className="relative mr-3 inline-block">
      <span className="absolute opacity-20" style={{ color: "var(--landing-ink)" }}>
        {children}
      </span>
      <motion.span style={{ opacity, color: "var(--landing-ink)" }}>
        {children}
      </motion.span>
    </span>
  );
}
