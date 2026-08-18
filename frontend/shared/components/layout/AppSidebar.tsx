"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, MessageSquare, User } from "lucide-react";
import { useCurrentUser } from "@/shared/hooks/useCurrentUser";
import { useSidebar } from "./SidebarProvider";
import UserMenu from "./UserMenu";

export const NAV_ITEMS = [
  { label: "Habla con Spark", href: "/chat", icon: MessageSquare },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Perfil", href: "/profile", icon: User },
];

export default function AppSidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();
  const user = useCurrentUser();

  return (
    <aside
      className={`fixed left-0 top-0 z-50 hidden h-screen flex-col justify-between border-r border-glass-edge bg-surface-container-lowest/5 backdrop-blur-xl transition-[width] duration-300 ease-out lg:flex ${
        collapsed ? "w-20 p-3" : "w-64 p-6"
      }`}
    >
      <div>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expandir menu" : "Colapsar menu"}
          className={`mb-10 flex w-full items-center gap-3 rounded-2xl px-2 py-1 transition-colors hover:bg-surface-container-lowest/5 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl">
            <Image
              src="/only_logo.png"
              alt="ContentSpark"
              width={36}
              height={36}
              priority
              className="h-full w-full object-contain"
            />
          </span>
          {!collapsed && (
            <span className="min-w-0 text-left">
              <span className="block bg-gradient-to-r from-primary to-primary-container bg-clip-text text-xl font-semibold tracking-tight text-transparent">
                ContentSpark
              </span>
              <span className="mt-0.5 block text-[10px] font-light uppercase tracking-wide text-on-surface-variant">
                Creator Suite
              </span>
            </span>
          )}
        </button>

        <nav className="space-y-2" aria-label="Navegación principal">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={label}
                href={href}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-3 rounded-2xl transition-all duration-200 ${
                  collapsed ? "h-12 justify-center" : "px-4 py-3"
                } ${
                  isActive
                    ? "bg-primary/15 font-semibold text-primary"
                    : "font-light text-on-surface-variant hover:bg-surface-container-lowest/30 hover:text-primary"
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2 : 1.5} className="shrink-0" />
                {!collapsed && <span className="text-sm">{label}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="space-y-4">
        <div className="border-t border-glass-edge-soft pt-4">
          {user && (
            <UserMenu
              name={user.name}
              email={user.email}
              avatar={user.avatar}
              collapsed={collapsed}
            />
          )}
        </div>
      </div>
    </aside>
  );
}
