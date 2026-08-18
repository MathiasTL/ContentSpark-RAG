"use client";

import { Link2 } from "lucide-react";
import ChatSidebarToggle from "./ChatSidebarToggle";
import ChatMobileDrawerToggle from "./ChatMobileDrawerToggle";

interface ChatHeaderProps {
  onOpenSources: () => void;
}

export default function ChatHeader({ onOpenSources }: ChatHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 w-full shrink-0 items-center justify-between border-b border-glass-edge-soft bg-surface/60 px-8 backdrop-blur-md">
      <ChatSidebarToggle />
      <ChatMobileDrawerToggle />

      <button
        type="button"
        onClick={onOpenSources}
        className="flex items-center gap-2 rounded-full border border-glass-edge bg-surface-container-lowest/20 px-4 py-2 text-sm font-light text-on-surface backdrop-blur-md transition-colors duration-150 hover:bg-surface-container-lowest/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Link2 size={16} strokeWidth={1.5} />
        Fuentes
      </button>
    </header>
  );
}
