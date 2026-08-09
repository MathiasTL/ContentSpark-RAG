"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import ThemeToggle from "@/shared/components/ui/ThemeToggle";
import { createClient } from "@/shared/lib/supabase";

type Props = {
  name: string;
  email?: string;
  avatar?: string;
  /** Solo aplica a la variante "sidebar". */
  collapsed?: boolean;
  /**
   * "sidebar": fila con avatar y nombre, al pie de la barra lateral (>= lg).
   * "bar": celda de la barra inferior de navegación (< lg), donde es el
   * único acceso al menú de usuario y al conmutador de tema.
   */
  variant?: "sidebar" | "bar";
};

function Avatar({
  name,
  avatar,
  size,
}: {
  name: string;
  avatar?: string;
  size: "sm" | "md";
}) {
  const box = size === "sm" ? "h-6 w-6" : "h-10 w-10";

  return (
    <span
      className={`${box} shrink-0 overflow-hidden rounded-full border border-glass-edge-soft bg-surface-container-lowest/10`}
    >
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar}
          alt=""
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          className={`flex h-full w-full items-center justify-center font-semibold text-on-surface-variant ${
            size === "sm" ? "text-[10px]" : "text-sm"
          }`}
        >
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}

export default function UserMenu({
  name,
  email,
  avatar,
  collapsed,
  variant = "sidebar",
}: Props) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const isBar = variant === "bar";

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
        className={
          isBar
            ? "flex min-h-[56px] w-full flex-col items-center justify-center gap-1 px-2 py-2 text-on-surface-variant transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            : `flex w-full items-center gap-3 rounded-2xl text-left transition-colors duration-150 hover:bg-surface-container-lowest/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                collapsed ? "justify-center px-0" : "px-2 py-2"
              }`
        }
      >
        <Avatar name={name} avatar={avatar} size={isBar ? "sm" : "md"} />

        {isBar && (
          <span className="text-[11px] font-light leading-none">Cuenta</span>
        )}

        {!isBar && !collapsed && (
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
        // En la barra inferior el menú tiene que abrir hacia arriba.
        side={isBar ? "top" : "bottom"}
        align={isBar ? "center" : "start"}
        sideOffset={12}
        className="w-64 rounded-2xl border border-glass-edge-soft bg-surface-container-lowest/30 p-2 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.18)] backdrop-blur-2xl"
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

        <div className="my-1 h-px bg-glass-edge-soft" />

        <div className="px-1 py-2">
          <p className="mb-2 px-2 text-[0.6875rem] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
            Tema
          </p>
          <ThemeToggle />
        </div>

        <div className="my-1 h-px bg-glass-edge-soft" />

        <button
          type="button"
          onClick={handleLogout}
          disabled={isSigningOut}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-on-surface transition-colors duration-150 hover:bg-surface-container-lowest/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-45"
        >
          <LogOut size={16} strokeWidth={1.75} />
          {isSigningOut ? "Cerrando sesion..." : "Cerrar sesion"}
        </button>
      </PopoverContent>
    </Popover>
  );
}
