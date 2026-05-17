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
