"use client";

import { motion } from "framer-motion";
import { Library, UserRoundCog, CalendarCheck2 } from "lucide-react";
import { BentoGrid, BentoCard } from "./BentoGrid";

export default function FeaturesGrid() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-6 py-24 sm:px-8 sm:py-32">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mb-14 max-w-2xl sm:mb-16"
      >
        <h2 className="font-display text-3xl text-[var(--landing-ink)] sm:text-4xl">
          Tres piezas, un mismo flujo
        </h2>
        <p className="mt-4 font-light text-[var(--landing-ink-muted)]">
          De tu archivo personal a un calendario listo para publicar, sin
          perder tu voz en el camino.
        </p>
      </motion.div>

      <BentoGrid>
        <BentoCard
          className="md:col-span-2"
          delay={0}
          Icon={Library}
          name="RAG para Creadores"
          description="Transformá tus guías, notas e investigación en una base de conocimiento consultable. ContentSpark responde con tu propio material, no con generalidades — vía CRAG con reescritura de consulta y filtrado por relevancia."
          tags={["PDFs", "URLs web", "Qdrant"]}
        />
        <BentoCard
          delay={0.12}
          Icon={UserRoundCog}
          name="Onboarding Inteligente"
          description="Un perfil de creador persistente — nicho, tono, objetivo, audiencia y frecuencia — que contextualiza cada respuesta del chat y cada entrada del calendario."
        />
        <BentoCard
          className="md:col-span-3"
          delay={0.24}
          Icon={CalendarCheck2}
          name="Calendario Accionable"
          description="La estrategia conversacional se traduce en un calendario de contenido concreto, sincronizado con Google Calendar vía n8n — listo para ejecutar, no solo para leer."
          href="/signup"
          cta="Empezar a planificar"
        />
      </BentoGrid>
    </section>
  );
}
