"use client";

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  ChatListItem,
  deleteChat as deleteChatApi,
  listChats,
} from "../services/chats-api";
import { useChatSessionsStore } from '../store/chatSessionsStore';

interface ChatListContextValue {
  chats: ChatListItem[];
  isLoading: boolean;
  error: string | null;
  revalidate: () => Promise<void>;
  removeChat: (id: string) => Promise<void>;
}

const ChatListContext = createContext<ChatListContextValue | null>(null);

export function ChatListProvider({ children }: { children: ReactNode }) {
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listChats();
      setChats(data);
    } catch (err) {
      console.error("[ChatList] listChats fallo:", err);
      setError("No se pudieron cargar los chats");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll();
  }, [fetchAll]);

  const removeChat = useCallback(
    async (id: string) => {
      const previous = chats;
      setChats((prev) => prev.filter((c) => c.id !== id));

      useChatSessionsStore.getState().removeSession(id);

      try {
        await deleteChatApi(id);
      } catch (err) {
        console.error("[ChatList] deleteChat fallo:", err);
        setChats(previous);
        throw err;
      }
    },
    [chats],
  );

  return (
    <ChatListContext.Provider
      value={{ chats, isLoading, error, revalidate: fetchAll, removeChat }}
    >
      {children}
    </ChatListContext.Provider>
  );
}

export function useChatList(): ChatListContextValue {
  const ctx = useContext(ChatListContext);
  if (!ctx) {
    throw new Error("useChatList must be used inside <ChatListProvider>");
  }
  return ctx;
}
