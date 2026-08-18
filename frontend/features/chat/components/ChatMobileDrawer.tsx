"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

import { useChatMobileDrawer } from "../hooks/useChatMobileDrawer";
import ChatSidebarContent from "./ChatSidebarContent";
import { CHAT_MOBILE_DRAWER_TRIGGER_ID } from "./ChatMobileDrawerToggle";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

// Overlay de conversaciones para mobile: ChatSidebar es `hidden lg:flex`,
// así que este drawer es la única forma de llegar a la lista de chats
// (y al botón "Nuevo chat") por debajo de `lg`. Estado propio via
// useChatMobileDrawer — nunca se conflate con el colapso de escritorio.
export default function ChatMobileDrawer() {
  const isOpen = useChatMobileDrawer((s) => s.isOpen);
  const close = useChatMobileDrawer((s) => s.close);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    firstFocusable?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab" || !panel) return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.getElementById(CHAT_MOBILE_DRAWER_TRIGGER_ID)?.focus();
    };
  }, [isOpen, close]);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-md lg:hidden motion-reduce:transition-none"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Conversaciones"
        aria-hidden={!isOpen}
        className={`fixed inset-y-0 left-0 z-[70] flex h-dvh w-72 max-w-[85vw] flex-col border-r border-glass-edge bg-surface/90 p-4 backdrop-blur-2xl transition-transform duration-300 ease-out motion-reduce:duration-0 lg:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-2 flex items-center justify-end">
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar conversaciones"
            className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-lowest/30 hover:text-primary"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <ChatSidebarContent onNavigate={close} />
      </div>
    </>
  );
}
