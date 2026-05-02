"use client";

import Image from "next/image";
import { PanelLeft, Link2, Bell, UserCircle2 } from "lucide-react";

interface ChatHeaderProps {
  onOpenSources: () => void;
}

export default function ChatHeader({ onOpenSources }: ChatHeaderProps) {
  return (
    <header className="z-10 flex h-20 w-full shrink-0 items-center justify-between border-b border-white/10 bg-white/10 px-8 backdrop-blur-2xl">
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="Toggle sidebar"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/20 text-on-surface transition-colors hover:text-primary"
        >
          <PanelLeft size={20} strokeWidth={1.5} />
        </button>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/20 p-1.5 backdrop-blur-2xl">
          <Image
            src="/only_logo.png"
            alt="ContentSpark"
            width={28}
            height={28}
            className="h-full w-full object-contain"
          />
        </div>

        <h3 className="text-lg font-semibold text-on-surface">Chat con ContentSpark AI</h3>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSources}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/20 px-4 py-2 text-sm font-light text-on-surface backdrop-blur-2xl transition-colors hover:bg-white/40"
        >
          <Link2 size={16} strokeWidth={1.5} />
          Fuentes
        </button>

        <button
          type="button"
          aria-label="Notificaciones"
          className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:text-primary"
        >
          <Bell size={20} strokeWidth={1.5} />
        </button>

        <button
          type="button"
          aria-label="Cuenta"
          className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:text-primary"
        >
          <UserCircle2 size={22} strokeWidth={1.5} />
        </button>
      </div>
    </header>
  );
}
