# Chat Session Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Subir el estado de la sesión de chat (mensajes, streaming, errores) a un store global de Zustand fuera del árbol React, para que sobreviva la transición `/chat → /chat/[id]` y desaparezca el bug donde la respuesta del primer mensaje no se ve hasta recargar. Adicionalmente: cache por `chatId`, indicador de streaming en sidebar, errores aislados por sesión, y AbortController para abort intencional.

**Architecture:** Store global de Zustand (singleton de módulo, fuera de React) en `frontend/features/chat/store/chatSessionsStore.ts`. La capa de selectores (`useChatSession`, `useActiveChatId`, `useStreamingChatIds`) la consume desde componentes "dumb". Los streams se kickean fire-and-forget desde `sendMessage` con `AbortController` por sesión. La URL la maneja el caller (router.replace después de createChat), pero el estado ya no depende de qué `ChatView` esté montado.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · pnpm 11 · Zustand 5 · Vitest 3 · @testing-library/react 16 · jsdom 25

**Spec:** `docs/superpowers/specs/2026-05-17-chat-session-architecture-design.md`

---

## File Structure

**Nuevos:**
- `frontend/vitest.config.ts` — configuración de Vitest con jsdom
- `frontend/vitest.setup.ts` — setup de tests (auto-cleanup RTL)
- `frontend/features/chat/services/chat-stream.ts` — stream con `AbortSignal`
- `frontend/features/chat/store/chatSessionsStore.ts` — Zustand store + acciones
- `frontend/features/chat/store/chatSessionsStore.test.ts` — 14 tests del store
- `frontend/features/chat/hooks/useChatSession.test.tsx` — 3 tests del selector
- `frontend/features/chat/components/ChatStoreBridge.tsx` — registra revalidate del list en el store

**Modificados:**
- `frontend/package.json` — deps + script `test`
- `frontend/tsconfig.json` — incluir tipos de vitest si necesario
- `frontend/shared/lib/api-client.ts` — quitar `streamMessageFromBackend` (se mueve a chat-stream.ts)
- `frontend/features/chat/hooks/useChatSession.ts` — pasa a ser selector
- `frontend/features/chat/ChatView.tsx` — consume store, deja de hacer createChat y stream directos
- `frontend/app/(app)/chat/layout.tsx` — monta `ChatStoreBridge`
- `frontend/features/chat/hooks/useChatList.tsx` — `removeChat` también limpia store
- `frontend/features/chat/components/ChatListItem.tsx` — indicador "streaming"
- `frontend/features/chat/components/ChatSidebar.tsx` — pasa flag de streaming al item
- `frontend/shared/lib/api-fetch.ts` — `handleAuthError` llama `resetAll`

---

## Task 1: Setup de Vitest + Zustand

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/vitest.setup.ts`
- Create: `frontend/__smoke__/smoke.test.ts` (temporal, se borra al final del task)

- [ ] **Step 1: Instalar dependencias**

```bash
cd /Users/mathiastl/Projects/ContentSpark-RAG/frontend
pnpm add zustand
pnpm add -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/dom @testing-library/jest-dom jsdom
```

Verificar que `package.json` agregó las deps. Si pnpm intenta usar workspaces y falla, correr con `--ignore-workspace`.

- [ ] **Step 2: Crear `vitest.config.ts`**

```ts
// frontend/vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    css: false,
    include: ['**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

- [ ] **Step 3: Crear `vitest.setup.ts`**

```ts
// frontend/vitest.setup.ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 4: Agregar scripts a `package.json`**

Agregar dentro del bloque `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Crear smoke test temporal**

```ts
// frontend/__smoke__/smoke.test.ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Correr el smoke test**

```bash
cd frontend && pnpm test
```

Expected: 1 test PASS, exit code 0.

- [ ] **Step 7: Borrar smoke test**

```bash
rm -rf frontend/__smoke__
```

- [ ] **Step 8: Verificar typecheck y lint**

```bash
cd frontend && npx tsc --noEmit && pnpm lint
```

Expected: ambos verdes.

- [ ] **Step 9: Commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml frontend/vitest.config.ts frontend/vitest.setup.ts
git commit -m "chore(frontend): install zustand + vitest + RTL"
```

---

## Task 2: Extraer chat-stream service con AbortSignal

**Files:**
- Create: `frontend/features/chat/services/chat-stream.ts`
- Modify: `frontend/shared/lib/api-client.ts:33-66` (quitar `streamMessageFromBackend`)
- Modify: `frontend/features/chat/ChatView.tsx:10` (cambiar import)

- [ ] **Step 1: Crear `chat-stream.ts`**

```ts
// frontend/features/chat/services/chat-stream.ts
import { BACKEND_URL, getAuthHeaders, handleAuthError } from '@/shared/lib/api-fetch';

export async function streamMessage(
  chatId: string,
  message: string,
  signal: AbortSignal,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/api/chat`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({ chat_id: chatId, message }),
  });

  await handleAuthError(response);
  if (!response.ok) {
    throw new Error(`Stream falló con status ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder('utf-8');

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}
```

Nota: a diferencia del `streamMessageFromBackend` viejo, este **propaga errores** (no devuelve un onChunk de mensaje de fallback). El store decide qué hacer con el error.

- [ ] **Step 2: Quitar `streamMessageFromBackend` de `api-client.ts`**

Abrir `frontend/shared/lib/api-client.ts`. Eliminar el bloque completo de la función `streamMessageFromBackend` (líneas 33-66 aprox). Mantener `getSourcesFromBackend` y el interface `Source`.

Después del cambio, el archivo debe verse así:

```ts
// frontend/shared/lib/api-client.ts
import { apiFetch } from '@/shared/lib/api-fetch';

export interface Source {
  id: string;
  title: string;
  type: string;
  status: string;
}

export interface SourcesResponse {
  success: boolean;
  sources: Source[];
}

export async function getSourcesFromBackend(): Promise<SourcesResponse> {
  try {
    const response = await apiFetch('/api/sources', { method: 'GET' });
    if (!response.ok) {
      throw new Error(`Error en el servidor: ${response.status}`);
    }
    return (await response.json()) as SourcesResponse;
  } catch (error) {
    console.error('Error conectando con ContentSpark:', error);
    return { success: false, sources: [] };
  }
}
```

- [ ] **Step 3: Actualizar import en `ChatView.tsx`**

En `frontend/features/chat/ChatView.tsx` línea 10, cambiar:

```ts
import { getSourcesFromBackend, streamMessageFromBackend } from "@/shared/lib/api-client";
import type { Source } from "@/shared/lib/api-client";
```

Por (temporal, hasta task 5 que ya no usa streamMessage directo):

```ts
import { getSourcesFromBackend } from "@/shared/lib/api-client";
import type { Source } from "@/shared/lib/api-client";
import { streamMessage } from "./services/chat-stream";
```

Y en la línea 151 (dentro de `handleSend`):

```ts
await streamMessage(activeChatId, text, new AbortController().signal, (chunk) => {
```

(El refactor real del flujo lo hace Task 8 cuando ChatView pasa a usar el store; aquí solo nos aseguramos de que compila tras mover el helper.)

- [ ] **Step 4: Typecheck + build**

```bash
cd frontend && npx tsc --noEmit && pnpm build
```

Expected: build exitoso. Cualquier referencia residual a `streamMessageFromBackend` lo señala TypeScript.

- [ ] **Step 5: Smoke manual en browser**

```bash
cd frontend && pnpm dev
```

Abrir `/chat/<algún-chat-existente>` y enviar un mensaje. Verificar que **el caso `chatId existente`** sigue funcionando exactamente como antes (este task no toca el bug, solo extrae la función). Detener server con Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add frontend/features/chat/services/chat-stream.ts \
        frontend/shared/lib/api-client.ts \
        frontend/features/chat/ChatView.tsx
git commit -m "refactor(chat): extract chat-stream service with AbortSignal"
```

---

## Task 3: Store skeleton + test de `setActiveChat`

**Files:**
- Create: `frontend/features/chat/store/chatSessionsStore.ts`
- Create: `frontend/features/chat/store/chatSessionsStore.test.ts`

- [ ] **Step 1: Escribir el test failing**

```ts
// frontend/features/chat/store/chatSessionsStore.test.ts
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
```

- [ ] **Step 2: Correr el test → debe FALLAR**

```bash
cd frontend && pnpm test
```

Expected: FAIL — "Cannot find module './chatSessionsStore'".

- [ ] **Step 3: Crear el store skeleton**

```ts
// frontend/features/chat/store/chatSessionsStore.ts
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
```

- [ ] **Step 4: Correr el test → debe PASAR**

```bash
cd frontend && pnpm test
```

Expected: 2 tests PASS en `setActiveChat`.

- [ ] **Step 5: Commit**

```bash
git add frontend/features/chat/store/chatSessionsStore.ts \
        frontend/features/chat/store/chatSessionsStore.test.ts
git commit -m "feat(chat): chatSessionsStore skeleton + setActiveChat"
```

---

## Task 4: Tests + impl de `loadChat` (3 tests)

Cubre tests #1, #2, #3 del spec: hidrata, no-op si streaming, error al fallar.

**Files:**
- Modify: `frontend/features/chat/store/chatSessionsStore.ts`
- Modify: `frontend/features/chat/store/chatSessionsStore.test.ts`

- [ ] **Step 1: Agregar tests al test file**

Pegar antes de `describe('setActiveChat'`:

```ts
import * as chatsApi from '../services/chats-api';
import { ApiError } from '@/shared/lib/api-fetch';

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
```

Y agregar el import del helper en el test file:

```ts
import { emptySession, useChatSessionsStore } from './chatSessionsStore';
```

- [ ] **Step 2: Correr → debe FALLAR**

```bash
cd frontend && pnpm test
```

Expected: 3 tests FAIL con "loadChat not implemented".

- [ ] **Step 3: Implementar `loadChat`**

Reemplazar `loadChat: async () => { throw ... }` por:

```ts
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
```

Y agregar el import al inicio del store file:

```ts
import * as chatsApi from '../services/chats-api';
```

- [ ] **Step 4: Correr → debe PASAR**

```bash
cd frontend && pnpm test
```

Expected: 5 tests PASS total (2 setActiveChat + 3 loadChat).

- [ ] **Step 5: Commit**

```bash
git add frontend/features/chat/store/chatSessionsStore.ts \
        frontend/features/chat/store/chatSessionsStore.test.ts
git commit -m "feat(chat): loadChat with isStreaming guard and error path"
```

---

## Task 5: Test + impl de `sendMessage` para chat existente

Cubre tests #5 (user msg optimista), #6 (chunks acumulan), #7 (hasStartedStreaming).

**Files:**
- Modify: `frontend/features/chat/store/chatSessionsStore.ts`
- Modify: `frontend/features/chat/store/chatSessionsStore.test.ts`

- [ ] **Step 1: Agregar tests al test file**

Pegar al final del archivo:

```ts
import * as chatStream from '../services/chat-stream';

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
```

- [ ] **Step 2: Correr → debe FALLAR**

Expected: 3 tests FAIL con "sendMessage not implemented".

- [ ] **Step 3: Implementar `sendMessage` (chat existente) + helper `streamInto`**

En `chatSessionsStore.ts`, agregar al inicio:

```ts
import * as chatStream from '../services/chat-stream';
```

Reemplazar `sendMessage: async () => { throw ... }` y agregar el helper privado:

```ts
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
```

Y reemplazar `sendMessage`:

```ts
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

  // Caso new chat: implementado en task 6
  throw new Error('sendMessage(null) not implemented yet');
},
```

- [ ] **Step 4: Correr → debe PASAR**

Expected: 8 tests PASS total.

- [ ] **Step 5: Commit**

```bash
git add frontend/features/chat/store/chatSessionsStore.ts \
        frontend/features/chat/store/chatSessionsStore.test.ts
git commit -m "feat(chat): sendMessage for existing chat with streaming"
```

---

## Task 6: Test + impl de `sendMessage` para chat nuevo + revalidate

Cubre tests #4 (devuelve chatId antes que el stream termine — regresión del bug) y #8 (revalidate tras completar primer msg).

**Files:**
- Modify: `frontend/features/chat/store/chatSessionsStore.ts`
- Modify: `frontend/features/chat/store/chatSessionsStore.test.ts`

- [ ] **Step 1: Agregar tests**

Pegar al final del test file:

```ts
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
```

- [ ] **Step 2: Correr → debe FALLAR**

Expected: 3 tests FAIL con "sendMessage(null) not implemented yet".

- [ ] **Step 3: Implementar caso de chat nuevo**

Reemplazar el bloque del else en `sendMessage` (el `throw new Error('sendMessage(null) not implemented yet')`) por:

```ts
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
```

- [ ] **Step 4: Correr → debe PASAR**

Expected: 11 tests PASS total.

- [ ] **Step 5: Commit**

```bash
git add frontend/features/chat/store/chatSessionsStore.ts \
        frontend/features/chat/store/chatSessionsStore.test.ts
git commit -m "feat(chat): sendMessage creates new chat + revalidate"
```

---

## Task 7: Tests de race + abort + reset (4 tests)

Cubre tests #9 (requestVersion filtra), #10 (removeSession aborta), #11 (cancelStream sin error), #12 (resetAll), #13 (stream error preserva parcial).

**Files:**
- Modify: `frontend/features/chat/store/chatSessionsStore.ts`
- Modify: `frontend/features/chat/store/chatSessionsStore.test.ts`

- [ ] **Step 1: Agregar tests**

```ts
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
    await new Promise((r) => setTimeout(r, 5));

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
```

- [ ] **Step 2: Correr → debe FALLAR**

Expected: 4 tests FAIL ("removeSession not implemented", etc), 1 test PASS (el de stream error — el streamInto ya lo maneja del task 5).

- [ ] **Step 3: Implementar `removeSession`, `cancelStream`, `resetAll`**

Reemplazar las 3 acciones stub en el store:

```ts
removeSession: (id) =>
  set((state) => {
    const session = state.sessions[id];
    session?.abortController?.abort();
    const rest = { ...state.sessions };
    delete rest[id];
    return {
      sessions: rest,
      activeChatId: state.activeChatId === id ? null : state.activeChatId,
    };
  }),

cancelStream: (id) => {
  const session = useChatSessionsStore.getState().sessions[id];
  if (!session) return;
  session.abortController?.abort();
  set((state) => ({
    sessions: {
      ...state.sessions,
      [id]: {
        ...state.sessions[id],
        isStreaming: false,
        abortController: null,
      },
    },
  }));
},

resetAll: () => {
  Object.values(useChatSessionsStore.getState().sessions).forEach((s) =>
    s.abortController?.abort(),
  );
  set({ sessions: {}, activeChatId: null, pendingNewChat: false });
},
```

- [ ] **Step 4: Correr → debe PASAR**

Expected: 16 tests PASS total. Si el test de "requestVersion filtra" sigue fallando con `firstOnChunk` null, ajustar el `await new Promise((r) => setTimeout(r, 5))` a 20ms; el fire-and-forget puede tardar más en Vitest.

- [ ] **Step 5: Commit**

```bash
git add frontend/features/chat/store/chatSessionsStore.ts \
        frontend/features/chat/store/chatSessionsStore.test.ts
git commit -m "feat(chat): removeSession, cancelStream, resetAll + race tests"
```

---

## Task 8: Tests del selector hook `useChatSession`

Cubre tests #15, #16, #17 del spec.

**Files:**
- Create: `frontend/features/chat/hooks/useChatSession.test.tsx`

- [ ] **Step 1: Escribir tests**

```tsx
// frontend/features/chat/hooks/useChatSession.test.tsx
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
```

- [ ] **Step 2: Correr → debe FALLAR**

Vitest reportará que `useChatSession` no existe con la signature esperada, O que retorna un shape distinto.

- [ ] **Step 3: Refactor `useChatSession` a selector**

Reemplazar todo el contenido de `frontend/features/chat/hooks/useChatSession.ts` por:

```ts
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
```

Nota: este cambio **elimina la API anterior** de `useChatSession` (`messages`, `setMessages`, `isLoading`, `error`, `chat` desestructurables). El Task 9 actualiza `ChatView` para consumir el nuevo shape.

- [ ] **Step 4: Correr → debe PASAR**

Expected: 19 tests PASS total (16 store + 3 selector).

- [ ] **Step 5: Verificar typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Va a fallar con errores en `ChatView.tsx` porque la API cambió. Eso es esperado — los arregla Task 9. **Pero el `pnpm test` debe estar verde.**

- [ ] **Step 6: Commit**

```bash
git add frontend/features/chat/hooks/useChatSession.ts \
        frontend/features/chat/hooks/useChatSession.test.tsx
git commit -m "refactor(chat): useChatSession is a selector over the store"
```

---

## Task 9: Refactor de `ChatView` para consumir el store

**Files:**
- Modify: `frontend/features/chat/ChatView.tsx`

- [ ] **Step 1: Reescribir el archivo**

Reemplazar todo el contenido de `frontend/features/chat/ChatView.tsx` por:

```tsx
"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Paperclip, Send, UserCircle2 } from "lucide-react";

import { getSourcesFromBackend } from "@/shared/lib/api-client";
import type { Source } from "@/shared/lib/api-client";
import { useChatSessionsStore } from "./store/chatSessionsStore";
import {
  useChatSession,
  useIsPendingNewChat,
} from "./hooks/useChatSession";
import ChatHeader from "./components/ChatHeader";
import SourcesModal from "./components/SourcesModal";
import { ScrollArea } from "@/shared/components/ui/scroll-area";

interface ChatViewProps {
  chatId?: string;
}

const SUGGESTED_PROMPTS = [
  "Dame hooks virales",
  "Estrategia de contenido para esta semana",
  "Ideas de contenido trending",
];

function WelcomeMessage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/20 bg-white/30 p-3 shadow-lg backdrop-blur-2xl">
        <Image src="/only_logo.png" alt="ContentSpark" width={52} height={52} priority />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-on-surface">
          Desata tu creatividad con ContentSpark
        </h2>
        <p className="mx-auto max-w-md text-sm font-light leading-relaxed text-on-surface-variant">
          Consulta tu base de conocimiento. ContentSpark busca en sus documentos
          ingestados y genera respuestas contextualizadas.
        </p>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex max-w-3xl gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/20 p-1.5 shadow-lg backdrop-blur-2xl">
        <Image src="/only_logo.png" alt="AI" width={28} height={28} />
      </div>
      <div className="rounded-3xl rounded-tl-none border border-white/10 bg-white/40 px-6 py-4 backdrop-blur-2xl">
        <span className="flex h-5 items-center gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-on-surface-variant [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-on-surface-variant [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-on-surface-variant" />
        </span>
      </div>
    </div>
  );
}

export default function ChatView({ chatId }: ChatViewProps) {
  const router = useRouter();
  const setActiveChat = useChatSessionsStore((s) => s.setActiveChat);
  const loadChat = useChatSessionsStore((s) => s.loadChat);
  const sendMessage = useChatSessionsStore((s) => s.sendMessage);
  const session = useChatSession(chatId);
  const pendingNewChat = useIsPendingNewChat();

  const [input, setInput] = useState("");
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [isSourcesLoading, setIsSourcesLoading] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const messages = session?.messages ?? [];
  const isLoading = session?.isLoading ?? false;
  const isStreaming = session?.isStreaming ?? false;
  const hasStartedStreaming = session?.hasStartedStreaming ?? false;
  const error = session?.error ?? null;

  useEffect(() => {
    setActiveChat(chatId ?? null);
  }, [chatId, setActiveChat]);

  useEffect(() => {
    if (!chatId) return;
    if (session) return;
    void loadChat(chatId).catch((err) => {
      if (err?.status === 404) {
        router.replace("/chat");
      }
    });
  }, [chatId, session, loadChat, router]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  async function openSourcesModal() {
    setIsSourcesOpen(true);
    setIsSourcesLoading(true);
    setSourcesError(null);

    const result = await getSourcesFromBackend();
    if (!result.success) {
      setSources([]);
      setSourcesError("No fue posible cargar las fuentes en este momento.");
      setIsSourcesLoading(false);
      return;
    }

    const pdfSources = result.sources.filter((s) => {
      const type = s.type.toLowerCase();
      const title = s.title.toLowerCase();
      return type.includes("pdf") || title.endsWith(".pdf");
    });
    setSources(pdfSources);
    setIsSourcesLoading(false);
  }

  async function handleSend(text: string) {
    if (!text || isStreaming || pendingNewChat) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const { chatId: resultChatId } = await sendMessage(chatId ?? null, text);
      if (!chatId) {
        router.replace(`/chat/${resultChatId}`);
      }
    } catch (err) {
      console.error("[ChatView] sendMessage falló:", err);
    }
  }

  function sendCurrentInput() {
    handleSend(input.trim());
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendCurrentInput();
    }
  }

  const showWelcome = messages.length === 0 && !isLoading && !pendingNewChat;

  return (
    <div className="flex h-dvh w-full">
      <section className="relative flex h-dvh min-w-0 flex-1 flex-col overflow-hidden bg-surface/60 backdrop-blur-sm">
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/10 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-secondary/10 blur-[120px]" />

        <ChatHeader onOpenSources={openSourcesModal} />

        <ScrollArea className="relative z-10 min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]>div]:!flex [&_[data-radix-scroll-area-viewport]>div]:!min-h-full [&_[data-radix-scroll-area-viewport]>div]:!flex-col [&_[data-radix-scroll-area-viewport]>div]:!justify-end">
          <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-end space-y-8 px-12 pt-12 pb-6">
            {isLoading && (
              <div className="space-y-6">
                {[0, 1].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-3xl bg-white/10" />
                ))}
              </div>
            )}

            {showWelcome && <WelcomeMessage />}

            {messages.map((msg, i) =>
              msg.role === "user" ? (
                <div key={i} className="ml-auto flex max-w-3xl flex-row-reverse gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-primary-container shadow-lg">
                    <UserCircle2 className="h-7 w-7 text-white/80" strokeWidth={1.25} />
                  </div>
                  <div className="liquid-gradient rounded-3xl rounded-tr-none border border-white/10 p-6 leading-relaxed text-white shadow-xl shadow-primary/10 backdrop-blur-2xl">
                    <p className="font-light">{msg.content}</p>
                  </div>
                </div>
              ) : (
                <div key={i} className="flex max-w-3xl gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/20 p-1.5 shadow-lg backdrop-blur-2xl">
                    <Image src="/only_logo.png" alt="AI" width={28} height={28} />
                  </div>
                  <div className="rounded-3xl rounded-tl-none border border-white/10 bg-white/40 p-6 leading-relaxed text-on-surface shadow-sm backdrop-blur-2xl">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => (
                          <p className="mb-2 font-light leading-relaxed last:mb-0">{children}</p>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-semibold text-on-surface">{children}</strong>
                        ),
                        ul: ({ children }) => (
                          <ul className="mt-3 list-disc space-y-2 pl-5 font-light text-on-surface-variant">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="mt-3 list-decimal space-y-2 pl-5 font-light text-on-surface-variant">
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => <li>{children}</li>,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              ),
            )}

            {isStreaming && !hasStartedStreaming && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="relative z-10 mx-auto w-full max-w-4xl shrink-0 space-y-6 px-12 pb-8">
          {error && (
            <div className="rounded-2xl border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {messages.length === 0 && (
            <div className="flex flex-wrap justify-center gap-3">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSend(prompt)}
                  disabled={isStreaming || pendingNewChat}
                  className="rounded-full border border-white/10 bg-white/20 px-5 py-2.5 text-xs font-semibold text-on-surface-variant backdrop-blur-2xl transition-all hover:scale-105 hover:bg-white/40 disabled:opacity-40"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          <div className="group relative">
            <div className="absolute inset-0 rounded-full bg-primary/5 opacity-0 blur-2xl transition-opacity group-focus-within:opacity-100" />
            <div className="relative flex items-end gap-2 rounded-full border border-white/10 bg-white/30 p-2 pl-8 shadow-2xl backdrop-blur-2xl">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pregunta a ContentSpark lo que necesites..."
                disabled={isStreaming || pendingNewChat}
                className="max-h-40 flex-1 resize-none overflow-hidden border-none bg-transparent py-3 font-light leading-relaxed text-on-surface placeholder:text-on-surface-variant/50 focus:ring-0 focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                aria-label="Adjuntar archivo"
                className="flex h-10 w-10 shrink-0 items-center justify-center text-on-surface-variant transition-colors hover:text-primary"
              >
                <Paperclip size={20} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={sendCurrentInput}
                disabled={isStreaming || pendingNewChat || !input.trim()}
                aria-label="Enviar mensaje"
                className="liquid-gradient flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-lg shadow-primary/30 transition-transform hover:scale-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
              >
                {isStreaming || pendingNewChat ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <Send size={18} strokeWidth={2} />
                )}
              </button>
            </div>
          </div>

          <p className="text-center text-[10px] uppercase tracking-widest text-on-surface-variant/50">
            Powered by ContentSpark AI
          </p>
        </div>
      </section>

      <SourcesModal
        isOpen={isSourcesOpen}
        isLoading={isSourcesLoading}
        sources={sources}
        error={sourcesError}
        onClose={() => setIsSourcesOpen(false)}
      />
    </div>
  );
}
```

Cambios principales:
- Borra `useChatList` import (ya no se llama `revalidate` desde ChatView — eso lo hace el bridge en Task 10)
- Borra el `useEffect` que sincronizaba `session.messages` con `messages` local
- Borra `requestVersionRef` y `titleNeedsRefreshRef`
- `handleSend` reducido a `await sendMessage(...) + router.replace si era new chat`
- Error banner inline arriba del input (en vez de inyectar mensaje fake de AI)
- Disabled del send/textarea ahora incluye `pendingNewChat`

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Expected: limpio.

- [ ] **Step 3: Tests**

```bash
cd frontend && pnpm test
```

Expected: 19 tests PASS (sin regresiones).

- [ ] **Step 4: Smoke manual del flow del bug**

```bash
cd frontend && pnpm dev
```

Abrir `http://localhost:3000/chat`. Enviar un mensaje. **Verificar que la respuesta del AI aparece sin recargar.** Este es el bug original — debe estar arreglado.

Probar también: F5 sobre `/chat/[id]` → mensajes cargan.

Detener server con Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add frontend/features/chat/ChatView.tsx
git commit -m "refactor(chat): ChatView consumes sendMessage from store"
```

---

## Task 10: `ChatStoreBridge` en el layout

**Files:**
- Create: `frontend/features/chat/components/ChatStoreBridge.tsx`
- Modify: `frontend/app/(app)/chat/layout.tsx`

- [ ] **Step 1: Crear `ChatStoreBridge.tsx`**

```tsx
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
```

- [ ] **Step 2: Montar el bridge en `chat/layout.tsx`**

Reemplazar `frontend/app/(app)/chat/layout.tsx` por:

```tsx
import { ChatListProvider } from "@/features/chat/hooks/useChatList";
import ChatSidebar from "@/features/chat/components/ChatSidebar";
import ChatStoreBridge from "@/features/chat/components/ChatStoreBridge";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChatListProvider>
      <ChatStoreBridge />
      <div className="flex h-dvh w-full">
        <ChatSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </ChatListProvider>
  );
}
```

- [ ] **Step 3: Typecheck + tests + build**

```bash
cd frontend && npx tsc --noEmit && pnpm test && pnpm build
```

Expected: todo verde.

- [ ] **Step 4: Smoke manual — primer msg refresca título en sidebar**

```bash
cd frontend && pnpm dev
```

Crear nuevo chat enviando un mensaje. Verificar:
1. Apenas se envía: nuevo item en sidebar (puede mostrar "Sin titulo").
2. Tras completar el stream: el item refresca con el título auto-generado.

- [ ] **Step 5: Commit**

```bash
git add frontend/features/chat/components/ChatStoreBridge.tsx \
        frontend/app/\(app\)/chat/layout.tsx
git commit -m "feat(chat): ChatStoreBridge wires sidebar revalidate into the store"
```

---

## Task 11: Coordinar `deleteChat` con el store

**Files:**
- Modify: `frontend/features/chat/hooks/useChatList.tsx:52-65` (función `removeChat`)

Nota de diseño: el redirect a `/chat` cuando borras el chat activo **ya lo hace `ChatSidebar.handleDelete`** basándose en `pathname` (líneas 22-31 de ChatSidebar.tsx), y eso es correcto — solo redirige si efectivamente estás en `/chat/[id]`. No movemos esa lógica al hook (rompería el caso de borrar un chat desde otro contexto donde el user no debe ser yanked away). El hook solo limpia el store.

- [ ] **Step 1: Actualizar `removeChat`**

En `frontend/features/chat/hooks/useChatList.tsx`, agregar el import del store al inicio:

```tsx
import { useChatSessionsStore } from '../store/chatSessionsStore';
```

Reemplazar el bloque `removeChat` por:

```tsx
const removeChat = useCallback(
  async (id: string) => {
    const previous = chats;
    setChats((prev) => prev.filter((c) => c.id !== id));

    useChatSessionsStore.getState().removeSession(id);

    try {
      await deleteChatApi(id);
    } catch (err) {
      console.error("[ChatList] deleteChat fallo:", err);
      setChats(previous);
      throw err;
    }
  },
  [chats],
);
```

- [ ] **Step 2: Typecheck + tests**

```bash
cd frontend && npx tsc --noEmit && pnpm test
```

Expected: verde.

- [ ] **Step 3: Smoke manual — borrar chat activo durante stream**

```bash
cd frontend && pnpm dev
```

1. Abrir un chat existente, enviar un mensaje largo (5+ líneas en respuesta).
2. Durante el stream, borrar el chat actual desde la sidebar (icono trash → "Sí").
3. Verificar: redirige a `/chat`, sin errores en consola.

- [ ] **Step 4: Commit**

```bash
git add frontend/features/chat/hooks/useChatList.tsx
git commit -m "feat(chat): deleteChat aborts stream and clears session"
```

---

## Task 12: Indicador "streaming" en sidebar

**Files:**
- Modify: `frontend/features/chat/components/ChatSidebar.tsx`
- Modify: `frontend/features/chat/components/ChatListItem.tsx`

- [ ] **Step 1: Leer el sidebar actual**

```bash
cat frontend/features/chat/components/ChatSidebar.tsx
```

Identificar dónde se renderiza el loop de `<ChatListItem>` y pasarle un nuevo prop `isStreaming`.

- [ ] **Step 2: Pasar `isStreaming` desde sidebar**

En `ChatSidebar.tsx`, agregar al inicio del componente:

```tsx
import { useStreamingChatIds } from "../hooks/useChatSession";
```

Y dentro del componente:

```tsx
const streamingIds = useStreamingChatIds();
const streamingSet = new Set(streamingIds);
```

En el loop donde se renderiza `<ChatListItem>`, agregar el prop:

```tsx
<ChatListItem
  ...otrosProps
  isStreaming={streamingSet.has(chat.id)}
/>
```

- [ ] **Step 3: Aceptar y renderizar `isStreaming` en `ChatListItem`**

En `frontend/features/chat/components/ChatListItem.tsx`:

Agregar al interface:

```ts
interface ChatListItemProps {
  id: string;
  title: string | null;
  updatedAt: string;
  isActive: boolean;
  collapsed: boolean;
  isStreaming: boolean;
  onDelete: (id: string) => Promise<void>;
}
```

Desestructurar `isStreaming` en la firma del componente.

En el render **collapsed**, agregar el dot:

```tsx
return (
  <Link
    href={`/chat/${id}`}
    title={displayTitle}
    className={`relative flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
      isActive
        ? "bg-primary/15 text-primary"
        : "bg-white/10 text-on-surface-variant hover:bg-white/30 hover:text-primary"
    }`}
  >
    {displayTitle.charAt(0).toUpperCase()}
    {isStreaming && (
      <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-green-400 ring-2 ring-surface" />
    )}
  </Link>
);
```

Y en el render **expanded** (el `return` final), inmediatamente después del span del título:

```tsx
{isStreaming && (
  <span
    aria-label="Streameando"
    className="ml-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-green-400"
  />
)}
```

(Ubicarlo dentro del bloque `<div className="flex items-start justify-between gap-2">`, después del `<span className="block truncate text-sm ...">{displayTitle}</span>` y antes del `<span className="shrink-0 ...">{formatRelative(updatedAt)}</span>`.)

- [ ] **Step 4: Typecheck + tests**

```bash
cd frontend && npx tsc --noEmit && pnpm test
```

- [ ] **Step 5: Smoke manual**

```bash
cd frontend && pnpm dev
```

1. Abrir chat A, enviar mensaje largo.
2. Mientras streamea, click en chat B en sidebar.
3. Verificar: chat A muestra el dot verde animado.
4. Click vuelta a A: dot desaparece cuando el stream completó.

- [ ] **Step 6: Commit**

```bash
git add frontend/features/chat/components/ChatSidebar.tsx \
        frontend/features/chat/components/ChatListItem.tsx
git commit -m "feat(chat): streaming indicator in sidebar"
```

---

## Task 13: `handleAuthError` limpia el store

**Files:**
- Modify: `frontend/shared/lib/api-fetch.ts:13-19`

- [ ] **Step 1: Actualizar `handleAuthError`**

Reemplazar la función `handleAuthError` en `frontend/shared/lib/api-fetch.ts`:

```ts
export async function handleAuthError(response: Response): Promise<void> {
  if (response.status !== 401) return;
  if (typeof window === "undefined") return;

  // Limpiar estado del chat antes de redirect (libera streams en vuelo)
  const { useChatSessionsStore } = await import(
    "@/features/chat/store/chatSessionsStore"
  );
  useChatSessionsStore.getState().resetAll();

  const supabase = createClient();
  await supabase.auth.signOut();
  window.location.href = "/login";
}
```

Nota: usamos dynamic import para evitar acoplar el shared/lib con un feature específico en el grafo estático de imports.

- [ ] **Step 2: Typecheck + tests + build**

```bash
cd frontend && npx tsc --noEmit && pnpm test && pnpm build
```

Expected: verde.

- [ ] **Step 3: Commit**

```bash
git add frontend/shared/lib/api-fetch.ts
git commit -m "feat(auth): handleAuthError resets chat sessions store"
```

---

## Task 14: Manual QA — los 4 flujos críticos

**Files:** ninguno (validación manual)

Antes de empezar, asegurarse de tener:
- backend corriendo (`uvicorn` o docker-compose)
- frontend dev server (`pnpm dev`)
- usuario logueado con al menos 2 chats previos

- [ ] **Flujo 1 — Bug original (regresión)**

1. Navegar a `/chat` (vista vacía con welcome).
2. Escribir cualquier mensaje en el input y enviar.
3. **Verificar:** la respuesta del AI aparece streameando sin recargar la página.
4. **Verificar:** el chat nuevo aparece en sidebar con título auto-generado (puede tardar 5-8s).
5. URL: debe ser `/chat/<id>` después de enviar.

- [ ] **Flujo 2 — Refresh / acceso directo a `/chat/[id]`**

1. Estando en un chat con mensajes, presionar F5.
2. **Verificar:** los mensajes (user + AI) cargan.
3. Copiar la URL, abrir nueva pestaña, pegar.
4. **Verificar:** la nueva pestaña muestra los mensajes.

- [ ] **Flujo 3 — Switch entre chats durante stream**

1. Abrir chat A, enviar mensaje que genere respuesta larga (ej. "explicame los 10 trucos de los hooks virales en detalle").
2. Durante el stream, click en chat B desde la sidebar.
3. **Verificar:** chat A muestra dot verde animado en la sidebar.
4. **Verificar:** chat B carga sus mensajes normalmente.
5. Click vuelta en chat A.
6. **Verificar:** el stream sigue (si no terminó) o se ve completo (si terminó).
7. **Verificar:** dot verde desaparece cuando isStreaming pasa a false.

- [ ] **Flujo 4 — Borrar chat activo durante stream**

1. Abrir chat A, enviar mensaje largo.
2. Durante el stream, click en el icono trash de chat A en la sidebar → confirmar "Sí".
3. **Verificar:** redirige a `/chat` (welcome).
4. **Verificar:** chat A desaparece de la sidebar.
5. **Verificar:** sin errores en consola (puede aparecer un AbortError silenciado, normal).

- [ ] **Verificación final automática**

```bash
cd frontend && pnpm test && npx tsc --noEmit && pnpm lint && pnpm build
```

Expected: todo verde.

- [ ] **Si todo OK: nota al sprint doc**

Marcar la tarea correspondiente en `CONTENTSPARK_SAAS_ROADMAP.md` o el sprint doc activo si existe. (Si no hay sección para esto, skipear este step.)

- [ ] **Commit final (si hubo cambios)**

Probablemente este task no requiera commit. Si encontraste algún ajuste menor (ej. un className, un texto), commit ahora:

```bash
git commit -am "chore(chat): post-QA tweaks"
```

---

## Verificación de cierre del refactor

Al terminar todos los tasks, correr:

```bash
cd frontend && pnpm test && npx tsc --noEmit && pnpm lint && pnpm build
```

Y verificar en git:

```bash
git log --oneline -15
```

Esperar ver los 12-13 commits del refactor en orden.
