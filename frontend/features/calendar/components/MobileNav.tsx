"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Chat", href: "/chat", icon: "💬" },
  { label: "Calendario", href: "/calendar", icon: "📅" },
  { label: "Perfil", href: "/profile", icon: "👤" },
];

export default function MobileNav() {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      {/* Botón hamburguesa (solo mobile) */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed left-4 top-5 z-[60] flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 backdrop-blur-xl lg:hidden"
        aria-label="Menú"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </button>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar mobile */}
      <aside
        className={`fixed left-0 top-0 z-[80] flex h-screen w-64 flex-col border-r border-white/10 bg-black/80 px-5 py-8 backdrop-blur-2xl transition-transform duration-300 lg:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
            <img src="/only_logo.png" alt="ContentSpark" className="h-9 w-9 rounded-xl" />
            <span className="bg-gradient-to-r from-[#6e2ce0] to-[#b08cff] bg-clip-text text-xl font-semibold tracking-tighter text-transparent">
              ContentSpark
            </span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-white/50 hover:text-white"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map(({ label, href, icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={label}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition-all ${
                  isActive
                    ? "bg-white/15 font-semibold text-[#b08cff]"
                    : "text-white/50 hover:bg-white/10"
                }`}
              >
                <span className="text-lg">{icon}</span>
                <span className="text-sm font-semibold uppercase tracking-wider">{label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
