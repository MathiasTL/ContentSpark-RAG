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
