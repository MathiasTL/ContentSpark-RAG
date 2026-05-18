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

  // Limpiar estado del chat antes de redirect (libera streams en vuelo)
  const { useChatSessionsStore } = await import(
    "@/features/chat/store/chatSessionsStore"
  );
  useChatSessionsStore.getState().resetAll();

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
