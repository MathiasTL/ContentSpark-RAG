# ContentSpark SaaS Development Skill

## Contexto
ContentSpark es un SaaS para creadores de contenido. Usa Next.js 16 + FastAPI + Supabase + Qdrant + LangGraph.

## Reglas de desarrollo

### Backend (Python/FastAPI)
- Todos los endpoints nuevos van en `backend/app/routers/` organizados por módulo.
- Cada router debe usar el auth middleware para extraer `user_id` del JWT.
- Los servicios de negocio van en `backend/app/services/`.
- Los agentes LangGraph van en `backend/app/agents/`.
- Usar async/await en todos los endpoints y servicios.
- Logging con prints descriptivos (emojis + contexto) para debug.
- Modelos Pydantic para request/response validation siempre.
- Variables de entorno se cargan con `python-dotenv` desde `backend/.env`.
- NUNCA hardcodear API keys, URLs de DB, o secrets.

### Frontend (Next.js/TypeScript)
- App Router con carpetas (auth) y (app) para rutas públicas y protegidas.
- Componentes en `frontend/components/` organizados por feature.
- Cliente API en `frontend/lib/api.ts`.
- Cliente Supabase en `frontend/lib/supabase.ts`.
- Estilo: Tailwind CSS 4 con glassmorphism (ver FRONTEND_SPECS en CLAUDE.md).
- Fuente: Inter (Light 300, Regular 400, Semibold 600).
- Todos los componentes interactivos deben ser Client Components ("use client").
- Estado global mínimo: preferir props y composición.

### Base de datos
- Schema definido en Prisma (`prisma/schema.prisma`).
- Cada cambio de schema requiere una migración: `npx prisma migrate dev --name descripcion`.
- Generar client después de cada cambio: `npx prisma generate`.
- Conexión: Supabase PostgreSQL via `DATABASE_URL`.
- RLS (Row Level Security) para protección de datos por usuario.

### Autenticación
- Supabase Auth maneja login/signup/OAuth.
- Frontend: `@supabase/supabase-js` para auth client-side.
- Backend: Verificar JWT en middleware FastAPI, extraer user_id.
- Token se envía como `Authorization: Bearer <token>` en cada request.

### Agentes (LangGraph)
- Cada agente es un StateGraph con TypedDict para el estado.
- Los nodos son funciones Python que leen/escriben al estado.
- Usar LLM de Groq (Llama 3.1 8B) para generación, no Gemini.
- Gemini solo se usa para embeddings.
- Streaming via `astream` de LangChain para respuestas en tiempo real.

### Estructura de archivos al crear features nuevas
```
Para un nuevo módulo "X":
1. Backend:
   - backend/app/routers/x.py        (endpoints)
   - backend/app/services/x_service.py (lógica de negocio)
   - backend/app/agents/x_agent.py    (si tiene agente LangGraph)
2. Frontend:
   - frontend/app/(app)/x/page.tsx    (página principal)
   - frontend/components/x/           (componentes del módulo)
3. DB:
   - Agregar modelo en prisma/schema.prisma
   - Crear migración
```

### Convenciones de código
- Idioma de código: variables y funciones en inglés.
- Idioma de comentarios y UI: español.
- Idioma de prompts de LLM: español (el asistente habla en español).
- Nombrar archivos en snake_case (Python) y kebab-case (TypeScript).
- Componentes React en PascalCase.

### Testing y debug
- Backend: Probar endpoints con curl o Postman primero.
- Frontend: Verificar en navegador con DevTools abierto.
- LangGraph: Usar prints en cada nodo para trazar el flujo.
- Siempre verificar que el servidor de Qdrant está accesible antes de probar RAG.
