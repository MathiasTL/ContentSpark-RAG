"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./AppSidebar";

// Barra de navegación inferior para viewports < lg. AppSidebar es
// `hidden lg:flex`, así que este componente es la única navegación
// primaria disponible en mobile/tablet. Comparte NAV_ITEMS con
// AppSidebar para que ambas superficies queden siempre sincronizadas.
export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/15 bg-surface-container-lowest/70 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <ul className="flex items-stretch justify-around">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={label} className="flex-1">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-1 px-2 py-2 transition-colors ${
                  isActive ? "text-primary" : "text-on-surface-variant"
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
                <span className="text-[11px] font-light leading-none">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
