# Multichat Frontend — Diseño

**Fecha:** 2026-05-16
**Sprint:** MVP Auth + Deployable MVP (sección Multichat / Frontend)
**Estado:** Aprobado, pendiente de plan de implementación

## Contexto

El backend del multichat ya está implementado y cubierto por tests:

- `GET /api/chats` — lista chats del usuario
- `POST /api/chats` — crea chat vacío
- `GET /api/chats/{id}` — chat con mensajes ordenados
- `PATCH /api/chats/{id}` — renombrar / archivar
- `DELETE /api/chats/{id}` — eliminar
- `POST /api/chat` — streaming RAG con persistencia automática de mensajes y autogeneración de título en el primer mensaje (requiere `chat_id` en el body)

El frontend actual:

- `ChatView` solo maneja estado local; no persiste ni hidrata desde DB.
- `streamMessageFromBackend` aún envía `message + history` y no envía `chat_id`.
- `ChatHeader` tiene un dropdown alimentado por `MOCK_CONVERSATIONS`.
- `AppSidebar` tiene un botón "New Chat" que solo navega a `/chat?new=1` y resetea estado local.
- No existe ruta `/chat/[id]`.

## Objetivo

Conectar la UI con el backend persistente de multichat, permitiendo al usuario:

1. Ver una lista de sus chats existentes en un sidebar dedicado y colapsable.
2. Crear un chat nuevo y conversar con persistencia real en DB.
3. Reabrir un chat anterior cargando su historial completo.
4. Borrar chats que ya no necesite.

## Fuera de alcance

- Renombrar chats manualmente (el título se autogenera del primer mensaje).
- Archivar/desarchivar chats.
- Búsqueda dentro de la lista.
- Sincronización en vivo entre pestañas (poll, websockets).
- Renderizado de `sources` persistidos (chips por mensaje) — se mantiene el flujo actual.
- Setup de framework de tests de frontend (Vitest/Playwright). Se usa verificación manual estructurada.

## Decisiones de diseño

| Tema | Decisión | Motivo |
|------|----------|--------|
| Ubicación de la lista de chats | Sidebar dedicado entre `AppSidebar` y el área de chat, colapsable con botón toggle | El usuario lo pidió explícito: tipo ChatGPT, no intrusivo, ocultable |
| Ruteo | `/chat` (sin id, welcome) + `/chat/[id]` (chat específico) | URLs compartibles, refresh seguro, back/forward del navegador funcionan |
| Punto de entrada al chat | Nuevo ítem **"Habla con Spark"** en el `AppSidebar` global. Se elimina el botón "New Chat" actual del `AppSidebar` | Un solo punto de entrada al área de chat; el botón "Nuevo chat" vive dentro del sidebar de chats |
| Creación de chat | **Lazy** en todos los flujos: el chat se crea en backend al enviar el primer mensaje | Cero chats vacíos en DB; un solo camino de creación |
| Vista de `/chat` sin id | Welcome estático actual + input habilitado | El usuario puede empezar a escribir directo o elegir un chat del sidebar |
| Acciones por chat | Solo **borrar** (con confirmación inline al hover) | Mínimo funcional; el título se autogenera y no se edita en este sprint |
| Data fetching | Hooks custom + `fetch` directo, sin SWR/React Query | El proyecto no tiene esas dependencias y el caso de uso es simple |
| Persistencia del estado colapsado del sidebar | `localStorage` (`chat-sidebar-collapsed`) | Default abierto en desktop; preferencia respetada entre sesiones |

## Arquitectura

### Rutas (App Router)

```
app/(app)/chat/
├── layout.tsx        # monta ChatSidebar (colapsable) + <main>
├── page.tsx          # /chat — welcome + input
└── [id]/
    └── page.tsx      # /chat/[id] — carga historial y renderiza mensajes
```

`layout.tsx` envuelve a `page.tsx` y `[id]/page.tsx` con un layout de dos paneles. El `ChatSidebar` queda montado entre navegaciones, evitando recargas innecesarias de la lista al cambiar de chat.

### Layout visual

```
┌──────┬──────────────┬─────────────────────────┐
│ App  │ ChatSidebar  │  ChatView               │
│ Side │ (colapsable) │  (welcome o historial)  │
│ bar  │ + Nuevo chat │                         │
│      │ • Reels      │                         │
│      │ • Hooks      │                         │
└──────┴──────────────┴─────────────────────────┘
```

Cuando el sidebar está colapsado, `ChatView` ocupa todo el ancho disponible.

### Componentes nuevos

- `features/chat/components/ChatSidebar.tsx` — panel colapsable con cabecera ("Chats" + botón "+ Nuevo chat") y lista.
- `features/chat/components/ChatListItem.tsx` — fila con título (o "Sin título"), tiempo relativo, papelera al hover con confirmación inline.
- `features/chat/components/ChatSidebarToggle.tsx` — botón con `PanelLeft` (lucide) que vive en el `ChatHeader` y abre/cierra el sidebar.

### Hooks nuevos

- `features/chat/hooks/useChatList.ts` — encapsula:
  - estado (`chats`, `isLoading`, `error`)
  - fetch inicial al montar
  - `revalidate()` para refresh manual
  - `removeOptimistic(id)` y `rollback()` para el borrado
- `features/chat/hooks/useChatSession.ts` — para `/chat/[id]`:
  - estado (`messages`, `isLoading`, `error`)
  - `getChat(id)` en montaje y cuando cambia `id`
  - mapea `MessageItem[]` del backend a la forma interna `{role, content}` usada por `ChatView`
  - on 404 → `router.replace('/chat')`

Estado del colapso del sidebar: hook local `useSidebarCollapsed()` que persiste en `localStorage` con clave `chat-sidebar-collapsed`. **No se toca** el `SidebarProvider` existente: ése controla el colapso del `AppSidebar` global y debe quedar independiente del sidebar de chats para no acoplar dos contextos distintos.

### Servicios

- `features/chat/services/chats-api.ts` (nuevo) — funciones tipadas:
  ```ts
  listChats(): Promise<ChatListItem[]>
  createChat(): Promise<ChatListItem>
  getChat(id: string): Promise<ChatDetail>
  deleteChat(id: string): Promise<void>
  ```
- `features/chat/services/chat-api.ts` (existente) — re-export delgado; deja de re-exportar `sendMessageToBackend`.
- `shared/lib/api-client.ts` — actualizar `streamMessageFromBackend`:
  - firma nueva: `streamMessageFromBackend(chatId: string, message: string, onChunk)`
  - body: `{ chat_id, message }` (sin `history`)
  - eliminar `sendMessageToBackend` (verificado: no se usa por ningún componente; solo está re-exportado).
- Extraer `getAuthHeaders` y `handleAuthError` a `shared/lib/api-fetch.ts` para que `chats-api.ts` los reutilice sin duplicar.
- `lib/api.ts` legacy: contiene un `sendMessageToBackend` duplicado y no usado. Eliminarlo en este sprint para no dejar código muerto.

### Refactor

**`AppSidebar.tsx`:**
- Agregar entrada en `NAV_ITEMS`: `{ label: "Habla con Spark", href: "/chat", icon: MessageSquare }` (o `Sparkles`).
- Eliminar `handleNewChat` y el bloque del botón "New Chat".

**`ChatView.tsx`:**
- Recibe prop opcional `chatId?: string`.
- Si `chatId`: usa `useChatSession(chatId)` para hidratar `messages`.
- Si no: arranca con welcome y `messages` vacíos.
- `handleSend`:
  - Optimistic push del mensaje del usuario en `messages`.
  - Si no hay `chatId`: `createChat()` → obtener `id` → `router.replace('/chat/${id}')` → `streamMessageFromBackend(id, msg, onChunk)`.
  - Si hay `chatId`: stream directo.
  - Al cierre del stream, si era el primer mensaje (lista actualizada con `title=null`), llamar `revalidate()` del `useChatList` para mostrar el título recién generado.
- Eliminar lógica de `searchParams.get("new")` y `resetChat`.

**`ChatHeader.tsx`:**
- Eliminar dropdown de mensajes y la dependencia de `MOCK_CONVERSATIONS`.
- Añadir `<ChatSidebarToggle />` a la izquierda.
- Mantener botón "Fuentes" a la derecha.

**Archivos a eliminar:**
- `features/chat/components/ConversationsList.tsx` (mock).
- `features/chat/hooks/useChat.ts` (placeholder vacío; también su re-export en `features/chat/index.ts`).
- `frontend/lib/api.ts` (legacy duplicado).

## Contratos de API (frontend ↔ backend)

```ts
// Tipos espejo de los schemas Pydantic
export interface ChatListItem {
  id: string;
  title: string | null;
  is_archived: boolean;
  created_at: string;  // ISO
  updated_at: string;
}
export interface MessageItem {
  id: string;
  role: "user" | "ai";
  content: string;
  sources: unknown[] | null;
  created_at: string;
}
export interface ChatDetail extends ChatListItem {
  messages: MessageItem[];
}
```

| Endpoint backend | Función frontend | Notas |
|------------------|------------------|-------|
| `GET /api/chats` | `listChats()` | Sin filtros; orden viene del backend |
| `POST /api/chats` | `createChat()` | Body vacío; backend devuelve chat con `title=null` |
| `GET /api/chats/{id}` | `getChat(id)` | 404 → redirect a `/chat` |
| `DELETE /api/chats/{id}` | `deleteChat(id)` | 204; optimistic remove en UI |
| `POST /api/chat` | `streamMessageFromBackend(chatId, msg, onChunk)` | Body: `{ chat_id, message }`; streaming `text/event-stream` |

Todas las llamadas usan `getAuthHeaders()` y `handleAuthError()` para el flujo de auth Supabase.

## Data flow

### Enviar mensaje desde `/chat` (sin id)

```
Usuario escribe y envía
  → push optimista {role:"user", content} en UI
  → createChat()
  → router.replace(`/chat/${newId}`)   // mismo layout, no re-monta ChatSidebar
  → streamMessageFromBackend(newId, msg, onChunk)
  → onChunk acumula en último msg "ai"
  → al cerrar stream: revalidate() de useChatList → título nuevo aparece en sidebar
```

### Enviar mensaje desde `/chat/[id]`

```
Usuario escribe y envía
  → push optimista
  → streamMessageFromBackend(id, msg, onChunk)
  → onChunk acumula
  → al cerrar stream: revalidate() solo si era el primer mensaje (title aún null)
```

### Abrir `/chat/[id]`

```
useChatSession(id) en montaje
  → getChat(id) → mapea messages a forma interna
  → si 404 → router.replace('/chat')
  → render mensajes en ChatView
```

### Borrar chat

```
Click papelera → confirmación inline
  → removeOptimistic(id) en useChatList
  → deleteChat(id)
  → si era el chat activo: router.push('/chat')
  → si falla: rollback + mensaje de error inline
```

## Estados de UI

### ChatSidebar

| Estado | UI |
|--------|----|
| Cargando lista | 3 skeletons con animación pulse |
| Vacío | "Aún no tienes conversaciones" + "Empieza escribiendo abajo" |
| Con chats | Lista ordenada por `updated_at` desc; cada ítem con `title || "Sin título"` + tiempo relativo |
| Chat activo | Ítem destacado con `bg-primary/10 text-primary` |
| Colapsado | Panel reducido a ~56px, solo iconos (botón +, ítems como círculos con inicial) |
| Error de carga | "No se pudieron cargar los chats" + botón "Reintentar" |

Tiempos relativos: función local sin dependencias (`hace 5m`, `hace 2h`, `ayer`, `2 may`).

### ChatView

| Estado | UI |
|--------|----|
| `/chat` sin id | Welcome estático + suggested prompts + input habilitado |
| `/chat/[id]` cargando historial | 2-3 burbujas skeleton |
| `/chat/[id]` cargado vacío | Welcome (chat creado pero sin mensajes — edge raro) |
| Streaming | Typing indicator hasta el primer chunk; luego acumulación incremental |
| Error al enviar | Mensaje AI inline con texto de error (patrón actual) |

## Casos borde

- **Mobile (< lg)**: sidebar oculto por defecto, abre como overlay con backdrop al togglear; cierra al elegir chat.
- **Refresh durante streaming**: el usuario pierde el render parcial del AI, pero el backend persiste el buffer; al volver a `/chat/[id]` se ve completo desde DB.
- **Borrar el chat activo**: redirige a `/chat`, no a otro chat.
- **Título aún `null` después del primer send**: mostrar `"Sin título"` hasta el siguiente revalidate (la generación corre antes del stream, llega rápido).
- **Dos pestañas con el mismo usuario**: no se sincroniza en vivo; el usuario verá lista desactualizada hasta que recargue o cree/borre algo. Fuera de alcance.
- **Mensaje del usuario sin respuesta del AI** (error de red mid-stream): el mensaje user queda persistido por backend antes del stream; el AI queda incompleto. Aceptable para MVP.

## Manejo de errores

- `401` en cualquier endpoint: `handleAuthError` ya hace `signOut` + redirect a `/login`.
- `404` al cargar `/chat/[id]`: `router.replace('/chat')`.
- Fallo de red en `createChat`: bloquear el send, mostrar mensaje de error inline en el área de chat.
- Fallo en `deleteChat`: rollback de la lista + toast/mensaje inline.
- Fallo de stream: el último mensaje AI muestra el texto de fallback actual.

## Testing y verificación

El frontend no tiene framework de tests configurado. Para mantenerse en alcance del sprint, se usa verificación manual estructurada.

### Checklist manual (ejecutar con `pnpm dev`)

Flujo principal:
- [ ] Login → click "Habla con Spark" → carga `/chat` con welcome y sidebar a la izquierda.
- [ ] Escribir mensaje en `/chat` → crea chat → URL cambia a `/chat/{id}` sin recargar la vista → streaming funciona.
- [ ] Tras el primer mensaje, el sidebar muestra el chat nuevo con su título autogenerado.
- [ ] Click en otro chat del sidebar → URL cambia → carga historial desde backend.
- [ ] Refresh en `/chat/{id}` → historial completo vuelve a aparecer desde DB.
- [ ] Click "Nuevo chat" dentro del sidebar → navega a `/chat` (welcome).
- [ ] Hover en ítem del sidebar → aparece papelera → click → confirmación inline → borrado optimista.
- [ ] Borrar el chat actualmente abierto → redirige a `/chat`.

Estados:
- [ ] Sin chats: sidebar muestra estado vacío.
- [ ] Colapsar sidebar con el toggle del `ChatHeader` → área de chat ocupa todo el ancho → preferencia persiste tras refresh (localStorage).
- [ ] Mobile (< lg): sidebar oculto por defecto, abre como overlay.
- [ ] Forzar token expirado → cualquier acción redirige a `/login`.
- [ ] Abrir `/chat/{idInexistente}` → redirige a `/chat`.

Verificación de tipos y lint:
- [ ] `pnpm lint` sin errores.
- [ ] `pnpm build` sin errores de tipos.

Backend (smoke):
- [ ] `pytest backend/tests/` sigue verde.

## Criterios de aceptación

- Usuario autenticado ve un nuevo ítem "Habla con Spark" en el menú lateral.
- Al entrar a `/chat`, ve un sidebar de chats colapsable a la izquierda y el área de chat (con welcome) a la derecha.
- Puede enviar un mensaje desde `/chat` sin pasar por "Nuevo chat" y el sistema crea automáticamente el chat, navega a `/chat/{id}` y persiste todo.
- Puede abrir un chat anterior y ver su historial completo cargado desde DB.
- El sidebar muestra el título autogenerado del chat después del primer mensaje.
- Puede borrar chats con confirmación.
- Puede colapsar el sidebar de chats y la preferencia persiste tras refresh.
- `pnpm lint` y `pnpm build` pasan sin errores.
