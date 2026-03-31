"use client";

import { motion } from "framer-motion";

const gradients = [
  "linear-gradient(135deg, #1a0533 0%, #6e2ce0 50%, #2d1b69 100%)",
  "linear-gradient(135deg, #6e2ce0 0%, #b4005d 50%, #380084 100%)",
  "linear-gradient(135deg, #0f3460 0%, #6e2ce0 50%, #b08cff 100%)",
  "linear-gradient(135deg, #380084 0%, #005da6 50%, #6e2ce0 100%)",
  "linear-gradient(135deg, #1a0533 0%, #6e2ce0 50%, #2d1b69 100%)",
];

export default function GradientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <motion.div
        className="absolute inset-0"
        style={{ background: gradients[0] }}
        animate={{ background: gradients }}
        transition={{
          delay: 0.5,
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      {/* Overlay sutil para legibilidad */}
      <div className="absolute inset-0 bg-black/10" />
    </div>
  );
}
