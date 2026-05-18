import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptySession, useChatSessionsStore } from './chatSessionsStore';
import * as chatsApi from '../services/chats-api';
import { ApiError } from '@/shared/lib/api-fetch';
import * as chatStream from '../services/chat-stream';

function resetStore() {
  useChatSessionsStore.setState({
    sessions: {},
    activeChatId: null,
    pendingNewChat: false,
    onChatListShouldRevalidate: null,
  });
}

beforeEach(() => {
  resetStore();
  vi.restoreAllMocks();
});

describe('loadChat', () => {
  it('hidrata sessions[id] desde getChat', async () => {
    vi.spyOn(chatsApi, 'getChat').mockResolvedValue({
      id: 'abc',
      title: 'Test',
      is_archived: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: 'hola',
          sources: null,
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'm2',
          role: 'ai',
          content: 'qué tal',
          sources: null,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
    });

    await useChatSessionsStore.getState().loadChat('abc');

    const session = useChatSessionsStore.getState().sessions.abc;
    expect(session.messages).toEqual([
      { role: 'user', content: 'hola' },
      { role: 'ai', content: 'qué tal' },
    ]);
    expect(session.chat?.title).toBe('Test');
    expect(session.isLoading).toBe(false);
    expect(session.error).toBeNull();
  });

  it('es no-op silencioso si la sesión ya está streameando', async () => {
    const getChatSpy = vi.spyOn(chatsApi, 'getChat');
    useChatSessionsStore.setState({
      sessions: {
        abc: { ...emptySession('abc'), isStreaming: true, messages: [{ role: 'user', content: 'hola' }] },
      },
    });

    await useChatSessionsStore.getState().loadChat('abc');

    expect(getChatSpy).not.toHaveBeenCalled();
    expect(useChatSessionsStore.getState().sessions.abc.messages).toEqual([
      { role: 'user', content: 'hola' },
    ]);
  });

  it('setea error y NO llena messages si getChat falla', async () => {
    vi.spyOn(chatsApi, 'getChat').mockRejectedValue(new ApiError(500, 'boom'));

    await expect(useChatSessionsStore.getState().loadChat('abc')).rejects.toThrow();

    const session = useChatSessionsStore.getState().sessions.abc;
    expect(session.isLoading).toBe(false);
    expect(session.error).toBeTruthy();
    expect(session.messages).toEqual([]);
  });
});

describe('setActiveChat', () => {
  it('mueve el puntero sin tocar sessions', () => {
    useChatSessionsStore.setState({
      sessions: { abc: { chatId: 'abc' } as any },
    });

    useChatSessionsStore.getState().setActiveChat('abc');

    const state = useChatSessionsStore.getState();
    expect(state.activeChatId).toBe('abc');
    expect(state.sessions.abc).toEqual({ chatId: 'abc' });
  });

  it('acepta null para desactivar', () => {
    useChatSessionsStore.getState().setActiveChat('abc');
    useChatSessionsStore.getState().setActiveChat(null);
    expect(useChatSessionsStore.getState().activeChatId).toBeNull();
  });
});

describe('sendMessage — chat existente', () => {
  function setupExistingChat(chatId: string) {
    useChatSessionsStore.setState({
      sessions: {
        [chatId]: emptySession(chatId, {
          chat: {
            id: chatId,
            title: 'existente',
            is_archived: false,
            created_at: '',
            updated_at: '',
            messages: [],
          },
        }),
      },
    });
  }

  it('empuja user msg optimista antes de que termine el stream', async () => {
    setupExistingChat('abc');
    let resolveStream: () => void;
    const streamPromise = new Promise<void>((r) => { resolveStream = r; });

    vi.spyOn(chatStream, 'streamMessage').mockImplementation(async () => {
      await streamPromise;
    });

    const sendPromise = useChatSessionsStore.getState().sendMessage('abc', 'hola');

    const stateMidStream = useChatSessionsStore.getState().sessions.abc;
    expect(stateMidStream.messages).toEqual([{ role: 'user', content: 'hola' }]);
    expect(stateMidStream.isStreaming).toBe(true);

    resolveStream!();
    await sendPromise;
  });

  it('acumula chunks AI en el último mensaje', async () => {
    setupExistingChat('abc');

    vi.spyOn(chatStream, 'streamMessage').mockImplementation(
      async (_id, _msg, _signal, onChunk) => {
        onChunk('Hola');
        onChunk(' mundo');
      },
    );

    await useChatSessionsStore.getState().sendMessage('abc', 'ping');
    // Pequeña espera porque _streamInto se kickea fire-and-forget
    await new Promise((r) => setTimeout(r, 10));

    const messages = useChatSessionsStore.getState().sessions.abc.messages;
    expect(messages).toEqual([
      { role: 'user', content: 'ping' },
      { role: 'ai', content: 'Hola mundo' },
    ]);
  });

  it('marca hasStartedStreaming en el primer chunk no vacío', async () => {
    setupExistingChat('abc');

    let firstChunkHandled = false;
    vi.spyOn(chatStream, 'streamMessage').mockImplementation(
      async (_id, _msg, _signal, onChunk) => {
        const before = useChatSessionsStore.getState().sessions.abc.hasStartedStreaming;
        expect(before).toBe(false);
        onChunk('x');
        firstChunkHandled = useChatSessionsStore.getState().sessions.abc.hasStartedStreaming;
      },
    );

    await useChatSessionsStore.getState().sendMessage('abc', 'ping');
    await new Promise((r) => setTimeout(r, 10));

    expect(firstChunkHandled).toBe(true);
  });
});
