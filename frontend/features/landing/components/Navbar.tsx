"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const LINKS = [
  { href: "#features", label: "Producto" },
  { href: "#about", label: "Cómo funciona" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed top-0 z-50 w-full border-b border-[var(--landing-border)] bg-[var(--landing-canvas-overlay)] backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/only_logo.png"
            alt="ContentSpark"
            width={30}
            height={30}
            className="h-7 w-7 object-contain"
            priority
          />
          <span className="text-lg font-semibold tracking-tight text-[var(--landing-ink)]">
            ContentSpark
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="text-sm text-[var(--landing-ink-muted)] transition-colors duration-150 hover:text-[var(--landing-ink)]"
            >
              {label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/login"
            className="hidden text-sm text-[var(--landing-ink-muted)] transition-colors duration-150 hover:text-[var(--landing-ink)] sm:block"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-[var(--landing-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--landing-accent-on)] transition-colors duration-150 hover:bg-[var(--landing-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--landing-accent-text)]"
          >
            Comenzar gratis
          </Link>

          <button
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--landing-ink-muted)] transition-colors duration-150 hover:text-[var(--landing-ink)] md:hidden"
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-[var(--landing-border)] bg-[var(--landing-canvas)] px-6 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            {LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="text-sm text-[var(--landing-ink-muted)] hover:text-[var(--landing-ink)]"
              >
                {label}
              </a>
            ))}
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="text-sm text-[var(--landing-ink-muted)] hover:text-[var(--landing-ink)]"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
