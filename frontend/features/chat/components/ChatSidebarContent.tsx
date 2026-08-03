"use client";

import { useRouter, usePathname } from "next/navigation";
import { Plus } from "lucide-react";

import { useChatList } from "../hooks/useChatList";
import { useStreamingChatIds } from "../hooks/useChatSession";
import ChatListItem from "./ChatListItem";

interface ChatSidebarContentProps {
  collapsed?: boolean;
  /** Se invoca tras crear un chat nuevo o navegar a uno existente (usado por el drawer mobile para autocerrarse). */
  onNavigate?: () => void;
}

// Contenido compartido entre ChatSidebar (desktop, `hidden lg:flex`) y
// ChatMobileDrawer (overlay mobile). Vive aquí para que la lista de
// conversaciones y el botón "Nuevo chat" no se dupliquen entre ambas
// superficies.
export default function ChatSidebarContent({ collapsed = false, onNavigate }: ChatSidebarContentProps) {
  const { chats, isLoading, error, revalidate, removeChat } = useChatList();
  const streamingIds = useStreamingChatIds();
  const streamingSet = new Set(streamingIds);
  const router = useRouter();
  const pathname = usePathname();

  const activeId = pathname?.startsWith("/chat/") ? pathname.split("/")[2] : undefined;

  function handleNewChat() {
    router.push("/chat");
    onNavigate?.();
  }

  async function handleDelete(id: string) {
    try {
      await removeChat(id);
      if (id === activeId) {
        router.push("/chat");
      }
    } catch {
      // useChatList ya hace rollback; aqui no hacemos nada extra
    }
  }

  return (
    <>
      <div className={`mb-4 flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && (
          <h2 className="text-sm font-semibold tracking-tight text-on-surface">Chats</h2>
        )}
        <button
          type="button"
          onClick={handleNewChat}
          aria-label="Nuevo chat"
          className={`liquid-gradient flex items-center justify-center text-white shadow-md shadow-[#6e2ce0]/20 transition-transform hover:scale-105 active:scale-95 ${
            collapsed ? "h-10 w-10 rounded-full" : "h-9 w-9 rounded-full"
          }`}
        >
          <Plus size={16} strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto">
        {isLoading && (
          <div className="space-y-2 px-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded-2xl bg-surface-container-lowest/10"
              />
            ))}
          </div>
        )}

        {!isLoading && error && (
          <div className="space-y-2 px-2 py-3 text-xs text-on-surface-variant">
            <p>{error}</p>
            <button
              type="button"
              onClick={revalidate}
              className="rounded-full bg-surface-container-lowest/20 px-3 py-1 text-xs hover:bg-surface-container-lowest/40"
            >
              Reintentar
            </button>
          </div>
        )}

        {!isLoading && !error && chats.length === 0 && !collapsed && (
          <div className="px-2 py-6 text-center text-xs font-light text-on-surface-variant">
            <p className="mb-1">Aun no tienes conversaciones</p>
            <p className="text-[10px]">Empieza escribiendo abajo</p>
          </div>
        )}

        {!isLoading && !error &&
          chats.map((chat) => (
            <ChatListItem
              key={chat.id}
              id={chat.id}
              title={chat.title}
              updatedAt={chat.updated_at}
              isActive={chat.id === activeId}
              collapsed={collapsed}
              isStreaming={streamingSet.has(chat.id)}
              onDelete={handleDelete}
              onNavigate={onNavigate}
            />
          ))}
      </div>
    </>
  );
}
