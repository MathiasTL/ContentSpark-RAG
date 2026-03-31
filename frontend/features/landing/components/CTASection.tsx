"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function CTASection() {
  return (
    <section className="px-6 py-24 sm:px-8 sm:py-32">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7 }}
        className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/15 bg-white/5 p-10 text-center backdrop-blur-md sm:rounded-[3rem] sm:p-16"
      >
        <div className="absolute inset-0 -z-10 bg-[#6e2ce0]/5" />
        <h2 className="mb-6 text-3xl font-semibold text-white sm:mb-8 sm:text-4xl md:text-5xl lg:text-6xl">
          ¿Listo para encender
          <br />
          tu próxima gran idea?
        </h2>
        <p className="mx-auto mb-10 max-w-xl text-base font-light text-white/50 sm:mb-12 sm:text-lg">
          Únete a miles de creadores que están redefiniendo lo posible en la
          economía digital.
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/signup"
            className="w-full rounded-full bg-gradient-to-r from-[#6e2ce0] to-[#b08cff] px-10 py-4 text-lg font-semibold text-white shadow-xl shadow-[#6e2ce0]/30 transition-all duration-300 hover:scale-105 active:scale-95 sm:w-auto sm:px-12 sm:py-5 sm:text-xl"
          >
            Únete a la waitlist
          </Link>
          <a
            href="#"
            className="font-medium text-white/50 transition-colors hover:text-[#b08cff]"
          >
            Ver el roadmap
          </a>
        </div>
      </motion.div>
    </section>
  );
}
