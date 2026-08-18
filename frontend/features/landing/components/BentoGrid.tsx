import type { ReactNode } from "react";
import { motion } from "framer-motion";

/**
 * Adaptado de Magic UI "Bento Grid" (magicui.design/docs/components/bento-grid)
 * al stack del proyecto: sin dependencias nuevas, tokens de landing en vez de
 * la paleta por defecto de Tailwind, sin CTA de tarjeta cuando la feature no
 * tiene un enlace propio.
 */
export function BentoGrid({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-3 ${className}`}>
      {children}
    </div>
  );
}

export function BentoCard({
  name,
  description,
  Icon,
  tags,
  href,
  cta,
  className = "",
  delay = 0,
}: {
  name: string;
  description: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  tags?: string[];
  href?: string;
  cta?: string;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`group relative flex flex-col overflow-hidden rounded-3xl border border-[var(--landing-border)] bg-[var(--landing-canvas-raised)] p-8 sm:p-10 ${className}`}
    >
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--landing-border)] text-[var(--landing-accent-text)] sm:h-14 sm:w-14">
        <Icon size={24} />
      </div>

      <h3 className="font-display mb-3 text-2xl text-[var(--landing-ink)] sm:text-3xl">
        {name}
      </h3>
      <p className="max-w-md text-sm leading-relaxed font-light text-[var(--landing-ink-muted)] sm:text-base">
        {description}
      </p>

      {tags && (
        <div className="mt-8 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[var(--landing-border)] px-3 py-1.5 text-[11px] font-semibold tracking-wider text-[var(--landing-ink-faint)] uppercase"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {href && cta && (
        <a
          href={href}
          className="mt-auto inline-flex items-center gap-2 pt-8 text-sm font-semibold text-[var(--landing-accent-text)]"
        >
          {cta}
          <span aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5">
            →
          </span>
        </a>
      )}
    </motion.div>
  );
}
