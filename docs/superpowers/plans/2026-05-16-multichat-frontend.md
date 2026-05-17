# Multichat Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar la UI del chat con el backend persistente: nuevo item "Habla con Spark" en el menu, sidebar de chats colapsable, ruta `/chat/[id]` con historial cargado desde DB, creacion lazy del chat al primer mensaje y borrado con confirmacion.

**Architecture:** Layout dedicado para `/chat/*` que monta un `ChatSidebar` (colapsable, persistencia en localStorage) y un area de chat. El estado de la lista de chats vive en un `ChatListContext` (Provider en el layout) para que `ChatSidebar` y `ChatView` compartan revalidacion despues del primer mensaje. Hooks custom encapsulan `fetch`: `useChatList` (lista + optimistic delete) y `useChatSession` (historial por id). `ChatView` recibe prop opcional `chatId` y aplica creacion lazy del chat al primer send, navegando con `router.replace` al nuevo `/chat/{id}`. Sin dependencias nuevas: el patron del proyecto es hooks custom + `fetch`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, Supabase JS (auth headers), lucide-react (iconos).

**Spec de referencia:** `docs/superpowers/specs/2026-05-16-multichat-frontend-design.md`.

---

## File Structure

**Frontend — crear:**
- `frontend/shared/lib/api-fetch.ts` — helpers reutilizables (`getAuthHeaders`, `handleAuthError`, `apiFetch` opcional).
- `frontend/features/chat/services/chats-api.ts` — tipos espejo + `listChats`, `createChat`, `getChat`, `deleteChat`.
- `frontend/features/chat/hooks/useSidebarCollapsed.ts` — toggle persistido en `localStorage`.
- `frontend/features/chat/hooks/useChatList.ts` — Context provider + hook con fetch inicial, `revalidate()` y `removeChat()` optimistico.
- `frontend/features/chat/hooks/useChatSession.ts` — carga `getChat(id)` y mapea mensajes para `ChatView`.
- `frontend/features/chat/components/ChatListItem.tsx` — fila con titulo + tiempo relativo + papelera con confirmacion inline.
- `frontend/features/chat/components/ChatSidebar.tsx` — panel colapsable con header (Nuevo chat) + lista.
- `frontend/features/chat/components/ChatSidebarToggle.tsx` — boton `PanelLeft` para abrir/cerrar.
- `frontend/app/(app)/chat/layout.tsx` — monta `ChatListProvider` + `ChatSidebar` + `<main>` para `{children}`.
- `frontend/app/(app)/chat/[id]/page.tsx` — Server component, hace `await params` y pasa `chatId` a `ChatView`.

**Frontend — modificar:**
- `frontend/shared/lib/api-client.ts` — `streamMessageFromBackend(chatId, message, onChunk)` con body `{chat_id, message}` (sin `history`). Eliminar `sendMessageToBackend`.
- `frontend/features/chat/ChatView.tsx` — acepta `chatId?: string`; integra `useChatSession`; `handleSend` con lazy create + `router.replace`; revalidate de la lista despues del primer mensaje; elimina logica de `?new=1`/`resetChat`.
- `frontend/features/chat/components/ChatHeader.tsx` — elimina dropdown mock + dependencia de `MOCK_CONVERSATIONS`; agrega `<ChatSidebarToggle />`.
- `frontend/features/chat/services/chat-api.ts` — quita el re-export de `sendMessageToBackend`.
- `frontend/features/chat/index.ts` — quita `export * from './hooks/useChat'`.
- `frontend/app/(app)/chat/page.tsx` — sigue siendo wrapper, pasa `chatId={undefined}`.
- `frontend/shared/components/layout/AppSidebar.tsx` — agrega item "Habla con Spark" en `NAV_ITEMS`; elimina bloque del boton "New Chat" y `handleNewChat`.

**Frontend — eliminar:**
- `frontend/features/chat/components/ConversationsList.tsx` (mock).
- `frontend/features/chat/hooks/useChat.ts` (placeholder vacio).
- `frontend/lib/api.ts` (legacy duplicado, no usado).

**Backend / docs — modificar:**
- `SPRINT_MVP_AUTH.md` — marcar como completados los items de "Multichat / Frontend".

**Backend — NO tocar.** El contrato ya cubre todos los endpoints requeridos por este plan.

---

## Convenciones

- Componentes con estado o hooks: `"use client"` en la primera linea.
- Componentes de Server Components solo donde no hay estado (las pages de ruta dinamica para hacer `await params`).
- Estilos: mantener glassmorphism existente (`bg-white/...`, `backdrop-blur-2xl`, `border-white/10`, `rounded-3xl`).
- Tipos en frontend siempre espejados a los schemas Pydantic del backend (campos en snake_case porque vienen del JSON).
- Errores no relanzados desde hooks salvo que la UI los necesite mostrar; siempre exponer `error: string | null` en los hooks.
- Imports relativos solo dentro del mismo feature; cross-feature usa alias `@/...`.

---

## Task 1: Helpers de fetch compartidos

**Files:**
- Create: `frontend/shared/lib/api-fetch.ts`

- [ ] **Step 1: Crear `frontend/shared/lib/api-fetch.ts`**

```typescript
import { createClient } from "@/shared/lib/supabase";

export const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function getAuthHeaders(): Promise<Record<string, string>> {
  if (typeof window === "undefined") return {};
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function handleAuthError(response: Response): Promise<void> {
  if (response.status !== 401) return;
  if (typeof window === "undefined") return;
  const supabase = createClient();
  await supabase.auth.signOut();
  window.location.href = "/login";
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...(init.headers ?? {}),
    },
  });
  await handleAuthError(response);
  return response;
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: termina sin errores en `shared/lib/api-fetch.ts` (puede haber pre-existentes en otros archivos — ignorar los que no sean del archivo nuevo).

- [ ] **Step 3: Commit**

```bash
git add frontend/shared/lib/api-fetch.ts
git commit -m "feat(frontend): add shared api-fetch helpers (auth headers, 401 handling, ApiError)"
```

---

## Task 2: Servicio chats-api.ts

**Files:**
- Create: `frontend/features/chat/services/chats-api.ts`

- [ ] **Step 1: Crear `frontend/features/chat/services/chats-api.ts`**

```typescript
import { apiFetch, ApiError } from "@/shared/lib/api-fetch";

export interface ChatListItem {
  id: string;
  title: string | null;
  is_archived: boolean;
  created_at: string;
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

async function ensureOk(response: Response, action: string): Promise<void> {
  if (response.ok) return;
  throw new ApiError(response.status, `${action} fallo con status ${response.status}`);
}

export async function listChats(): Promise<ChatListItem[]> {
  const response = await apiFetch("/api/chats", { method: "GET" });
  await ensureOk(response, "listChats");
  return response.json();
}

export async function createChat(): Promise<ChatListItem> {
  const response = await apiFetch("/api/chats", {
    method: "POST",
    body: JSON.stringify({}),
  });
  await ensureOk(response, "createChat");
  return response.json();
}

export async function getChat(id: string): Promise<ChatDetail> {
  const response = await apiFetch(`/api/chats/${id}`, { method: "GET" });
  await ensureOk(response, "getChat");
  return response.json();
}

export async function deleteChat(id: string): Promise<void> {
  const response = await apiFetch(`/api/chats/${id}`, { method: "DELETE" });
  if (response.status === 204) return;
  await ensureOk(response, "deleteChat");
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: sin errores nuevos en el archivo.

- [ ] **Step 3: Commit**

```bash
git add frontend/features/chat/services/chats-api.ts
git commit -m "feat(chat): add chats-api service (listChats, createChat, getChat, deleteChat)"
```

---

## Task 3: Actualizar streamMessageFromBackend para enviar chat_id

**Files:**
- Modify: `frontend/shared/lib/api-client.ts`

- [ ] **Step 1: Reescribir `frontend/shared/lib/api-client.ts`**

Sobrescribir el archivo entero con:

```typescript
import { apiFetch, BACKEND_URL, getAuthHeaders, handleAuthError } from "@/shared/lib/api-fetch";

export interface Message {
  role: "user" | "ai";
  content: string;
}

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
    const response = await apiFetch("/api/sources", { method: "GET" });
    if (!response.ok) {
      throw new Error(`Error en el servidor: ${response.status}`);
    }
    return (await response.json()) as SourcesResponse;
  } catch (error) {
    console.error("Error conectando con ContentSpark:", error);
    return { success: false, sources: [] };
  }
}

export async function streamMessageFromBackend(
  chatId: string,
  message: string,
  onChunk: (chunk: string) => void,
): Promise<void> {
  try {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${BACKEND_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({ chat_id: chatId, message }),
    });

    await handleAuthError(response);
    if (!response.ok) {
      throw new Error(`Error en el servidor: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder("utf-8");

    while (reader) {
      const { value, done } = await reader.read();
      if (done) break;
      onChunk(decoder.decode(value, { stream: true }));
    }
  } catch (error) {
    console.error("Error conectando con ContentSpark:", error);
    onChunk("Lo siento, tuve un problema de conexion con mis servidores. Podemos intentarlo de nuevo?");
  }
}
```

- [ ] **Step 2: Verificar que no quedan consumidores rotos del API previo**

Run: `cd frontend && grep -rn "sendMessageToBackend" --include="*.ts" --include="*.tsx"`
Expected: solo aparece en `lib/api.ts` (legacy, se elimina en Task 14) y posiblemente en `features/chat/services/chat-api.ts` (se limpia en Task 14). NINGUN componente debe usarlo.

Run: `cd frontend && grep -rn "streamMessageFromBackend" --include="*.ts" --include="*.tsx"`
Expected: aparece en `shared/lib/api-client.ts`, `features/chat/services/chat-api.ts` (re-export), y `features/chat/ChatView.tsx` (con firma vieja — se actualiza en Task 11).

- [ ] **Step 3: Verificar tipos (sera FAIL en ChatView hasta Task 11)**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: errores esperados en `ChatView.tsx` (llamada con firma vieja). Los demas archivos sin errores. **No bloquear el plan por esto** — se resuelve en Task 11.

- [ ] **Step 4: Commit**

```bash
git add frontend/shared/lib/api-client.ts
git commit -m "feat(chat): stream endpoint now requires chat_id and no longer sends history"
```

---

## Task 4: Hook useSidebarCollapsed (localStorage)

**Files:**
- Create: `frontend/features/chat/hooks/useSidebarCollapsed.ts`

- [ ] **Step 1: Crear `frontend/features/chat/hooks/useSidebarCollapsed.ts`**

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "chat-sidebar-collapsed";

export function useSidebarCollapsed(defaultValue = false): {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (value: boolean) => void;
} {
  const [collapsed, setCollapsedState] = useState<boolean>(defaultValue);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw !== null) setCollapsedState(raw === "true");
    } catch {
      // localStorage no disponible — ignorar
    }
  }, []);

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // ignorar
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignorar
      }
      return next;
    });
  }, []);

  return { collapsed, toggle, setCollapsed };
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: sin errores nuevos en `useSidebarCollapsed.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/features/chat/hooks/useSidebarCollapsed.ts
git commit -m "feat(chat): add useSidebarCollapsed hook persisted via localStorage"
```

---

## Task 5: ChatListProvider + useChatList

**Files:**
- Create: `frontend/features/chat/hooks/useChatList.ts`

- [ ] **Step 1: Crear `frontend/features/chat/hooks/useChatList.ts`**

```typescript
"use client";

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  ChatListItem,
  deleteChat as deleteChatApi,
  listChats,
} from "../services/chats-api";

interface ChatListContextValue {
  chats: ChatListItem[];
  isLoading: boolean;
  error: string | null;
  revalidate: () => Promise<void>;
  removeChat: (id: string) => Promise<void>;
}

const ChatListContext = createContext<ChatListContextValue | null>(null);

export function ChatListProvider({ children }: { children: ReactNode }) {
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listChats();
      setChats(data);
    } catch (err) {
      console.error("[ChatList] listChats fallo:", err);
      setError("No se pudieron cargar los chats");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const removeChat = useCallback(
    async (id: string) => {
      const previous = chats;
      setChats((prev) => prev.filter((c) => c.id !== id));
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

  return (
    <ChatListContext.Provider
      value={{ chats, isLoading, error, revalidate: fetchAll, removeChat }}
    >
      {children}
    </ChatListContext.Provider>
  );
}

export function useChatList(): ChatListContextValue {
  const ctx = useContext(ChatListContext);
  if (!ctx) {
    throw new Error("useChatList must be used inside <ChatListProvider>");
  }
  return ctx;
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: sin errores nuevos en `useChatList.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/features/chat/hooks/useChatList.ts
git commit -m "feat(chat): add ChatListProvider with optimistic delete and revalidate"
```

---

## Task 6: Hook useChatSession (cargar historial por id)

**Files:**
- Create: `frontend/features/chat/hooks/useChatSession.ts`

- [ ] **Step 1: Crear `frontend/features/chat/hooks/useChatSession.ts`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError } from "@/shared/lib/api-fetch";
import { ChatDetail, getChat } from "../services/chats-api";

export interface SessionMessage {
  role: "user" | "ai";
  content: string;
}

interface UseChatSessionResult {
  messages: SessionMessage[];
  isLoading: boolean;
  error: string | null;
  setMessages: React.Dispatch<React.SetStateAction<SessionMessage[]>>;
  chat: ChatDetail | null;
}

export function useChatSession(chatId: string | undefined): UseChatSessionResult {
  const router = useRouter();
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [chat, setChat] = useState<ChatDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(chatId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!chatId) {
      setMessages([]);
      setChat(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    getChat(chatId)
      .then((detail) => {
        if (cancelled) return;
        setChat(detail);
        setMessages(
          detail.messages.map((m) => ({ role: m.role, content: m.content })),
        );
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          router.replace("/chat");
          return;
        }
        console.error("[ChatSession] getChat fallo:", err);
        setError("No se pudo cargar el chat");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [chatId, router]);

  return { messages, setMessages, chat, isLoading, error };
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: sin errores nuevos en `useChatSession.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/features/chat/hooks/useChatSession.ts
git commit -m "feat(chat): add useChatSession hook to hydrate messages from backend"
```

---

## Task 7: Componente ChatListItem

**Files:**
- Create: `frontend/features/chat/components/ChatListItem.tsx`

- [ ] **Step 1: Crear `frontend/features/chat/components/ChatListItem.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { Trash2 } from "lucide-react";

interface ChatListItemProps {
  id: string;
  title: string | null;
  updatedAt: string;
  isActive: boolean;
  collapsed: boolean;
  onDelete: (id: string) => Promise<void>;
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < hour) {
    const mins = Math.max(1, Math.floor(diffMs / minute));
    return `hace ${mins}m`;
  }
  if (diffMs < day) {
    return `hace ${Math.floor(diffMs / hour)}h`;
  }
  if (diffMs < 2 * day) {
    return "ayer";
  }
  const months = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic",
  ];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}

export default function ChatListItem({
  id,
  title,
  updatedAt,
  isActive,
  collapsed,
  onDelete,
}: ChatListItemProps) {
  const [confirming, setConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const displayTitle = title?.trim() || "Sin titulo";

  async function handleDelete() {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete(id);
    } catch {
      setIsDeleting(false);
      setConfirming(false);
    }
  }

  if (collapsed) {
    return (
      <Link
        href={`/chat/${id}`}
        title={displayTitle}
        className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
          isActive
            ? "bg-primary/15 text-primary"
            : "bg-white/10 text-on-surface-variant hover:bg-white/30 hover:text-primary"
        }`}
      >
        {displayTitle.charAt(0).toUpperCase()}
      </Link>
    );
  }

  return (
    <div
      className={`group relative flex items-center gap-2 rounded-2xl px-3 py-2 transition-colors ${
        isActive
          ? "bg-primary/10"
          : "hover:bg-white/30"
      }`}
    >
      <Link href={`/chat/${id}`} className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span
            className={`block truncate text-sm ${
              isActive ? "font-semibold text-primary" : "font-light text-on-surface"
            }`}
          >
            {displayTitle}
          </span>
          <span className="shrink-0 text-[10px] text-on-surface-variant/70">
            {formatRelative(updatedAt)}
          </span>
        </div>
      </Link>

      {confirming ? (
        <div className="flex items-center gap-1 text-[11px]">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded-full bg-red-500/20 px-2 py-0.5 text-red-500 hover:bg-red-500/30 disabled:opacity-50"
          >
            {isDeleting ? "..." : "Si"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={isDeleting}
            className="rounded-full bg-white/30 px-2 py-0.5 text-on-surface-variant hover:bg-white/50"
          >
            No
          </button>
        </div>
      ) : (
        <button
          type="button"
          aria-label="Borrar chat"
          onClick={() => setConfirming(true)}
          className="opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Trash2
            size={14}
            strokeWidth={1.5}
            className="text-on-surface-variant hover:text-red-500"
          />
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: sin errores nuevos en `ChatListItem.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/features/chat/components/ChatListItem.tsx
git commit -m "feat(chat): add ChatListItem with relative time and inline delete confirmation"
```

---

## Task 8: ChatSidebar + ChatSidebarToggle

**Files:**
- Create: `frontend/features/chat/components/ChatSidebar.tsx`
- Create: `frontend/features/chat/components/ChatSidebarToggle.tsx`

- [ ] **Step 1: Crear `frontend/features/chat/components/ChatSidebarToggle.tsx`**

```tsx
"use client";

import { PanelLeft, PanelLeftClose } from "lucide-react";
import { useSidebarCollapsed } from "../hooks/useSidebarCollapsed";

export default function ChatSidebarToggle() {
  const { collapsed, toggle } = useSidebarCollapsed();
  const Icon = collapsed ? PanelLeft : PanelLeftClose;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={collapsed ? "Mostrar chats" : "Ocultar chats"}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/20 text-on-surface backdrop-blur-2xl transition-colors hover:bg-white/40"
    >
      <Icon size={18} strokeWidth={1.5} />
    </button>
  );
}
```

> **Nota importante:** `useSidebarCollapsed` mantiene estado independiente por componente. Para que el toggle (en `ChatHeader`) y el sidebar (en `layout.tsx`) compartan estado, ambos leen del mismo `localStorage` y se mantienen sincronizados al re-renderizar. Si en la practica el sincronizado no funciona porque el efecto de `localStorage` corre por separado, **se reemplaza por un Context** (ver Step 4 abajo).

- [ ] **Step 2: Crear `frontend/features/chat/components/ChatSidebar.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";

import { useChatList } from "../hooks/useChatList";
import { useSidebarCollapsed } from "../hooks/useSidebarCollapsed";
import ChatListItem from "./ChatListItem";

export default function ChatSidebar() {
  const { chats, isLoading, error, revalidate, removeChat } = useChatList();
  const { collapsed } = useSidebarCollapsed();
  const router = useRouter();
  const pathname = usePathname();

  const activeId = pathname?.startsWith("/chat/") ? pathname.split("/")[2] : undefined;

  function handleNewChat() {
    router.push("/chat");
  }

  async function handleDelete(id: string) {
    try {
      await removeChat(id);
      if (id === activeId) {
        router.push("/chat");
      }
    } catch {
      // useChatList ya hace rollback; aqui no hacemos nada extra
    }
  }

  return (
    <aside
      className={`hidden h-dvh shrink-0 flex-col border-r border-white/10 bg-white/5 backdrop-blur-xl transition-[width] duration-300 ease-out lg:flex ${
        collapsed ? "w-16 p-2" : "w-72 p-4"
      }`}
    >
      <div className={`mb-4 flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && (
          <h2 className="text-sm font-semibold tracking-tight text-on-surface">Chats</h2>
        )}
        <button
          type="button"
          onClick={handleNewChat}
          aria-label="Nuevo chat"
          className={`liquid-gradient flex items-center justify-center text-white shadow-md shadow-[#6e2ce0]/20 transition-transform hover:scale-105 active:scale-95 ${
            collapsed ? "h-10 w-10 rounded-full" : "h-9 w-9 rounded-full"
          }`}
        >
          <Plus size={16} strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto">
        {isLoading && (
          <div className="space-y-2 px-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded-2xl bg-white/10"
              />
            ))}
          </div>
        )}

        {!isLoading && error && (
          <div className="space-y-2 px-2 py-3 text-xs text-on-surface-variant">
            <p>{error}</p>
            <button
              type="button"
              onClick={revalidate}
              className="rounded-full bg-white/20 px-3 py-1 text-xs hover:bg-white/40"
            >
              Reintentar
            </button>
          </div>
        )}

        {!isLoading && !error && chats.length === 0 && !collapsed && (
          <div className="px-2 py-6 text-center text-xs font-light text-on-surface-variant">
            <p className="mb-1">Aun no tienes conversaciones</p>
            <p className="text-[10px]">Empieza escribiendo abajo</p>
          </div>
        )}

        {!isLoading && !error &&
          chats.map((chat) => (
            <ChatListItem
              key={chat.id}
              id={chat.id}
              title={chat.title}
              updatedAt={chat.updated_at}
              isActive={chat.id === activeId}
              collapsed={collapsed}
              onDelete={handleDelete}
            />
          ))}
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Verificar tipos**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: sin errores nuevos en `ChatSidebar.tsx` o `ChatSidebarToggle.tsx`.

- [ ] **Step 4: Commit**

```bash
git add frontend/features/chat/components/ChatSidebar.tsx frontend/features/chat/components/ChatSidebarToggle.tsx
git commit -m "feat(chat): add ChatSidebar (collapsible list) and ChatSidebarToggle"
```

> Si tras Task 15 (smoke test) el toggle del header **no refresca** el ancho del sidebar (por estado no compartido entre instancias del hook), promover `useSidebarCollapsed` a un Context (`ChatSidebarProvider`) mantenido en `app/(app)/chat/layout.tsx` y reemplazar las llamadas a `useSidebarCollapsed()` por `useChatSidebar()` del provider. El estado sigue persistiendo en `localStorage`; solo se elimina la duplicacion.

---

## Task 9: Refactor de ChatHeader (quitar dropdown mock, agregar toggle)

**Files:**
- Modify: `frontend/features/chat/components/ChatHeader.tsx`

- [ ] **Step 1: Reescribir `frontend/features/chat/components/ChatHeader.tsx`**

Sobrescribir el archivo entero con:

```tsx
"use client";

import { Link2 } from "lucide-react";
import ChatSidebarToggle from "./ChatSidebarToggle";

interface ChatHeaderProps {
  onOpenSources: () => void;
}

export default function ChatHeader({ onOpenSources }: ChatHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 w-full shrink-0 items-center justify-between border-b border-white/10 bg-surface/60 px-8 backdrop-blur-2xl">
      <ChatSidebarToggle />

      <button
        type="button"
        onClick={onOpenSources}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-white/20 px-4 py-2 text-sm font-light text-on-surface backdrop-blur-2xl transition-colors hover:bg-white/40"
      >
        <Link2 size={16} strokeWidth={1.5} />
        Fuentes
      </button>
    </header>
  );
}
```

- [ ] **Step 2: Verificar que ya no se importa MOCK_CONVERSATIONS**

Run: `cd frontend && grep -rn "MOCK_CONVERSATIONS\|ConversationsList" --include="*.ts" --include="*.tsx"`
Expected: solo aparece dentro de `features/chat/components/ConversationsList.tsx` (se elimina en Task 14).

- [ ] **Step 3: Verificar tipos (puede seguir fallando ChatView hasta Task 11)**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: el unico error de ChatHeader esperado es que `ChatView.tsx` le pasa `onNewChat` (prop ya inexistente). Se resuelve en Task 11.

- [ ] **Step 4: Commit**

```bash
git add frontend/features/chat/components/ChatHeader.tsx
git commit -m "refactor(chat): replace mock dropdown in ChatHeader with sidebar toggle"
```

---

## Task 10: Layout app/(app)/chat/layout.tsx

**Files:**
- Create: `frontend/app/(app)/chat/layout.tsx`

- [ ] **Step 1: Crear `frontend/app/(app)/chat/layout.tsx`**

```tsx
import { ChatListProvider } from "@/features/chat/hooks/useChatList";
import ChatSidebar from "@/features/chat/components/ChatSidebar";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChatListProvider>
      <div className="flex h-dvh w-full">
        <ChatSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </ChatListProvider>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: sin errores nuevos. (Persisten los de Task 3 y Task 9 hasta Task 11.)

- [ ] **Step 3: Commit**

```bash
git add frontend/app/\(app\)/chat/layout.tsx
git commit -m "feat(chat): add chat route layout with ChatListProvider and sidebar"
```

---

## Task 11: Refactor de ChatView (lazy create + useChatSession)

**Files:**
- Modify: `frontend/features/chat/ChatView.tsx`

- [ ] **Step 1: Reescribir `frontend/features/chat/ChatView.tsx`**

Sobrescribir el archivo entero con:

```tsx
"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Paperclip, Send, UserCircle2 } from "lucide-react";

import { getSourcesFromBackend, streamMessageFromBackend } from "@/shared/lib/api-client";
import type { Source } from "@/shared/lib/api-client";
import { createChat } from "./services/chats-api";
import { useChatList } from "./hooks/useChatList";
import { useChatSession } from "./hooks/useChatSession";
import ChatHeader from "./components/ChatHeader";
import SourcesModal from "./components/SourcesModal";
import { ScrollArea } from "@/shared/components/ui/scroll-area";

interface ChatViewProps {
  chatId?: string;
}

interface Message {
  role: "user" | "ai";
  content: string;
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
  const session = useChatSession(chatId);
  const { revalidate } = useChatList();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasStartedStreaming, setHasStartedStreaming] = useState(false);
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [isSourcesLoading, setIsSourcesLoading] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const requestVersionRef = useRef(0);
  const titleNeedsRefreshRef = useRef(false);

  useEffect(() => {
    setMessages(session.messages);
  }, [session.messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

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
    if (!text || isLoading) return;

    const requestVersion = ++requestVersionRef.current;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setHasStartedStreaming(false);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setIsLoading(true);

    let activeChatId = chatId;
    const isFirstMessage =
      !chatId || (session.chat?.title === null && session.messages.length === 0);

    try {
      if (!activeChatId) {
        const created = await createChat();
        activeChatId = created.id;
        titleNeedsRefreshRef.current = true;
        router.replace(`/chat/${activeChatId}`);
      } else if (isFirstMessage) {
        titleNeedsRefreshRef.current = true;
      }

      await streamMessageFromBackend(activeChatId, text, (chunk) => {
        if (requestVersion !== requestVersionRef.current) return;
        if (chunk.length > 0) setHasStartedStreaming(true);

        setMessages((prev) => {
          const next = [...prev];
          const lastIndex = next.length - 1;
          if (lastIndex >= 0 && next[lastIndex].role === "ai") {
            next[lastIndex] = {
              ...next[lastIndex],
              content: next[lastIndex].content + chunk,
            };
          } else {
            next.push({ role: "ai", content: chunk });
          }
          return next;
        });
      });
    } catch (err) {
      console.error("[ChatView] handleSend fallo:", err);
      if (requestVersion === requestVersionRef.current) {
        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            content:
              "Lo siento, tuve un problema enviando el mensaje. Intentalo de nuevo.",
          },
        ]);
      }
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setIsLoading(false);
        setHasStartedStreaming(false);
        if (titleNeedsRefreshRef.current) {
          titleNeedsRefreshRef.current = false;
          revalidate();
        }
      }
    }
  }

  function sendMessage() {
    handleSend(input.trim());
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const showWelcome = messages.length === 0 && !session.isLoading;

  return (
    <div className="flex h-dvh w-full">
      <section className="relative flex h-dvh min-w-0 flex-1 flex-col overflow-hidden bg-surface/60 backdrop-blur-sm">
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/10 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-secondary/10 blur-[120px]" />

        <ChatHeader onOpenSources={openSourcesModal} />

        <ScrollArea className="relative z-10 min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]>div]:!flex [&_[data-radix-scroll-area-viewport]>div]:!min-h-full [&_[data-radix-scroll-area-viewport]>div]:!flex-col [&_[data-radix-scroll-area-viewport]>div]:!justify-end">
          <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-end space-y-8 px-12 pt-12 pb-6">
            {session.isLoading && (
              <div className="space-y-6">
                {[0, 1].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-3xl bg-white/10" />
                ))}
              </div>
            )}

            {session.error && (
              <div className="rounded-3xl border border-red-300/30 bg-red-500/10 p-4 text-sm text-red-300">
                {session.error}
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

            {isLoading && !hasStartedStreaming && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="relative z-10 mx-auto w-full max-w-4xl shrink-0 space-y-6 px-12 pb-8">
          {messages.length === 0 && (
            <div className="flex flex-wrap justify-center gap-3">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSend(prompt)}
                  disabled={isLoading}
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
                disabled={isLoading}
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
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                aria-label="Enviar mensaje"
                className="liquid-gradient flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-lg shadow-primary/30 transition-transform hover:scale-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
              >
                {isLoading ? (
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

- [ ] **Step 2: Actualizar `frontend/app/(app)/chat/page.tsx` para no pasar `searchParams`**

Sobrescribir `frontend/app/(app)/chat/page.tsx` con:

```tsx
import { Suspense } from "react";
import { ChatView } from "@/features/chat";

export default function ChatIndexPage() {
  return (
    <Suspense fallback={null}>
      <ChatView />
    </Suspense>
  );
}
```

- [ ] **Step 3: Verificar tipos (debe pasar)**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: sin errores. Si quedan errores, son por consumidores que aun referencien la API vieja — investigar y resolver.

- [ ] **Step 4: Commit**

```bash
git add frontend/features/chat/ChatView.tsx frontend/app/\(app\)/chat/page.tsx
git commit -m "feat(chat): ChatView now hydrates from backend and lazy-creates chat on first send"
```

---

## Task 12: Crear ruta /chat/[id]

**Files:**
- Create: `frontend/app/(app)/chat/[id]/page.tsx`

- [ ] **Step 1: Crear `frontend/app/(app)/chat/[id]/page.tsx`**

```tsx
import { Suspense } from "react";
import { ChatView } from "@/features/chat";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ChatByIdPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <ChatView chatId={id} />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/\(app\)/chat/\[id\]/page.tsx
git commit -m "feat(chat): add /chat/[id] route that passes chatId to ChatView"
```

---

## Task 13: Actualizar AppSidebar (agregar "Habla con Spark", quitar "New Chat")

**Files:**
- Modify: `frontend/shared/components/layout/AppSidebar.tsx`

- [ ] **Step 1: Reescribir `frontend/shared/components/layout/AppSidebar.tsx`**

Sobrescribir el archivo entero con:

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  BarChart3,
  Settings,
  HelpCircle,
  MessageSquare,
} from "lucide-react";
import { createClient } from "@/shared/lib/supabase";
import { useSidebar } from "./SidebarProvider";
import UserMenu from "./UserMenu";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Habla con Spark", href: "/chat", icon: MessageSquare },
  { label: "Creators", href: "/creators", icon: Users },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

export default function AppSidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();
  const [user, setUser] = useState<{
    name: string;
    email?: string;
    avatar?: string;
  } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      const meta = data.user.user_metadata ?? {};
      setUser({
        name:
          meta.full_name ||
          meta.name ||
          data.user.email?.split("@")[0] ||
          "Creator",
        email: data.user.email ?? undefined,
        avatar: meta.avatar_url ?? meta.picture,
      });
    });
  }, []);

  return (
    <aside
      className={`fixed left-0 top-0 z-50 hidden h-screen flex-col justify-between border-r border-white/10 bg-white/5 shadow-[0_40px_60px_rgba(0,0,0,0.04)] backdrop-blur-xl transition-[width] duration-300 ease-out lg:flex ${
        collapsed ? "w-20 p-3" : "w-64 p-6"
      }`}
    >
      <div>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expandir menu" : "Colapsar menu"}
          className={`mb-10 flex w-full items-center gap-3 rounded-2xl px-2 py-1 transition-colors hover:bg-white/5 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl">
            <Image
              src="/only_logo.png"
              alt="ContentSpark"
              width={36}
              height={36}
              priority
              className="h-full w-full object-contain"
            />
          </span>
          {!collapsed && (
            <span className="min-w-0 text-left">
              <span className="block bg-gradient-to-r from-[#6e2ce0] to-[#b08cff] bg-clip-text text-xl font-semibold tracking-tight text-transparent">
                ContentSpark
              </span>
              <span className="mt-0.5 block text-[10px] font-light uppercase tracking-wide text-on-surface-variant">
                Creator Suite
              </span>
            </span>
          )}
        </button>

        <nav className="space-y-2">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={label}
                href={href}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-3 rounded-2xl transition-all duration-200 ${
                  collapsed ? "h-12 justify-center" : "px-4 py-3"
                } ${
                  isActive
                    ? "bg-primary/15 font-semibold text-primary"
                    : "font-light text-on-surface-variant hover:bg-white/30 hover:text-primary"
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2 : 1.5} className="shrink-0" />
                {!collapsed && <span className="text-sm">{label}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="space-y-4">
        <Link
          href="#"
          title={collapsed ? "Soporte" : undefined}
          className={`flex items-center gap-3 rounded-2xl text-on-surface-variant transition-colors hover:bg-white/30 hover:text-primary ${
            collapsed ? "h-12 justify-center" : "px-4 py-3"
          }`}
        >
          <HelpCircle size={18} strokeWidth={1.5} className="shrink-0" />
          {!collapsed && <span className="text-sm font-light">Support</span>}
        </Link>

        <div className="border-t border-white/5 pt-4">
          {user && (
            <UserMenu
              name={user.name}
              email={user.email}
              avatar={user.avatar}
              collapsed={collapsed}
            />
          )}
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/shared/components/layout/AppSidebar.tsx
git commit -m "feat(app): add 'Habla con Spark' nav item and remove standalone New Chat button"
```

---

## Task 14: Cleanup de codigo legacy

**Files:**
- Modify: `frontend/features/chat/services/chat-api.ts`
- Modify: `frontend/features/chat/index.ts`
- Delete: `frontend/features/chat/components/ConversationsList.tsx`
- Delete: `frontend/features/chat/hooks/useChat.ts`
- Delete: `frontend/lib/api.ts`

- [ ] **Step 1: Confirmar que `sendMessageToBackend` no se usa en ningun componente**

Run: `cd frontend && grep -rn "sendMessageToBackend" --include="*.ts" --include="*.tsx"`
Expected: solo aparece en `lib/api.ts`, `features/chat/services/chat-api.ts` y posiblemente algun export. Si aparece en componentes, **detenerse** y revisar; no hay consumidores reales.

- [ ] **Step 2: Reescribir `frontend/features/chat/services/chat-api.ts`**

```typescript
export { streamMessageFromBackend, getSourcesFromBackend } from "@/shared/lib/api-client";
export * from "./chats-api";
```

- [ ] **Step 3: Reescribir `frontend/features/chat/index.ts`**

```typescript
export { default as ChatView } from "./ChatView";
export * from "./types";
```

- [ ] **Step 4: Eliminar archivos**

Run:
```bash
rm frontend/features/chat/components/ConversationsList.tsx
rm frontend/features/chat/hooks/useChat.ts
rm frontend/lib/api.ts
```

- [ ] **Step 5: Verificar que el directorio `frontend/lib/` no queda con archivos huerfanos**

Run: `cd frontend && ls -la lib/ 2>/dev/null`
Expected: solo queda `lib/utils.ts` (que aun se usa).

- [ ] **Step 6: Verificar tipos y lint**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: sin errores.

Run: `cd frontend && pnpm lint`
Expected: sin errores ni warnings (ignorar warnings pre-existentes no relacionados).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore(chat): remove legacy mock conversations, useChat placeholder and lib/api duplicate"
```

---

## Task 15: Verificacion manual end-to-end y actualizar sprint checklist

**Files:**
- Modify: `SPRINT_MVP_AUTH.md`

- [ ] **Step 1: Levantar backend y frontend**

En una terminal: `cd backend && uvicorn main:app --reload`
En otra: `cd frontend && pnpm dev`
Expected: backend en `:8000`, frontend en `:3000` (o el puerto que use Next).

- [ ] **Step 2: Build de produccion (validacion tipos + bundles)**

Run: `cd frontend && pnpm build`
Expected: build verde. Cualquier error de tipos rompe el build.

- [ ] **Step 3: Smoke test del flujo principal**

Login en `http://localhost:3000/login` y luego:

| # | Accion | Resultado esperado |
|---|--------|-------------------|
| 1 | Click "Habla con Spark" en el `AppSidebar` | Carga `/chat` con welcome + sidebar de chats a la izquierda |
| 2 | Escribir "Dame hooks virales" y enviar | Crea chat (POST `/api/chats`), URL cambia a `/chat/{id}` sin recarga, stream funciona |
| 3 | Esperar a que termine el stream | El sidebar muestra el chat nuevo con titulo autogenerado (no "Sin titulo") |
| 4 | Crear otro chat clickeando "+" del sidebar | Navega a `/chat`, welcome visible, input listo |
| 5 | Enviar otro mensaje | Crea segundo chat, sidebar lo muestra |
| 6 | Click en el primer chat del sidebar | URL cambia a `/chat/{idPrimero}`, mensajes del primer chat se cargan desde DB |
| 7 | Refresh (F5) en `/chat/{id}` | Historial completo vuelve a mostrarse desde DB |
| 8 | Hover sobre un chat del sidebar | Aparece icono de papelera |
| 9 | Click en papelera → "Si" | Chat desaparece de la lista (optimistic) |
| 10 | Click en papelera del chat actualmente abierto → "Si" | Chat desaparece del sidebar y la vista redirige a `/chat` |
| 11 | Click en el toggle del header (`PanelLeft`) | Sidebar de chats colapsa a barra de ~64px |
| 12 | Refresh (F5) | Sidebar sigue colapsado (localStorage funciona) |
| 13 | Click toggle de nuevo | Sidebar se expande |

- [ ] **Step 4: Edge cases**

| # | Accion | Resultado esperado |
|---|--------|-------------------|
| 1 | Borrar todos los chats | Sidebar muestra "Aun no tienes conversaciones" |
| 2 | Navegar a `/chat/00000000-0000-0000-0000-000000000000` (id inexistente) | Redirige a `/chat` |
| 3 | Abrir DevTools → Application → Clear `sb-...` access token → enviar mensaje | Redirige a `/login` (401 handling) |

- [ ] **Step 5: Backend smoke (regresion)**

Run: `cd backend && pytest -v`
Expected: PASS — toda la suite de backend sigue verde.

- [ ] **Step 6: Actualizar `SPRINT_MVP_AUTH.md`**

Marcar como completados los items de "Multichat / Frontend":

```markdown
#### Frontend
- [x] Sidebar de chats (titulo + ultima actividad).
- [x] Boton "Nuevo chat" crea chat y navega.
- [x] Abrir chat carga historial desde backend.
- [x] Envio de mensajes incluye `chat_id`.
```

- [ ] **Step 7: Commit final**

```bash
git add SPRINT_MVP_AUTH.md
git commit -m "docs(sprint): mark multichat frontend tasks as done"
```

---

## Criterios de aceptacion

- `pnpm build` y `pnpm lint` pasan sin errores.
- `pytest backend/tests/` sigue verde (sin regresiones).
- Existe el item "Habla con Spark" en el `AppSidebar`; ya no existe el boton "New Chat" en el menu global.
- `/chat` muestra welcome + sidebar de chats colapsable.
- `/chat/{id}` carga el historial del chat desde backend; refresh preserva el contenido.
- Enviar un mensaje desde `/chat` (sin id) crea el chat lazy y navega a `/chat/{id}` sin recarga.
- El sidebar de chats se actualiza con el titulo autogenerado despues del primer mensaje.
- El sidebar de chats puede colapsarse desde el `ChatHeader` y el estado persiste en `localStorage`.
- Borrar un chat es optimistic y, si era el chat activo, redirige a `/chat`.
- 401 redirige a `/login`. 404 en chat inexistente redirige a `/chat`.

## Fuera de scope

- Tests automatizados de frontend (Vitest/Playwright). Sigue verificacion manual.
- Renderizado de `sources` persistidos por mensaje.
- Renombrar/archivar chats desde el sidebar (PATCH del backend queda sin UI por ahora).
- Sincronizacion entre pestanas (websockets, polling).
- Renderizado en mobile como overlay con backdrop completo (se cubre con el sidebar oculto < lg, pero sin overlay especifico — queda como mejora posterior).
