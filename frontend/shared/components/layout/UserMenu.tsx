"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { createClient } from "@/shared/lib/supabase";

type Props = {
  name: string;
  email?: string;
  avatar?: string;
  collapsed?: boolean;
};

export default function UserMenu({ name, email, avatar, collapsed }: Props) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleLogout = async () => {
    setIsSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      router.push("/login");
    }
  };

  return (
    <Popover>
      <PopoverTrigger
        aria-label="Menu de usuario"
        className={`flex w-full items-center gap-3 rounded-2xl text-left transition-colors hover:bg-white/20 ${
          collapsed ? "justify-center px-0" : "px-2 py-2"
        }`}
      >
        <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/20 bg-white/10">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt={name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-white/70">
              {name.charAt(0).toUpperCase()}
            </span>
          )}
        </span>
        {!collapsed && (
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-on-surface">
              {name}
            </span>
            <span className="block text-[10px] uppercase tracking-widest text-on-surface-variant">
              Pro Member
            </span>
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={12}
        className="w-56 rounded-2xl border border-white/20 bg-white/30 p-2 shadow-[0_24px_48px_-16px_rgba(110,44,224,0.18)] backdrop-blur-xl"
      >
        <div className="px-3 py-2">
          <p className="truncate text-sm font-semibold text-on-surface">
            {name}
          </p>
          {email && (
            <p className="truncate text-xs font-light text-on-surface-variant">
              {email}
            </p>
          )}
        </div>
        <div className="my-1 h-px bg-white/20" />
        <button
          type="button"
          onClick={handleLogout}
          disabled={isSigningOut}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-on-surface transition-colors hover:bg-white/30 disabled:opacity-60"
        >
          <LogOut size={16} strokeWidth={1.75} />
          {isSigningOut ? "Cerrando sesion..." : "Cerrar sesion"}
        </button>
      </PopoverContent>
    </Popover>
  );
}
