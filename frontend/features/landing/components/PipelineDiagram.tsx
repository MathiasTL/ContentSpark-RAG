"use client";

import { motion } from "framer-motion";

const NODES = [
  { y: 56, label: "Base de conocimiento", detail: "PDFs, URLs, RAG" },
  { y: 240, label: "Perfil del creador", detail: "Nicho, tono, objetivo" },
  { y: 424, label: "Calendario accionable", detail: "Listo para publicar" },
];

const draw = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 1.4, ease: [0.16, 1, 0.3, 1] as const },
  },
};

/**
 * Pieza visual editorial del hero: no es un mockup de interfaz, es una
 * composición geométrica que traza el pipeline real del producto (base de
 * conocimiento → perfil del creador → calendario). Reemplaza la ventana de
 * chat dibujada a mano del template original.
 */
export default function PipelineDiagram() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <svg
        viewBox="0 0 320 480"
        fill="none"
        className="w-full"
        role="img"
        aria-label="Diagrama: base de conocimiento, perfil del creador y calendario accionable, conectados en un flujo continuo"
      >
        <defs>
          <linearGradient id="pipeline-stroke" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--landing-accent-text)" }} />
            <stop offset="100%" style={{ stopColor: "var(--landing-accent)" }} />
          </linearGradient>
        </defs>

        {/* Trazo continuo que une los tres nodos, como un cauce único. */}
        <motion.path
          d="M 60 56 C 160 100, 160 180, 60 240 S -20 380, 60 424"
          stroke="url(#pipeline-stroke)"
          strokeWidth="1.5"
          strokeLinecap="round"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={draw}
        />

        {NODES.map((node, index) => (
          <g key={node.label}>
            <motion.circle
              cx="60"
              cy={node.y}
              r="7"
              fill="var(--landing-canvas)"
              stroke="var(--landing-accent-text)"
              strokeWidth="1.5"
              initial={{ scale: 0, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 + index * 0.35 }}
            />
            <motion.g
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.45 + index * 0.35 }}
            >
              <rect
                x="92"
                y={node.y - 30}
                width="196"
                height="60"
                rx="16"
                fill="var(--landing-canvas-raised)"
                stroke="var(--landing-border)"
              />
              <text
                x="112"
                y={node.y - 6}
                fontFamily="var(--font-sans)"
                fontSize="13"
                fontWeight={600}
                fill="var(--landing-ink)"
              >
                {node.label}
              </text>
              <text
                x="112"
                y={node.y + 14}
                fontFamily="var(--font-sans)"
                fontSize="11"
                fontWeight={300}
                fill="var(--landing-ink-muted)"
                letterSpacing="0.02em"
              >
                {node.detail}
              </text>
            </motion.g>
          </g>
        ))}
      </svg>
    </div>
  );
}
