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

// 2. Define URL for the API endpoint
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

//Ingest of documents from pdfs
export async function getSourcesFromBackend(): Promise<SourcesResponse> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/sources`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Error en el servidor: ${response.status}`);
    }

    const data: SourcesResponse = await response.json();
    return data;

  } catch (error) {
    console.error("Error conectando con ContentSpark:", error);
    return {
      success: false,
      sources: []
    };
  }
}

export async function streamMessageFromBackend(currentMessage: string, chatHistory: Message[], onChunk: (chunk: string) => void): Promise<void> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: currentMessage,
        history: chatHistory,
      }),
    });

    if (!response.ok) {
      throw new Error(`Error en el servidor: ${response.status}`);
    }

    //initialize reader to read the stream of data coming from the backend
    const reader = response.body?.getReader();
    const decoder = new TextDecoder("utf-8");

    //infinite loop to read the stream until it's done, and call onChunk for each new piece of data received
    while (reader) {
      const { value, done } = await reader.read();
      if (done) break;
      //Decode the chunk of data and pass it to the onChunk callback to update the UI in real time
      const chunk = decoder.decode(value, { stream: true });
      onChunk(chunk);
    }

  } catch (error) {
    console.error("Error conectando con ContentSpark:", error);
    onChunk("Lo siento, tuve un problema de conexión con mis servidores. ¿Podemos intentarlo de nuevo?");
  }
}
