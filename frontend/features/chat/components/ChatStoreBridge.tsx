// frontend/features/chat/components/ChatStoreBridge.tsx
"use client";

import { useEffect } from "react";

import { useChatList } from "../hooks/useChatList";
import { useChatSessionsStore } from "../store/chatSessionsStore";

export default function ChatStoreBridge() {
  const { revalidate } = useChatList();

  useEffect(() => {
    useChatSessionsStore.getState().setOnChatListShouldRevalidate(revalidate);
    return () => {
      useChatSessionsStore.getState().setOnChatListShouldRevalidate(null);
    };
  }, [revalidate]);

  return null;
}
