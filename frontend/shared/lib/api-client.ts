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
