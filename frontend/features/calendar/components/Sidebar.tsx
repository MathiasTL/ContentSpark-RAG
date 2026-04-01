"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    label: "Dashboard",
    href: "/chat",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    label: "Calendario",
    href: "/calendar",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    label: "Perfil",
    href: "/profile",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    label: "Analytics",
    href: "#",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    label: "Ajustes",
    href: "#",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-50 hidden h-screen w-64 flex-col border-r border-white/10 bg-white/5 px-5 py-8 backdrop-blur-2xl lg:flex">
      {/* Logo */}
      <div className="mb-10 px-2">
        <Link href="/" className="flex items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-xl shadow-lg">
            <img src="/only_logo.png" alt="ContentSpark" className="h-full w-full object-cover" />
          </div>
          <div>
            <h1 className="bg-gradient-to-r from-[#6e2ce0] to-[#b08cff] bg-clip-text text-2xl font-semibold tracking-tighter text-transparent">
              ContentSpark
            </h1>
            <p className="text-[10px] font-light uppercase tracking-widest text-white/40">
              Liquid Workspace
            </p>
          </div>
        </Link>
      </div>

      {/* Navegación */}
      <nav className="flex-1 space-y-1.5">
        {navItems.map(({ label, href, icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={label}
              href={href}
              className={`flex items-center gap-4 rounded-2xl px-4 py-3 transition-all duration-300 ${
                isActive
                  ? "bg-white/15 font-semibold text-[#b08cff] shadow-sm"
                  : "font-light text-white/50 hover:bg-white/10 hover:text-white/70"
              }`}
            >
              <span className={isActive ? "text-[#b08cff]" : "text-white/40"}>{icon}</span>
              <span className="text-xs font-semibold uppercase tracking-widest">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Acciones inferiores */}
      <div className="mt-auto space-y-3 border-t border-white/10 pt-6">
        <button className="w-full rounded-2xl bg-gradient-to-r from-[#6e2ce0] to-[#b08cff] py-3.5 text-sm font-bold text-white shadow-xl shadow-[#6e2ce0]/30 transition-transform hover:scale-[1.03] active:scale-95">
          Crear nuevo post
        </button>
        <Link
          href="#"
          className="flex items-center gap-3 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white/40 transition-colors hover:text-[#b08cff]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Ayuda
        </Link>
      </div>
    </aside>
  );
}
