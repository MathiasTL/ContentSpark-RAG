<p align="center">
  <img src="frontend/public/content_spark_md.png" alt="ContentSpark" width="980" />
</p>

<p align="center">
  Plataforma RAG para creadores de contenido: chat con contexto, recuperación semántica y generación asistida por IA.
</p>

## ContentSpark

ContentSpark es una aplicación full stack para asistir a creadores de contenido con respuestas útiles, estratégicas y contextualizadas a partir de una base de conocimiento propia.

El proyecto combina:
- Frontend en Next.js (interfaz conversacional tipo asistente).
- Backend en FastAPI (orquestación del flujo RAG).
- Vector database en Qdrant (búsqueda semántica).
- LLM en Groq (modelo Llama 3.1 8B).
- Embeddings en Google Gemini.

## Objetivo del proyecto

Permitir que un creador consulte temas de contenido (hooks, ideas, enfoque editorial, etc.) y reciba respuestas basadas en documentos PDF previamente ingestados.

## Stack tecnológico

### Frontend
- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- react-markdown + remark-gfm
- Radix UI Scroll Area

### Backend
- FastAPI + Uvicorn
- Pydantic
- LangChain
- LangChain Groq
- LangChain Google GenAI
- Qdrant (vector store)

## Arquitectura funcional

1. El usuario escribe en el chat desde la UI.
2. El frontend envía mensaje + historial al endpoint de chat del backend.
3. El backend consulta Qdrant para recuperar fragmentos semánticamente relevantes.
4. Se construye un prompt con contexto recuperado + memoria conversacional.
5. El LLM genera una respuesta final.
6. El frontend renderiza la respuesta con soporte Markdown.

## Estructura del repositorio

    ContentSpark/
    ├── backend/
    │   ├── main.py
    │   ├── ingest_local_data.py
    │   ├── requirements.txt
    │   ├── data/
    │   └── app/services/
    │       ├── llm_services.py
    │       ├── embeddings_service.py
    │       ├── qdrant_services.py
    │       └── rag_service.py
    ├── frontend/
    │   ├── app/
    │   ├── components/
    │   ├── lib/api.ts
    │   └── package.json
    └── FRONTEND_SPECS.md

## Requisitos previos

- Python 3.10 o superior
- Node.js 20 o superior
- npm
- Cuenta/API key de Groq
- API key de Google AI
- Instancia Qdrant (Cloud o local) con credenciales

## Variables de entorno (backend)

Crear el archivo backend/.env con:

    GROQ_API_KEY=tu_clave_groq
    GOOGLE_API_KEY=tu_clave_google
    QDRANT_URL=https://tu-instancia-qdrant
    QDRANT_API_KEY=tu_clave_qdrant

## Instalación y ejecución

### 1) Backend

Desde la carpeta backend:

    pip install -r requirements.txt
    uvicorn main:app --reload --host 0.0.0.0 --port 8000

API base en:

    http://localhost:8000

### 2) Frontend

Desde la carpeta frontend:

    npm install
    npm run dev

Aplicación web en:

    http://localhost:3000

## Ingesta de documentos PDF

1. Coloca tus archivos PDF en backend/data.
2. Ejecuta el script de ingesta desde backend:

    python ingest_local_data.py

Este proceso:
- Extrae texto de cada PDF.
- Fragmenta en chunks con solapamiento.
- Genera embeddings.
- Guarda los vectores en la colección contentspark_knowledge de Qdrant.

## Endpoints principales

### Salud
- GET /
- Respuesta: estado online del backend.

### Prueba de generación de hook
- POST /api/test-llm
- Body:

    {
      "topic": "tu tema"
    }

### Prueba de embedding
- POST /api/test-embedding
- Body:

    {
      "text": "texto de prueba"
    }

### Ingesta manual de texto
- POST /api/ingest
- Body:

    {
      "text": "contenido largo...",
      "source": "nombre_fuente"
    }

### Búsqueda semántica
- POST /api/search
- Body:

    {
      "query": "consulta"
    }

### Chat RAG
- POST /api/chat
- Body:

    {
      "message": "pregunta actual",
      "history": [
        { "role": "user", "content": "..." },
        { "role": "ai", "content": "..." }
      ]
    }

### Fuentes disponibles
- GET /api/sources
- Lista los PDF detectados en backend/data.

## Características actuales de UI

- Chat con historial y estado de carga.
- Renderizado Markdown en respuestas del asistente.
- Modal de fuentes ingestadas.
- Sidebar para reiniciar conversación.
- Diseño glassmorphism responsive (desktop y mobile).

## Estado del proyecto

El proyecto está funcional para entorno local de desarrollo:
- Frontend y backend desacoplados.
- Flujo RAG operativo con Qdrant + LLM + embeddings.
- Pipeline de ingesta listo para PDFs curados.

## Próximas mejoras recomendadas

- Versionado de colecciones y fuentes en Qdrant.
- Autenticación y rate limiting en API.
- Pruebas automatizadas (unitarias e integración).
- Docker Compose para levantar stack completo.
- Configuración de CORS por entorno.
