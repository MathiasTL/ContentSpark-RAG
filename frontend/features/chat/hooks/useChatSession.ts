"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError } from "@/shared/lib/api-fetch";
import { ChatDetail, getChat } from "../services/chats-api";

export interface SessionMessage {
  role: "user" | "ai";
  content: string;
}

interface UseChatSessionResult {
  messages: SessionMessage[];
  isLoading: boolean;
  error: string | null;
  setMessages: React.Dispatch<React.SetStateAction<SessionMessage[]>>;
  chat: ChatDetail | null;
}

export function useChatSession(chatId: string | undefined): UseChatSessionResult {
  const router = useRouter();
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [chat, setChat] = useState<ChatDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(chatId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!chatId) {
      setMessages([]);
      setChat(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    getChat(chatId)
      .then((detail) => {
        if (cancelled) return;
        setChat(detail);
        setMessages(
          detail.messages.map((m) => ({ role: m.role, content: m.content })),
        );
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          router.replace("/chat");
          return;
        }
        console.error("[ChatSession] getChat fallo:", err);
        setError("No se pudo cargar el chat");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [chatId, router]);

  return { messages, setMessages, chat, isLoading, error };
}
