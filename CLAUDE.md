# ContentSpark — Contexto para Claude Code

## Qué es este proyecto
ContentSpark es una plataforma RAG (Retrieval-Augmented Generation) para creadores de contenido. Permite consultar una base de conocimiento propia (PDFs ingestados) y recibir respuestas contextualizadas vía chat.

## Stack técnico

### Backend (Python)
- **Framework:** FastAPI + Uvicorn
- **LLM:** Groq (Llama 3.1 8B) vía LangChain
- **Embeddings:** Google Gemini (`gemini-embedding-001`, 3072 dims) vía LangChain
- **Vector DB:** Qdrant (colección: `contentspark_knowledge`)
- **Orquestación:** LangGraph (grafo CRAG con retrieve → score filter → web fallback)
- **Validación:** Pydantic
- **Directorio:** `backend/`

### Frontend (TypeScript)
- **Framework:** Next.js 16 (App Router)
- **UI:** React 19 + Tailwind CSS 4
- **Markdown:** react-markdown + remark-gfm
- **Componentes:** Radix UI (Scroll Area)
- **Conexión backend:** Fetch API nativa hacia `http://localhost:8000/api/chat`
- **Directorio:** `frontend/`

## Estructura clave
```
backend/
├── main.py                      # Entrada FastAPI, define endpoints
├── ingest_local_data.py         # Pipeline de ingesta de PDFs
├── requirements.txt
├── data/                        # PDFs fuente
└── app/services/
    ├── llm_services.py          # Cliente LLM (Groq)
    ├── embeddings_service.py    # Generación de embeddings (Gemini)
    ├── qdrant_services.py       # Operaciones con Qdrant
    └── rag_service.py           # Orquestación del flujo RAG + LangGraph

frontend/
├── app/                         # App Router pages
├── components/                  # Componentes React
├── lib/api.ts                   # Cliente API hacia backend
└── package.json
```

## Flujo RAG (pipeline actual)
1. Usuario escribe en chat → frontend envía `message` + `history` a `POST /api/chat`
2. Backend recorta historial a los últimos 6 turnos (ventana deslizante)
3. Si hay historial, reescribe el query para que sea autocontenido (query rewriting)
4. Grafo CRAG: busca en Qdrant (top_k=4) → filtra por score threshold → fallback a DuckDuckGo si no hay resultados
5. Construye prompt con contexto recuperado + historial recortado
6. LLM (Groq) genera respuesta en streaming → se retorna al frontend
7. Frontend renderiza respuesta con soporte Markdown

## Variables de entorno (backend/.env)
- `GROQ_API_KEY` — API key de Groq
- `GOOGLE_API_KEY` — API key de Google AI (embeddings)
- `QDRANT_URL` — URL de instancia Qdrant
- `QDRANT_API_KEY` — API key de Qdrant

## Endpoints principales
- `GET /` — Health check
- `POST /api/chat` — Chat RAG (message + history, respuesta en streaming)
- `POST /api/search` — Búsqueda semántica directa
- `POST /api/ingest` — Ingesta manual de texto
- `POST /api/test-llm` — Test de generación de hooks
- `POST /api/test-embedding` — Test de embedding
- `GET /api/sources` — Lista de PDFs disponibles en `data/`

## Convenciones de código

### General
- Comentarios y nombres de variables en español
- Servicios desacoplados en `app/services/` (cada servicio expone una instancia singleton)
- Constantes de configuración al inicio de cada módulo (no hardcodeadas en funciones)

### Backend
- Endpoints async con FastAPI
- Streaming via `StreamingResponse` con `media_type="text/event-stream"`
- Manejo de errores con try/catch + logging a consola con prints descriptivos
- Modelos Pydantic para request/response validation

### Frontend
- Componentes funcionales React con TypeScript
- Client Components con `"use client"` donde se necesite estado
- Estado `messages` como array de `{ role: 'user' | 'ai', content: string }`
- Estado `isLoading` para indicador visual durante procesamiento

## Especificaciones de diseño UI/UX

### Tipografía
- Fuente principal: `Inter` (importada vía `next/font/google` en `layout.tsx`)
- Pesos: Light (300) para textos largos, Regular (400) para UI, Semibold (600) para títulos

### Estética (Glassmorphism / estilo Apple)
- Fondo general: gradiente suave con tonos púrpura, azul y rosa pastel (estilo macOS Sonoma)
- Contenedor principal: `bg-white/10` o `bg-white/20`, `backdrop-blur-xl`, `border border-white/20`, `shadow-2xl`, `rounded-3xl`
- Burbujas usuario (derecha): color sólido azul vibrante (`bg-blue-500 text-white`), esquinas `rounded-2xl rounded-br-none`
- Burbujas bot (izquierda): efecto Liquid Glass (`bg-white/30 backdrop-blur-md text-gray-800 border border-white/40`), esquinas `rounded-2xl rounded-bl-none`
- Input area: integrado sin bordes bruscos, botón de envío resaltado, soporte Enter para enviar

### Comportamiento del chat
- Auto-scroll al último mensaje al recibir respuesta
- Renderizado Markdown en respuestas del asistente (react-markdown + remark-gfm)
- Modal de fuentes ingestadas
- Sidebar para reiniciar conversación
- Diseño responsive (desktop y mobile)

## Prioridades actuales de mejora
1. Backend: mejorar calidad del RAG (chunking semántico, score-based retrieval)
2. Frontend: mejorar UI/UX y agregar features
3. Nuevas features: autenticación, rate limiting, versionado de colecciones
4. DevOps: Docker Compose, CI/CD, deployment
