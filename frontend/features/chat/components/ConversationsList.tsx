"use client";

import { Plus } from "lucide-react";

interface Conversation {
  id: string;
  title: string;
  preview: string;
  timestamp: string;
}

// TODO(phase-1): replace with GET /api/chats once backend persistence lands.
const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "reel-strategy",
    title: "Estrategia de Reels",
    preview: "Optimiza los primeros 3 segundos de tu video...",
    timestamp: "Hace 12m",
  },
  {
    id: "hook-ideas",
    title: "Ideas de hooks",
    preview: "Necesito ángulos frescos para mi próximo...",
    timestamp: "Hace 2h",
  },
  {
    id: "growth-plan",
    title: "Plan de crecimiento",
    preview: "Estrategia Q3 para YouTube Shorts y...",
    timestamp: "Ayer",
  },
];

interface ConversationsListProps {
  onNewChat: () => void;
  activeId?: string;
}

export default function ConversationsList({ onNewChat, activeId }: ConversationsListProps) {
  return (
    <section className="flex h-full w-80 shrink-0 flex-col border-r border-white/5 bg-surface-container/30 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3 p-8 pb-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-on-surface">Mensajes</h2>
          <p className="mt-1 text-xs font-light uppercase tracking-[0.2em] text-on-surface-variant">
            Conversaciones recientes
          </p>
        </div>
        <button
          type="button"
          onClick={onNewChat}
          aria-label="Nuevo chat"
          className="liquid-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-md shadow-[#6e2ce0]/20 transition-transform hover:scale-110 active:scale-95"
        >
          <Plus size={18} strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-4">
        {MOCK_CONVERSATIONS.map((conv) => {
          const isActive = conv.id === activeId;
          return (
            <button
              key={conv.id}
              type="button"
              className={`group block w-full rounded-3xl p-4 text-left transition-colors ${
                isActive
                  ? "border border-white/40 bg-surface-container-lowest shadow-sm"
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
                <span className="text-[10px] text-on-surface-variant/70">{conv.timestamp}</span>
              </div>
              <p className="line-clamp-1 text-xs font-light text-on-surface-variant">
                {conv.preview}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
