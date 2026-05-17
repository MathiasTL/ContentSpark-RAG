import { create } from 'zustand';
import type { ChatDetail } from '../services/chats-api';

export interface SessionMessage {
  role: 'user' | 'ai';
  content: string;
}

export interface ChatSession {
  chatId: string;
  chat: ChatDetail | null;
  messages: SessionMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  hasStartedStreaming: boolean;
  error: string | null;
  abortController: AbortController | null;
  requestVersion: number;
}

export interface ChatSessionsState {
  sessions: Record<string, ChatSession>;
  activeChatId: string | null;
  pendingNewChat: boolean;
  onChatListShouldRevalidate: (() => void) | null;

  setActiveChat: (id: string | null) => void;
  setOnChatListShouldRevalidate: (cb: (() => void) | null) => void;
  loadChat: (id: string) => Promise<void>;
  sendMessage: (id: string | null, text: string) => Promise<{ chatId: string }>;
  removeSession: (id: string) => void;
  cancelStream: (id: string) => void;
  resetAll: () => void;
}

export function emptySession(
  chatId: string,
  overrides: Partial<ChatSession> = {},
): ChatSession {
  return {
    chatId,
    chat: null,
    messages: [],
    isLoading: false,
    isStreaming: false,
    hasStartedStreaming: false,
    error: null,
    abortController: null,
    requestVersion: 0,
    ...overrides,
  };
}

export const useChatSessionsStore = create<ChatSessionsState>((set) => ({
  sessions: {},
  activeChatId: null,
  pendingNewChat: false,
  onChatListShouldRevalidate: null,

  setActiveChat: (id) => set({ activeChatId: id }),

  setOnChatListShouldRevalidate: (cb) => set({ onChatListShouldRevalidate: cb }),

  loadChat: async () => {
    throw new Error('loadChat not implemented');
  },

  sendMessage: async () => {
    throw new Error('sendMessage not implemented');
  },

  removeSession: () => {
    throw new Error('removeSession not implemented');
  },

  cancelStream: () => {
    throw new Error('cancelStream not implemented');
  },

  resetAll: () => {
    throw new Error('resetAll not implemented');
  },
}));
