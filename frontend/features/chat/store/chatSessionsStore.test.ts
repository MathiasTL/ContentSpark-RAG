import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatSessionsStore } from './chatSessionsStore';

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
