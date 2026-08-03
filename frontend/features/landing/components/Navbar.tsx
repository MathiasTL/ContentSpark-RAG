"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed top-0 z-50 w-full border-b border-white/10 bg-white/5 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 sm:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/only_logo.png"
            alt="ContentSpark"
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
            priority
          />
          <span className="text-xl font-semibold tracking-tighter text-white sm:text-2xl">
            ContentSpark
          </span>
        </Link>

        {/* Links desktop */}
        <div className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm font-light tracking-wide text-white/70 transition-colors hover:text-white">
            Features
          </a>
          <a href="#about" className="text-sm font-light tracking-wide text-white/70 transition-colors hover:text-white">
            Acerca de
          </a>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/login"
            className="hidden text-sm font-light tracking-wide text-white/70 transition-opacity hover:text-white sm:block"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-gradient-to-r from-primary to-primary-container px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-transform duration-300 hover:scale-105 active:scale-95 sm:px-6 sm:py-2.5"
          >
            Comenzar gratis
          </Link>

          {/* Hamburger mobile */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-white/70 transition-colors hover:text-white md:hidden"
            aria-label="Menú"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              {menuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="4" y1="7" x2="20" y2="7" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="17" x2="20" y2="17" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-white/10 bg-black/20 px-6 py-4 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-4">
            <a href="#features" onClick={() => setMenuOpen(false)} className="text-sm text-white/70 hover:text-white">Features</a>
            <a href="#about" onClick={() => setMenuOpen(false)} className="text-sm text-white/70 hover:text-white">Acerca de</a>
            <Link href="/login" onClick={() => setMenuOpen(false)} className="text-sm text-white/70 hover:text-white">Iniciar sesión</Link>
          </div>
        </div>
      )}
    </nav>
  );
}
