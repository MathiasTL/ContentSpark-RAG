import { Sparkle } from "lucide-react";
import { NICHES } from "@/shared/constants";
import Marquee from "./Marquee";

// Etiquetas de presentación de los nichos reales soportados por el
// onboarding (ver frontend/shared/constants). No son datos inventados: son
// los mismos valores de NICHES, solo con tilde y mayúscula inicial para
// lectura.
const NICHE_LABELS: Record<(typeof NICHES)[number], string> = {
  tecnologia: "Tecnología",
  fitness: "Fitness",
  finanzas: "Finanzas",
  educacion: "Educación",
  lifestyle: "Lifestyle",
  negocios: "Negocios",
};

export default function NicheMarquee() {
  return (
    <section aria-label="Nichos soportados" className="py-16 sm:py-20">
      <p className="mb-8 text-center text-xs font-medium tracking-[0.2em] text-[var(--landing-ink-faint)] uppercase">
        Perfilado para tu nicho, sea cual sea
      </p>
      <Marquee durationS={28}>
        {NICHES.map((niche) => (
          <span
            key={niche}
            className="mx-2 inline-flex items-center gap-2 rounded-full border border-[var(--landing-border)] px-5 py-2.5 text-sm text-[var(--landing-ink-muted)]"
          >
            <Sparkle size={14} className="text-[var(--landing-accent-text)]" />
            {NICHE_LABELS[niche]}
          </span>
        ))}
      </Marquee>
    </section>
  );
}
