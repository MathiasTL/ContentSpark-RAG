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
