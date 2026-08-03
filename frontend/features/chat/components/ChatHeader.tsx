"use client";

import { Link2 } from "lucide-react";
import ChatSidebarToggle from "./ChatSidebarToggle";
import ChatMobileDrawerToggle from "./ChatMobileDrawerToggle";

interface ChatHeaderProps {
  onOpenSources: () => void;
}

export default function ChatHeader({ onOpenSources }: ChatHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 w-full shrink-0 items-center justify-between border-b border-white/10 bg-surface/60 px-8 backdrop-blur-2xl">
      <ChatSidebarToggle />
      <ChatMobileDrawerToggle />

      <button
        type="button"
        onClick={onOpenSources}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-surface-container-lowest/20 px-4 py-2 text-sm font-light text-on-surface backdrop-blur-2xl transition-colors hover:bg-surface-container-lowest/40"
      >
        <Link2 size={16} strokeWidth={1.5} />
        Fuentes
      </button>
    </header>
  );
}
