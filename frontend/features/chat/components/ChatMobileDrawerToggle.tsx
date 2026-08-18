"use client";

import { PanelLeft, PanelLeftClose } from "lucide-react";
import { useChatMobileDrawer } from "../hooks/useChatMobileDrawer";

export const CHAT_MOBILE_DRAWER_TRIGGER_ID = "chat-mobile-drawer-trigger";

// Equivalente mobile de ChatSidebarToggle: ese botón alterna el colapso
// de ChatSidebar, pero ChatSidebar es `hidden lg:flex`, así que en mobile
// no tenía ningún efecto visible. Este botón abre/cierra ChatMobileDrawer
// en su lugar, con el mismo lenguaje visual (icon swap) para consistencia.
export default function ChatMobileDrawerToggle() {
  const isOpen = useChatMobileDrawer((s) => s.isOpen);
  const toggle = useChatMobileDrawer((s) => s.toggle);
  const Icon = isOpen ? PanelLeftClose : PanelLeft;

  return (
    <button
      id={CHAT_MOBILE_DRAWER_TRIGGER_ID}
      type="button"
      onClick={toggle}
      aria-label={isOpen ? "Ocultar chats" : "Mostrar chats"}
      aria-expanded={isOpen}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-glass-edge bg-surface-container-lowest/20 text-on-surface backdrop-blur-md transition-colors duration-150 hover:bg-surface-container-lowest/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:hidden"
    >
      <Icon size={18} strokeWidth={1.5} />
    </button>
  );
}
