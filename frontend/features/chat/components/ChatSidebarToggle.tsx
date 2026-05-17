"use client";

import { PanelLeft, PanelLeftClose } from "lucide-react";
import { useSidebarCollapsed } from "../hooks/useSidebarCollapsed";

export default function ChatSidebarToggle() {
  const { collapsed, toggle } = useSidebarCollapsed();
  const Icon = collapsed ? PanelLeft : PanelLeftClose;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={collapsed ? "Mostrar chats" : "Ocultar chats"}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/20 text-on-surface backdrop-blur-2xl transition-colors hover:bg-white/40"
    >
      <Icon size={18} strokeWidth={1.5} />
    </button>
  );
}
