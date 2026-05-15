"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  BarChart3,
  Settings,
  HelpCircle,
} from "lucide-react";
import { createClient } from "@/shared/lib/supabase";
import { useSidebar } from "./SidebarProvider";
import UserMenu from "./UserMenu";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Creators", href: "/creators", icon: Users },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed, toggle } = useSidebar();
  const [user, setUser] = useState<{
    name: string;
    email?: string;
    avatar?: string;
  } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      const meta = data.user.user_metadata ?? {};
      setUser({
        name:
          meta.full_name ||
          meta.name ||
          data.user.email?.split("@")[0] ||
          "Creator",
        email: data.user.email ?? undefined,
        avatar: meta.avatar_url ?? meta.picture,
      });
    });
  }, []);

  function handleNewChat() {
    router.push("/chat?new=1");
  }

  return (
    <aside
      className={`fixed left-0 top-0 z-50 hidden h-screen flex-col justify-between border-r border-white/10 bg-white/5 shadow-[0_40px_60px_rgba(0,0,0,0.04)] backdrop-blur-xl transition-[width] duration-300 ease-out lg:flex ${
        collapsed ? "w-20 p-3" : "w-64 p-6"
      }`}
    >
      <div>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          className={`mb-10 flex w-full items-center gap-3 rounded-2xl px-2 py-1 transition-colors hover:bg-white/5 ${
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
              <span className="block bg-gradient-to-r from-[#6e2ce0] to-[#b08cff] bg-clip-text text-xl font-semibold tracking-tight text-transparent">
                ContentSpark
              </span>
              <span className="mt-0.5 block text-[10px] font-light uppercase tracking-wide text-on-surface-variant">
                Creator Suite
              </span>
            </span>
          )}
        </button>

        <nav className="space-y-2">
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
                    : "font-light text-on-surface-variant hover:bg-white/30 hover:text-primary"
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2 : 1.5} className="shrink-0" />
                {!collapsed && <span className="text-sm">{label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="mt-10 px-2">
          <button
            onClick={handleNewChat}
            type="button"
            aria-label="Nuevo chat"
            className={`liquid-gradient flex w-full items-center justify-center text-sm font-semibold text-white shadow-lg shadow-[#6e2ce0]/20 transition-transform hover:scale-105 active:scale-95 ${
              collapsed ? "h-10 rounded-2xl text-lg" : "rounded-full p-3"
            }`}
          >
            {collapsed ? "+" : "New Chat"}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <Link
          href="#"
          title={collapsed ? "Soporte" : undefined}
          className={`flex items-center gap-3 rounded-2xl text-on-surface-variant transition-colors hover:bg-white/30 hover:text-primary ${
            collapsed ? "h-12 justify-center" : "px-4 py-3"
          }`}
        >
          <HelpCircle size={18} strokeWidth={1.5} className="shrink-0" />
          {!collapsed && <span className="text-sm font-light">Support</span>}
        </Link>

        <div className="border-t border-white/5 pt-4">
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
