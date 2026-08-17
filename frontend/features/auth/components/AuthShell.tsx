"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

import AuthBackground from "./AuthBackground";

const MotionImage = motion.create(Image);

type Props = {
  title: string;
  subtitle: string;
  /**
   * Desde qué lado entra la tarjeta. Login y recuperación entran desde la
   * izquierda; registro desde la derecha, porque se llega ahí desde login.
   */
  from?: "left" | "right";
  children: ReactNode;
};

/**
 * Armazón compartido de las cuatro pantallas de autenticación: fondo de
 * aurora, centrado, tarjeta de vidrio, cabecera con el logo y pie legal.
 *
 * Existe porque las cuatro vistas repetían exactamente esta estructura, y
 * cualquier corrección de sistema (el filo del vidrio, el radio de la
 * tarjeta, el año del pie) había que hacerla cuatro veces o se desincronizaba.
 */
export default function AuthShell({
  title,
  subtitle,
  from = "left",
  children,
}: Props) {
  const offset = from === "left" ? -20 : 20;

  return (
    <>
      <AuthBackground />

      <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-6 sm:py-8">
        <motion.div
          initial={{ opacity: 0, x: offset, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -offset, scale: 0.95 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className="w-full max-w-[420px] sm:max-w-[458px]"
        >
          {/* Vidrio de trabajo, radio lg (24px), filo visible en ambos temas. */}
          <div className="rounded-3xl border border-glass-edge bg-surface-container-lowest/40 px-6 py-7 shadow-[0_32px_64px_-16px_rgba(110,44,224,0.10)] backdrop-blur-xl sm:px-10 sm:py-8">
            <div className="mb-5 flex flex-col items-center sm:mb-6">
              <MotionImage
                initial={{ rotate: from === "left" ? 10 : -10, scale: 0.8 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                src="/only_logo.png"
                alt=""
                width={56}
                height={56}
                className="mb-3 h-14 w-14 object-contain"
              />
              <h1 className="text-2xl font-semibold tracking-tight text-on-surface">
                {title}
              </h1>
              <p className="mt-1 text-center text-sm font-light text-on-surface-variant">
                {subtitle}
              </p>
            </div>

            {children}
          </div>

          <footer className="mt-5 text-center sm:mt-6">
            <p className="text-[10px] font-light uppercase tracking-[0.2em] text-on-surface-variant">
              © {new Date().getFullYear()} ContentSpark. Todos los derechos
              reservados.
            </p>
          </footer>
        </motion.div>
      </main>
    </>
  );
}
