"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Link2, MessageSquare, Plus } from "lucide-react";
import { MOCK_CONVERSATIONS } from "./ConversationsList";

interface ChatHeaderProps {
  onOpenSources: () => void;
  onNewChat: () => void;
  activeId?: string;
}

export default function ChatHeader({ onOpenSources, onNewChat, activeId }: ChatHeaderProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full shrink-0 items-center justify-between border-b border-white/10 bg-surface/60 px-8 backdrop-blur-2xl">
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/20 px-4 py-2 text-sm font-light text-on-surface backdrop-blur-2xl transition-colors hover:bg-white/40"
        >
          <MessageSquare size={16} strokeWidth={1.5} />
          Mensajes
          <ChevronDown
            size={14}
            strokeWidth={1.5}
            className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <div
            role="menu"
            className="absolute left-0 top-full z-30 mt-2 flex max-h-[60vh] w-80 flex-col overflow-hidden rounded-3xl border border-white/20 bg-surface-container-lowest/95 shadow-2xl backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-on-surface">Mensajes</h3>
                <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
                  Conversaciones recientes
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onNewChat();
                  setOpen(false);
                }}
                aria-label="Nuevo chat"
                className="liquid-gradient flex h-8 w-8 items-center justify-center rounded-full text-white shadow-md shadow-[#6e2ce0]/20 transition-transform hover:scale-110 active:scale-95"
              >
                <Plus size={16} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto p-2">
              {MOCK_CONVERSATIONS.map((conv) => {
                const isActive = conv.id === activeId;
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => setOpen(false)}
                    className={`block w-full rounded-2xl p-3 text-left transition-colors ${
                      isActive
                        ? "bg-primary/10"
                        : "hover:bg-white/40"
                    }`}
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <span
                        className={`text-sm font-semibold ${
                          isActive ? "text-primary" : "text-on-surface"
                        }`}
                      >
                        {conv.title}
                      </span>
                      <span className="text-[10px] text-on-surface-variant/70">
                        {conv.timestamp}
                      </span>
                    </div>
                    <p className="line-clamp-1 text-xs font-light text-on-surface-variant">
                      {conv.preview}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onOpenSources}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-white/20 px-4 py-2 text-sm font-light text-on-surface backdrop-blur-2xl transition-colors hover:bg-white/40"
      >
        <Link2 size={16} strokeWidth={1.5} />
        Fuentes
      </button>
    </header>
  );
}
