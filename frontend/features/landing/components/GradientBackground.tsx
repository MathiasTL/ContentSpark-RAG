"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

const gradients = [
  "linear-gradient(135deg, #1a0533 0%, #6e2ce0 50%, #2d1b69 100%)",
  "linear-gradient(135deg, #6e2ce0 0%, #b4005d 50%, #380084 100%)",
  "linear-gradient(135deg, #0f3460 0%, #6e2ce0 50%, #b08cff 100%)",
  "linear-gradient(135deg, #380084 0%, #005da6 50%, #6e2ce0 100%)",
  "linear-gradient(135deg, #1a0533 0%, #6e2ce0 50%, #2d1b69 100%)",
];

// Cuánto tiempo permanece cada gradiente antes de dar paso al siguiente.
const STEP_DURATION_MS = 12000;
// Duración del crossfade (animación de opacity) entre gradientes consecutivos.
const CROSSFADE_DURATION_S = 3;

export default function GradientBackground() {
  const prefersReducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    // Con reduced motion, el fondo queda fijo en el primer gradiente.
    if (prefersReducedMotion) return;

    const interval = setInterval(() => {
      setActiveIndex((current) => (current + 1) % gradients.length);
    }, STEP_DURATION_MS);

    return () => clearInterval(interval);
  }, [prefersReducedMotion]);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/*
        Cada gradiente vive en su propia capa apilada con un `background`
        estático (nunca se anima esa propiedad, que forzaría repaint en
        cada frame). El efecto de "shift" ambiental se logra animando solo
        `opacity`, que el navegador puede compositar en la GPU sin repintar.
      */}
      {gradients.map((gradient, index) => (
        <motion.div
          key={`${gradient}-${index}`}
          className="absolute inset-0"
          style={{ background: gradient }}
          initial={false}
          animate={{
            opacity:
              prefersReducedMotion
                ? index === 0
                  ? 1
                  : 0
                : index === activeIndex
                  ? 1
                  : 0,
          }}
          transition={{
            duration: prefersReducedMotion ? 0 : CROSSFADE_DURATION_S,
            ease: "easeInOut",
          }}
        />
      ))}
      {/* Overlay sutil para legibilidad */}
      <div className="absolute inset-0 bg-black/10" />
    </div>
  );
}
