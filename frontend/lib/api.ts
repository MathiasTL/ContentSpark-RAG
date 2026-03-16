// 1. Define types for API requests and responses
//This assure type safety when making API calls and handling responses, and also serves as documentation for the expected data structures.
export interface Message {
  role: "user" | "ai";
  content: string;
}

export interface ChatResponse {
  success: boolean;
  response: string;
}

export interface IngestResponse {
  success: boolean;
  message: string;
  chunksAdded?: number;
}

// 2. Define URL for the API endpoint
const BACKEND_URL = "http://localhost:8000";

// 3. Create the service function to send messages to the backend
export async function sendMessageToBackend(currentMessage: string, chatHistory: Message[]): Promise<ChatResponse> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // Empaquetamos el mensaje actual y la memoria histórica exactamente como lo pide FastAPI
      body: JSON.stringify({
        message: currentMessage,
        history: chatHistory,
      }),
    });

    if (!response.ok) {
      throw new Error(`Error en el servidor: ${response.status}`);
    }

    const data: ChatResponse = await response.json();
    return data;
    
  } catch (error) {
    console.error("Error conectando con ContentSpark:", error);
    // Devolvemos un mensaje de error amigable para que la UI no colapse
    return {
      success: false,
      response: "Lo siento, tuve un problema de conexión con mis servidores. ¿Podemos intentarlo de nuevo?"
    };
  }
}

// 4. Función para enviar documentos al backend
export async function ingestDocumentToBackend(file: File): Promise<IngestResponse> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${BACKEND_URL}/api/ingest`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Error en el servidor: ${response.status}`);
    }

    const data: IngestResponse = await response.json();
    return data;

  } catch (error) {
    console.error("Error conectando con ContentSpark:", error);
    return {
      success: false,
      message: "No pude subir el documento. Por favor, inténtalo de nuevo."
    };
  }
}