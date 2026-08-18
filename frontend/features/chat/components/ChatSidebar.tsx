"use client";

import { useSidebarCollapsed } from "../hooks/useSidebarCollapsed";
import ChatSidebarContent from "./ChatSidebarContent";

export default function ChatSidebar() {
  const { collapsed } = useSidebarCollapsed();

  return (
    <aside
      className={`hidden h-dvh shrink-0 flex-col border-r border-glass-edge-soft bg-surface-container-lowest/5 backdrop-blur-xl transition-[width] duration-300 ease-out lg:flex ${
        collapsed ? "w-16 p-2" : "w-72 p-4"
      }`}
    >
      <ChatSidebarContent collapsed={collapsed} />
    </aside>
  );
}
