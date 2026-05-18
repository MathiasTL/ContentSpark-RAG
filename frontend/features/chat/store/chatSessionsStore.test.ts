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

describe('sendMessage — chat nuevo', () => {
  it('devuelve {chatId} antes de que termine el stream (regresión bug original)', async () => {
    vi.spyOn(chatsApi, 'createChat').mockResolvedValue({
      id: 'new-1',
      title: null,
      is_archived: false,
      created_at: '',
      updated_at: '',
    });

    let streamResolve: () => void;
    const streamBlocked = new Promise<void>((r) => { streamResolve = r; });
    vi.spyOn(chatStream, 'streamMessage').mockImplementation(async () => {
      await streamBlocked;
    });

    const result = await useChatSessionsStore.getState().sendMessage(null, 'hola');

    expect(result.chatId).toBe('new-1');

    const session = useChatSessionsStore.getState().sessions['new-1'];
    expect(session.messages).toEqual([{ role: 'user', content: 'hola' }]);
    expect(session.isStreaming).toBe(true);
    expect(useChatSessionsStore.getState().activeChatId).toBe('new-1');
    expect(useChatSessionsStore.getState().pendingNewChat).toBe(false);

    streamResolve!();
  });

  it('llama onChatListShouldRevalidate dos veces: tras createChat y tras completar el primer stream', async () => {
    vi.spyOn(chatsApi, 'createChat').mockResolvedValue({
      id: 'new-2',
      title: null,
      is_archived: false,
      created_at: '',
      updated_at: '',
    });
    vi.spyOn(chatStream, 'streamMessage').mockImplementation(
      async (_id, _msg, _signal, onChunk) => {
        onChunk('respuesta');
      },
    );

    const revalidate = vi.fn();
    useChatSessionsStore.getState().setOnChatListShouldRevalidate(revalidate);

    await useChatSessionsStore.getState().sendMessage(null, 'hola');
    await new Promise((r) => setTimeout(r, 10));

    expect(revalidate).toHaveBeenCalledTimes(2);
  });

  it('limpia pendingNewChat si createChat falla', async () => {
    vi.spyOn(chatsApi, 'createChat').mockRejectedValue(new Error('boom'));

    await expect(useChatSessionsStore.getState().sendMessage(null, 'hola')).rejects.toThrow('boom');

    expect(useChatSessionsStore.getState().pendingNewChat).toBe(false);
    expect(Object.keys(useChatSessionsStore.getState().sessions)).toHaveLength(0);
  });
});

describe('races, abort y reset', () => {
  it('requestVersion filtra chunks de un sendMessage abortado por uno nuevo', async () => {
    useChatSessionsStore.setState({
      sessions: { abc: emptySession('abc') },
    });

    let firstOnChunk: ((c: string) => void) | null = null;
    let firstStreamPromise: Promise<void> | null = null;
    vi.spyOn(chatStream, 'streamMessage').mockImplementation(
      async (_id, _msg, _signal, onChunk) => {
        firstOnChunk = onChunk;
        firstStreamPromise = new Promise(() => {});
        return firstStreamPromise;
      },
    );

    void useChatSessionsStore.getState().sendMessage('abc', 'primer msg');
    await new Promise((r) => setTimeout(r, 20));

    // Reemplazamos el spy por una segunda implementación
    vi.spyOn(chatStream, 'streamMessage').mockImplementation(
      async (_id, _msg, _signal, onChunk) => {
        onChunk('segundo');
      },
    );

    await useChatSessionsStore.getState().sendMessage('abc', 'segundo msg');
    await new Promise((r) => setTimeout(r, 10));

    // Ahora el primer onChunk llega tarde:
    firstOnChunk!('chunk tardio');

    const messages = useChatSessionsStore.getState().sessions.abc.messages;
    // Debe contener segundo msg + respuesta "segundo" pero NO "chunk tardio"
    expect(messages.find((m) => m.content.includes('chunk tardio'))).toBeUndefined();
  });

  it('removeSession aborta el stream activo y elimina la sesión', () => {
    const abortController = new AbortController();
    const abortSpy = vi.spyOn(abortController, 'abort');
    useChatSessionsStore.setState({
      sessions: { abc: emptySession('abc', { isStreaming: true, abortController }) },
      activeChatId: 'abc',
    });

    useChatSessionsStore.getState().removeSession('abc');

    expect(abortSpy).toHaveBeenCalled();
    expect(useChatSessionsStore.getState().sessions.abc).toBeUndefined();
    expect(useChatSessionsStore.getState().activeChatId).toBeNull();
  });

  it('cancelStream NO setea error en la sesión (es intencional)', async () => {
    const abortController = new AbortController();
    useChatSessionsStore.setState({
      sessions: { abc: emptySession('abc', { isStreaming: true, abortController }) },
    });

    useChatSessionsStore.getState().cancelStream('abc');

    const session = useChatSessionsStore.getState().sessions.abc;
    expect(session.isStreaming).toBe(false);
    expect(session.error).toBeNull();
  });

  it('resetAll aborta todos los streams y vacía el state', () => {
    const ac1 = new AbortController();
    const ac2 = new AbortController();
    const abort1 = vi.spyOn(ac1, 'abort');
    const abort2 = vi.spyOn(ac2, 'abort');
    useChatSessionsStore.setState({
      sessions: {
        a: emptySession('a', { abortController: ac1 }),
        b: emptySession('b', { abortController: ac2 }),
      },
      activeChatId: 'a',
    });

    useChatSessionsStore.getState().resetAll();

    expect(abort1).toHaveBeenCalled();
    expect(abort2).toHaveBeenCalled();
    expect(useChatSessionsStore.getState().sessions).toEqual({});
    expect(useChatSessionsStore.getState().activeChatId).toBeNull();
  });

  it('stream con error de red setea error y preserva mensaje parcial', async () => {
    useChatSessionsStore.setState({
      sessions: { abc: emptySession('abc') },
    });

    vi.spyOn(chatStream, 'streamMessage').mockImplementation(
      async (_id, _msg, _signal, onChunk) => {
        onChunk('parcial');
        throw new Error('network');
      },
    );

    await useChatSessionsStore.getState().sendMessage('abc', 'ping');
    await new Promise((r) => setTimeout(r, 10));

    const session = useChatSessionsStore.getState().sessions.abc;
    expect(session.isStreaming).toBe(false);
    expect(session.error).toBe('Conexión interrumpida');
    expect(session.messages).toEqual([
      { role: 'user', content: 'ping' },
      { role: 'ai', content: 'parcial' },
    ]);
  });
});
