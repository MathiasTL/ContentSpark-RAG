"use client";

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
  const [user, setUser] = useState<{ name: string; avatar?: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      const meta = data.user.user_metadata ?? {};
      setUser({
        name: meta.full_name || meta.name || data.user.email?.split("@")[0] || "Creator",
        avatar: meta.avatar_url,
      });
    });
  }, []);

  function handleNewChat() {
    router.push("/chat?new=1");
  }

  return (
    <aside className="fixed left-0 top-0 z-50 hidden h-screen w-64 flex-col justify-between border-r border-white/10 bg-white/5 p-6 shadow-[0_40px_60px_rgba(0,0,0,0.04)] backdrop-blur-xl lg:flex">
      <div>
        <div className="mb-10 px-2">
          <h1 className="bg-gradient-to-r from-[#6e2ce0] to-[#b08cff] bg-clip-text text-xl font-semibold tracking-tight text-transparent">
            ContentSpark
          </h1>
          <p className="mt-1 text-xs font-light uppercase tracking-wide text-white/50">
            Creator Suite
          </p>
        </div>

        <nav className="space-y-2">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={label}
                href={href}
                className={`flex items-center gap-3 px-4 py-3 transition-all duration-200 ${
                  isActive
                    ? "rounded-3xl bg-white/10 font-semibold text-white"
                    : "font-light text-white/60 hover:scale-105 hover:text-white"
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
                <span className="text-sm">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-10 px-2">
          <button
            onClick={handleNewChat}
            type="button"
            className="liquid-gradient w-full rounded-full py-3 text-sm font-semibold text-white shadow-lg shadow-[#6e2ce0]/20 transition-transform hover:scale-105 active:scale-95"
          >
            New Chat
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <Link
          href="#"
          className="flex items-center gap-3 px-4 py-3 text-white/60 transition-colors hover:text-white"
        >
          <HelpCircle size={18} strokeWidth={1.5} />
          <span className="text-sm font-light">Support</span>
        </Link>

        <div className="flex items-center gap-3 border-t border-white/5 px-2 pt-4">
          <div className="h-10 w-10 overflow-hidden rounded-full border border-white/20 bg-white/10">
            {user?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-white/70">
                {(user?.name ?? "?").charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {user?.name ?? "Guest"}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-white/40">
              Pro Member
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
