'use client';

import { useShallow } from 'zustand/react/shallow';
import {
  type ChatSession,
  useChatSessionsStore,
} from '../store/chatSessionsStore';

export type { SessionMessage } from '../store/chatSessionsStore';

export function useChatSession(chatId: string | null | undefined): ChatSession | undefined {
  return useChatSessionsStore(
    useShallow((state) => (chatId ? state.sessions[chatId] : undefined)),
  );
}

export function useActiveChatId(): string | null {
  return useChatSessionsStore((state) => state.activeChatId);
}

export function useStreamingChatIds(): string[] {
  return useChatSessionsStore(
    useShallow((state) =>
      Object.values(state.sessions)
        .filter((s) => s.isStreaming)
        .map((s) => s.chatId),
    ),
  );
}

export function useIsPendingNewChat(): boolean {
  return useChatSessionsStore((state) => state.pendingNewChat);
}
