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
      className="hidden h-10 w-10 items-center justify-center rounded-full border border-glass-edge bg-surface-container-lowest/20 text-on-surface backdrop-blur-md transition-colors duration-150 hover:bg-surface-container-lowest/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:flex"
    >
      <Icon size={18} strokeWidth={1.5} />
    </button>
  );
}
