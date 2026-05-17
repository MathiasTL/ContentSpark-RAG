# Chat Session Architecture — Diseño

**Fecha:** 2026-05-17
**Sprint:** Hardening post-Multichat (fix arquitectónico)
**Estado:** Aprobado, pendiente de plan de implementación

## Contexto

Bug observado: al enviar el primer mensaje desde `/chat` (sin chat creado todavía), se crea el chat en backend (aparece en sidebar con título auto-generado) y se streamea la respuesta del LLM, **pero el usuario nunca ve la respuesta**. La vista se queda en el placeholder de bienvenida. Tras un F5 los mensajes aparecen porque ya están persistidos en DB.

### Causa raíz

En `frontend/features/chat/ChatView.tsx:142-168`:

```ts
if (!activeChatId) {
  const created = await createChat();           // crea chat vacío
  activeChatId = created.id;
  router.replace(`/chat/${activeChatId}`);      // navegación
}
await streamMessageFromBackend(activeChatId, text, (chunk) => {
  setMessages(...);                              // setter de componente desmontado
});
```

`/chat/page.tsx` y `/chat/[id]/page.tsx` son dos archivos de página distintos en el App Router (comparten layout pero el componente `ChatView` vive dentro de `children`). El `router.replace` desmonta la instancia que disparó el send y monta una nueva. El stream que ya está en vuelo apunta al setter de la instancia muerta — los chunks llegan al backend pero los `setMessages` van a un componente que React descartó. La instancia nueva levanta `useChatSession(id)` que llama `getChat(id)` antes de que el POST `/api/chat` haya persistido nada, recibe `messages: []`, setea `showWelcome = true` y nunca se entera del stream.

### Lo que NO es el problema

- Backend (`/api/chat`, `_stream_and_persist`) funciona bien — al final del finally persiste tanto el user msg como el AI msg, por eso un F5 muestra todo.
- Generación de título auto en backend funciona — por eso el chat aparece con título correcto en la sidebar.
- Auth y RAG están sanos.

## Objetivo

Refactor arquitectónico del estado del chat para que **la sesión activa sobreviva las transiciones de ruta**, eliminando la dependencia del ciclo de vida de un componente React específico.

Alcance adicional acordado (lifecycle robusto):

- Streams continúan en background cuando el usuario cambia de chat (no se abortan).
- Cache por `chatId` para reabrir chats sin refetch.
- Indicador "streameando" en la sidebar por chat.
- Errores aislados por sesión (un error en chat A no afecta a B).
- AbortController por sesión para casos legítimos de abort (delete chat, logout).

## Fuera de alcance

- Cancelar generación a mitad (botón "stop").
- Retry de respuestas fallidas.
- Persistencia local optimista (localStorage / IndexedDB).
- Sincronización multi-tab (poll / websockets).
- Generación de título client-side optimista.
- TTL / LRU sobre el cache de sesiones.
- Tests E2E con Playwright (solo unit tests del store).

## Arquitectura

```
frontend/features/chat/
├── store/
│   ├── chatSessionsStore.ts        ← NUEVO. Zustand store (estado + acciones)
│   └── chatSessionsStore.test.ts   ← NUEVO. Vitest unit tests
├── hooks/
│   ├── useChatList.tsx              (sin cambios)
│   ├── useChatSession.ts            ← REFACTOR. Selector sobre el store
│   ├── useChatSession.test.tsx      ← NUEVO. Tests del selector
│   └── useSidebarCollapsed.ts       (sin cambios)
├── services/
│   ├── chats-api.ts                 (sin cambios)
│   ├── chat-stream.ts               ← NUEVO. Stream con AbortSignal
│   └── chat-api.ts                  (sin cambios)
└── ChatView.tsx                     ← REFACTOR. Dumb component
```

### Capas y responsabilidades

| Capa | Responsabilidad |
|---|---|
| Store (Zustand) | Dueño único del estado de sesiones. Vive fuera del árbol React, sobrevive navegación. |
| Services | Funciones puras hacia el backend. `chat-stream.ts` acepta `AbortSignal`. |
| Hooks | Selectores tipados sobre el store. API pública para componentes. |
| Componentes | Dumb. Reciben datos vía hooks, dispatch de acciones. |

### Lo que NO cambia

- Backend (`/api/chat`, `/api/chats/*`).
- `ChatListProvider` (contexto separado para la lista de chats — responsabilidad distinta).
- `chat/layout.tsx` (excepto un componente bridge nuevo, ver flujo 4).
- Tipos públicos: `ChatListItem`, `ChatDetail`, `MessageItem`.

### Por qué Zustand

El store global no se desmonta cuando navegas entre rutas porque es un módulo singleton fuera del árbol React. Esto resuelve el bug raíz por construcción: el estado del stream ya no depende de qué `ChatView` esté montado. Trade-off aceptado: una dependencia nueva (~1KB gzipped).

## Estado y acciones del store

### Tipos

```ts
interface ChatSession {
  chatId: string;
  chat: ChatDetail | null;          // metadata: title, is_archived, dates
  messages: SessionMessage[];        // user + ai
  isLoading: boolean;                // GET /api/chats/[id] en vuelo
  isStreaming: boolean;              // POST /api/chat en vuelo
  hasStartedStreaming: boolean;      // primer chunk no vacío llegó
  error: string | null;
  abortController: AbortController | null;
  requestVersion: number;            // dedupe contra envíos rápidos
}

interface ChatSessionsState {
  sessions: Record<string, ChatSession>;
  activeChatId: string | null;
  pendingNewChat: boolean;           // POST /api/chats en vuelo
}
```

### Acciones

| Acción | Firma | Comportamiento |
|---|---|---|
| `setActiveChat` | `(id \| null) => void` | Solo mueve el puntero. No carga datos. Idempotente. |
| `loadChat` | `(id) => Promise<void>` | `GET /api/chats/[id]`. **No-op silencioso si `sessions[id].isStreaming === true`.** Valida `requestVersion` antes de aplicar resultado. |
| `sendMessage` | `(id \| null, text) => Promise<{ chatId }>` | Si `id` null → `createChat` → set activeChatId. Push user msg optimista. Crea `AbortController`. Kick off `_streamInto` fire-and-forget. Resuelve con `chatId` apenas hay chat creado (no espera al stream). |
| `removeSession` | `(id) => void` | Aborta stream si activo, elimina del map. Si era `activeChatId`, setea a null. |
| `cancelStream` | `(id) => void` | `abortController?.abort()`. Limpia flags. No es error. |
| `resetAll` | `() => void` | Aborta todos los streams. Limpia state. Usado en `handleAuthError`. |
| `setOnChatListShouldRevalidate` | `(cb) => void` | Registra callback para refrescar la sidebar tras eventos relevantes. |

### Selectores (hooks)

```ts
useActiveChatId(): string | null
useChatSession(chatId | null): ChatSession | undefined
useStreamingChatIds(): string[]
useIsPendingNewChat(): boolean
```

Todos usan shallow compare para minimizar re-renders.

### Reglas invariantes

1. Los componentes nunca mutan `messages` directamente. Solo dispatch de acciones.
2. El store nunca toca `router`. La URL es responsabilidad del caller.
3. `loadChat` respeta `isStreaming` (protege el buffer en memoria).
4. Errores son por sesión, no globales.
5. `requestVersion` se incrementa en cada `sendMessage` y filtra chunks viejos.
6. `sendMessage` no espera al stream; resuelve con `chatId` apenas el chat existe.

### Lo que se elimina de `ChatView`

- `useState<Message[]>(messages)`
- `useState<boolean>(isLoading)`
- `useState<boolean>(hasStartedStreaming)`
- `useRef<number>(requestVersionRef)`
- `useRef<boolean>(titleNeedsRefreshRef)`
- `useEffect` que sincroniza `session.messages → messages local`
- `setMessages` exportado por `useChatSession` (ya no se usa)

## Flujos

### Flujo 1 — Primer mensaje en `/chat` (el bug original)

```
1. URL=/chat. ChatView monta con chatId=undefined
2. useEffect → setActiveChat(null)
3. messages=[] → WelcomeMessage
4. Usuario escribe + Send
5. ChatView: const {chatId} = await store.sendMessage(null, text)
     ├─ store: createChat() → {id}                          ~200ms
     ├─ store: sessions[id] = {messages:[userMsg], isStreaming:true}
     ├─ store: activeChatId=id
     ├─ store: kick off _streamInto(id, text)               [background]
     └─ resolve con {chatId:id}
6. ChatView: router.replace(`/chat/${chatId}`)
7. Next.js: desmonta /chat/page.tsx, monta /chat/[id]/page.tsx
8. Nueva ChatView monta con chatId=id
9. useEffect → setActiveChat(id) [idempotente]
10. useChatSession(id) lee del store: userMsg + isStreaming=true
11. Render: userMsg + TypingIndicator
12. Chunks llegan al store en background → re-render
13. Stream termina: isStreaming=false → onChatListShouldRevalidate() refresca título
```

### Flujo 2 — Refresh / acceso directo a `/chat/[id]`

```
1. App carga fresh. Store vacío
2. ChatView monta con chatId=id
3. useEffect → setActiveChat(id)
4. useChatSession(id) → undefined
5. ChatView effect: si no hay sesión → store.loadChat(id)
6. store: sessions[id] = {isLoading:true}
7. getChat(id) → ChatDetail
8. store: sessions[id] = {messages, chat, isLoading:false}
9. Render normal
```

### Flujo 3 — Switch entre chats

```
1. URL=/chat/[A]. sessions[A].isStreaming puede ser true
2. Click chat B → router.push(`/chat/${B}`)
3. ChatView de A desmonta. Stream de A SIGUE en background (store vive)
4. ChatView de B monta
5. setActiveChat(B). Si sessions[B] no existe → loadChat(B). Si existe → skip
6. Sidebar muestra dot "streaming" en A vía useStreamingChatIds()
7. Click vuelta a A → ve el estado actual (en curso o ya completo)
```

### Flujo 4 — Borrar chat

```
1. Usuario borra chat C (sidebar)
2. useChatList.removeChat(C):
     ├─ chatSessionsStore.getState().removeSession(C)
     ├─ deleteChat(C) API
     └─ si activeChatId===C → router.push('/chat')
```

### Sincronización con `useChatList`

| Evento | Acción |
|---|---|
| `sendMessage` creó chat nuevo | Llamar `onChatListShouldRevalidate` |
| Stream completó y era primer mensaje | Llamar `onChatListShouldRevalidate` para refrescar título |
| `removeSession` | Caller (`useChatList.removeChat`) orquesta refresh local |

**Implementación:** el store recibe `onChatListShouldRevalidate` como callback registrable. Un componente `ChatStoreBridge` en `chat/layout.tsx` registra el callback en mount:

```tsx
function ChatStoreBridge() {
  const { revalidate } = useChatList();
  useEffect(() => {
    chatSessionsStore.getState().setOnChatListShouldRevalidate(revalidate);
  }, [revalidate]);
  return null;
}
```

Evita el acople circular store ↔ context.

### Estrategia de URL

- `router.replace('/chat/${id}')` después de crear chat (el `/chat` vacío no es un atrás útil).
- `router.push('/chat/${id}')` al cambiar de chat desde la sidebar (queremos historia).
- `router.push('/chat')` al borrar el chat activo.

Funciona porque el store vive fuera del árbol React: la navegación desmonta/remonta `ChatView` pero la sesión sigue en memoria.

## Manejo de errores

### UX

| Situación | UI |
|---|---|
| Error en `createChat` (sin chat aún) | Banner inline arriba del input en `/chat`. No se navega. Retry libre. |
| `loadChat` 404 | `router.replace('/chat')` (comportamiento actual preservado). |
| `loadChat` red/500 | Card de error en el lugar del welcome + botón "Reintentar". |
| Error en stream **antes** del primer chunk | Banner arriba del input. User msg queda visible. Retry envía el mismo texto. |
| Error en stream **a mitad** | Banner arriba del input. AI msg parcial se preserva. |
| Abort intencional | Sin error visible. |

**No** se inyectan mensajes falsos de AI tipo `"Lo siento, tuve un problema..."` en el array de `messages` — eso polluciona la representación fiel del backend.

### AbortController

Un controller por sesión, recreado en cada `sendMessage`. Se llama `abort()` solo en:

- `removeSession(id)`.
- `cancelStream(id)` (API existe, no se expone UI ahora).
- `resetAll()` (en `handleAuthError`).

**No** se aborta en desmontaje de `ChatView` ni en switch de chats — el stream debe completar para que `_stream_and_persist` persista el AI msg en DB.

### Detección de abort vs error real

```ts
catch (err) {
  if (err instanceof DOMException && err.name === 'AbortError') return;
  set(state => updateSession(state, id, { error: '...' }));
}
```

### `requestVersion` (race protection)

Cada `sendMessage` en un chatId incrementa `sessions[id].requestVersion`. El `onChunk` captura el version del momento y descarta chunks si no coincide. Defensa en profundidad — el botón Send está disabled mientras `isStreaming`, pero protege contra dobles clicks rápidos.

### `loadChat` vs `sendMessage` (race)

Regla dura: `loadChat(id)` es **no-op silencioso** si `sessions[id].isStreaming === true`.

`loadChat` también captura `requestVersion` al inicio y compara antes de aplicar — descarta si cambió mientras la request estaba en vuelo.

### Edge cases catalogados

1. Stream termina vacío → `error: "Sin respuesta del modelo"` si `buffer.length===0 && !hasStartedStreaming`.
2. Token expira durante stream → `handleAuthError` redirige a `/login` y llama `chatSessionsStore.getState().resetAll()`.
3. Borrar chat activo → aborta stream → redirige a `/chat`.
4. Borrar chat no activo durante su stream → aborta su stream, mensajes en DB se borran por cascade.
5. Doble click Send → botón disabled con `isStreaming || pendingNewChat`.
6. Dos pestañas mismo chat → out of scope.
7. Backend mata el stream a mitad → `error: "Conexión interrumpida"`, mensaje parcial preservado.
8. Chat sin título durante stream del primer msg → sidebar muestra placeholder 3-8s, sin invención client-side.

### Cleanup en desmontaje del feature

Si el usuario navega fuera de `/chat` (ej. `/calendar`):

- `chat/layout.tsx` desmonta → `ChatStoreBridge` desregistra el callback.
- **No** se abortan streams: si el usuario vuelve a `/chat`, ve el estado actualizado.

## Testing

### Stack

`vitest`, `@testing-library/react`, `@testing-library/dom`, `jsdom`, `@vitest/coverage-v8`. `vitest.config.ts` con jsdom environment.

### Tests del store (`chatSessionsStore.test.ts`)

| # | Test |
|---|---|
| 1 | `loadChat` hidrata `sessions[id]` desde `getChat` mockeado |
| 2 | `loadChat` es no-op cuando `sessions[id].isStreaming === true` |
| 3 | `loadChat` 404 setea `error` y no llena `messages` |
| 4 | `sendMessage(null, text)` llama `createChat`, devuelve `{chatId}` antes de que termine el stream — **regresión del bug original** |
| 5 | `sendMessage(id, text)` empuja user msg optimista inmediatamente |
| 6 | Chunks del stream se acumulan en `sessions[id].messages` con role 'ai' |
| 7 | `hasStartedStreaming` pasa a true en primer chunk no vacío |
| 8 | Stream termina → `isStreaming=false`, `onChatListShouldRevalidate` se llama si era primer msg |
| 9 | `requestVersion` filtra chunks de un sendMessage abortado por uno nuevo |
| 10 | `removeSession(id)` aborta el stream activo y elimina la sesión |
| 11 | `cancelStream(id)` → AbortError NO setea `error` |
| 12 | `resetAll` limpia todo y aborta cualquier stream activo |
| 13 | Stream falla con error de red → `error` seteado, `isStreaming=false`, mensaje parcial preservado |
| 14 | `setActiveChat` no toca `sessions` (solo mueve puntero) |

### Tests del selector (`useChatSession.test.tsx`)

| # | Test |
|---|---|
| 15 | `useChatSession(id)` retorna sesión cuando existe en store |
| 16 | Cambio en `sessions[id].messages` causa re-render del consumer |
| 17 | Cambio en OTRO chatId NO re-renderiza el consumer (shallow compare) |

**No** tests RTL de `ChatView`/`ChatSidebar`. Son dumb; la lógica está cubierta por los tests del store.

## Plan de migración

Cada paso es un commit verificable que deja el árbol funcional:

```
1. chore(frontend): instalar zustand + vitest + RTL + jsdom
   - package.json, vitest.config.ts, tsconfig actualizado para tests

2. feat(chat): extraer chat-stream service con AbortSignal
   - features/chat/services/chat-stream.ts (NUEVO)
   - shared/lib/api-client.ts: streamMessageFromBackend acepta signal opcional
   - sin cambio funcional en ChatView

3. feat(chat): crear chatSessionsStore + tests
   - features/chat/store/chatSessionsStore.ts (NUEVO)
   - features/chat/store/chatSessionsStore.test.ts (14 tests)
   - Aún nadie lo consume

4. refactor(chat): useChatSession lee del store + tests
   - features/chat/hooks/useChatSession.ts: ahora es selector
   - mantiene shape pública (messages, isLoading, error, chat)
   - elimina setMessages exportado
   - tests 15-17

5. refactor(chat): ChatView consume sendMessage del store
   - Borra useState/useRef innecesarios
   - handleSend pasa a llamar store.sendMessage + router.replace
   - Derivar local `const messages = session?.messages ?? []` para que el caso `chatId=undefined` (sesión inexistente) funcione
   - WelcomeMessage: `messages.length === 0 && !session?.isLoading && !pendingNewChat`

6. feat(chat): ChatStoreBridge en chat/layout.tsx
   - Registra onChatListShouldRevalidate del ChatListProvider en el store

7. feat(chat): coordinar deleteChat con store
   - useChatList.removeChat también llama removeSession(id)
   - Si era activeChatId → setActiveChat(null) + router.push('/chat')

8. feat(chat): indicador 'streaming' en sidebar
   - ChatListItem lee useStreamingChatIds(), muestra dot animado

9. feat(auth): handleAuthError limpia chatSessionsStore
   - shared/lib/api-fetch.ts: en path 401, llamar resetAll antes de redirect

10. chore(chat): manual QA de los 4 flujos
```

### Verificación final

- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` todo verde.
- 4 flujos manuales en browser:
  1. `/chat` → primer mensaje → respuesta aparece sin recargar (regresión del bug original).
  2. `/chat/[id]` → F5 → mensajes cargan.
  3. Streameando en A → switch a B → vuelve a A → ve el stream tal cual.
  4. Borrar chat activo durante stream → redirige a `/chat` sin errores.
