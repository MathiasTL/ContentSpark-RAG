import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { emptySession, useChatSessionsStore } from '../store/chatSessionsStore';
import { useChatSession } from './useChatSession';

function resetStore() {
  useChatSessionsStore.setState({
    sessions: {},
    activeChatId: null,
    pendingNewChat: false,
    onChatListShouldRevalidate: null,
  });
}

beforeEach(resetStore);

describe('useChatSession', () => {
  it('retorna la sesión cuando existe en el store', () => {
    useChatSessionsStore.setState({
      sessions: { abc: emptySession('abc', { messages: [{ role: 'user', content: 'hi' }] }) },
    });

    const { result } = renderHook(() => useChatSession('abc'));
    expect(result.current?.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('cambio en sessions[id].messages causa re-render', () => {
    useChatSessionsStore.setState({ sessions: { abc: emptySession('abc') } });

    const { result } = renderHook(() => useChatSession('abc'));
    expect(result.current?.messages).toEqual([]);

    act(() => {
      useChatSessionsStore.setState((state) => ({
        sessions: {
          ...state.sessions,
          abc: { ...state.sessions.abc, messages: [{ role: 'user', content: 'nuevo' }] },
        },
      }));
    });

    expect(result.current?.messages).toEqual([{ role: 'user', content: 'nuevo' }]);
  });

  it('cambio en OTRO chatId NO re-renderiza el consumer', () => {
    useChatSessionsStore.setState({
      sessions: { abc: emptySession('abc'), xyz: emptySession('xyz') },
    });

    let renderCount = 0;
    renderHook(() => {
      renderCount++;
      return useChatSession('abc');
    });
    const initialRenders = renderCount;

    act(() => {
      useChatSessionsStore.setState((state) => ({
        sessions: {
          ...state.sessions,
          xyz: { ...state.sessions.xyz, messages: [{ role: 'user', content: 'otro' }] },
        },
      }));
    });

    expect(renderCount).toBe(initialRenders);
  });
});
