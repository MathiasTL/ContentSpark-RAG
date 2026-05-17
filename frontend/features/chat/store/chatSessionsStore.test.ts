import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptySession, useChatSessionsStore } from './chatSessionsStore';
import * as chatsApi from '../services/chats-api';
import { ApiError } from '@/shared/lib/api-fetch';

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
