import { create } from 'zustand';
import type { ChatDetail } from '../services/chats-api';
import * as chatsApi from '../services/chats-api';
import * as chatStream from '../services/chat-stream';

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

async function streamInto(
  chatId: string,
  text: string,
  abortController: AbortController,
  versionAtStart: number,
  isFirstMessage: boolean,
): Promise<void> {
  try {
    await chatStream.streamMessage(chatId, text, abortController.signal, (chunk) => {
      const cur = useChatSessionsStore.getState().sessions[chatId];
      if (!cur || cur.requestVersion !== versionAtStart) return;

      useChatSessionsStore.setState((state) => {
        const session = state.sessions[chatId];
        if (!session) return state;
        const messages = [...session.messages];
        const last = messages[messages.length - 1];
        if (last?.role === 'ai') {
          messages[messages.length - 1] = { ...last, content: last.content + chunk };
        } else if (chunk.length > 0) {
          messages.push({ role: 'ai', content: chunk });
        }
        return {
          sessions: {
            ...state.sessions,
            [chatId]: {
              ...session,
              messages,
              hasStartedStreaming: session.hasStartedStreaming || chunk.length > 0,
            },
          },
        };
      });
    });

    const final = useChatSessionsStore.getState().sessions[chatId];
    if (!final || final.requestVersion !== versionAtStart) return;

    const empty = !final.hasStartedStreaming;
    useChatSessionsStore.setState((state) => ({
      sessions: {
        ...state.sessions,
        [chatId]: {
          ...state.sessions[chatId],
          isStreaming: false,
          abortController: null,
          error: empty ? 'Sin respuesta del modelo' : null,
        },
      },
    }));

    if (isFirstMessage) {
      useChatSessionsStore.getState().onChatListShouldRevalidate?.();
    }
  } catch (err) {
    const isAbort = err instanceof DOMException && err.name === 'AbortError';
    const cur = useChatSessionsStore.getState().sessions[chatId];
    if (!cur || cur.requestVersion !== versionAtStart) return;
    useChatSessionsStore.setState((state) => ({
      sessions: {
        ...state.sessions,
        [chatId]: {
          ...state.sessions[chatId],
          isStreaming: false,
          abortController: null,
          error: isAbort ? null : 'Conexión interrumpida',
        },
      },
    }));
  }
}

export const useChatSessionsStore = create<ChatSessionsState>((set) => ({
  sessions: {},
  activeChatId: null,
  pendingNewChat: false,
  onChatListShouldRevalidate: null,

  setActiveChat: (id) => set({ activeChatId: id }),

  setOnChatListShouldRevalidate: (cb) => set({ onChatListShouldRevalidate: cb }),

  loadChat: async (id) => {
    const existing = useChatSessionsStore.getState().sessions[id];
    if (existing?.isStreaming) return;

    set((state) => ({
      sessions: {
        ...state.sessions,
        [id]: {
          ...emptySession(id),
          ...existing,
          isLoading: true,
          error: null,
        },
      },
    }));

    const version = useChatSessionsStore.getState().sessions[id].requestVersion;

    try {
      const detail = await chatsApi.getChat(id);

      const cur = useChatSessionsStore.getState().sessions[id];
      if (!cur || cur.requestVersion !== version || cur.isStreaming) return;

      set((state) => ({
        sessions: {
          ...state.sessions,
          [id]: {
            ...state.sessions[id],
            chat: detail,
            messages: detail.messages.map((m) => ({ role: m.role, content: m.content })),
            isLoading: false,
            error: null,
          },
        },
      }));
    } catch (err) {
      set((state) => ({
        sessions: {
          ...state.sessions,
          [id]: {
            ...state.sessions[id],
            isLoading: false,
            error: err instanceof Error ? err.message : 'No se pudo cargar el chat',
          },
        },
      }));
      throw err;
    }
  },

  sendMessage: async (maybeChatId, text) => {
    if (maybeChatId) {
      const abortController = new AbortController();
      set((state) => {
        const cur = state.sessions[maybeChatId] ?? emptySession(maybeChatId);
        return {
          sessions: {
            ...state.sessions,
            [maybeChatId]: {
              ...cur,
              messages: [...cur.messages, { role: 'user', content: text }],
              isStreaming: true,
              hasStartedStreaming: false,
              error: null,
              abortController,
              requestVersion: cur.requestVersion + 1,
            },
          },
        };
      });
      const cur = useChatSessionsStore.getState().sessions[maybeChatId];
      const isFirst = cur.messages.length === 1;
      void streamInto(maybeChatId, text, abortController, cur.requestVersion, isFirst);
      return { chatId: maybeChatId };
    }

    set({ pendingNewChat: true });
    let chatId: string;
    try {
      const created = await chatsApi.createChat();
      chatId = created.id;
    } catch (err) {
      set({ pendingNewChat: false });
      throw err;
    }

    const abortController = new AbortController();
    set((state) => ({
      pendingNewChat: false,
      activeChatId: chatId,
      sessions: {
        ...state.sessions,
        [chatId]: emptySession(chatId, {
          messages: [{ role: 'user', content: text }],
          isStreaming: true,
          abortController,
          requestVersion: 1,
        }),
      },
    }));

    useChatSessionsStore.getState().onChatListShouldRevalidate?.();
    void streamInto(chatId, text, abortController, 1, true);
    return { chatId };
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
