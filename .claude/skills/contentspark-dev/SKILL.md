---
name: contentspark-dev
description: >
  Skill principal para desarrollo de ContentSpark SaaS. Usar siempre que se cree
  o modifique cualquier feature del proyecto: endpoints FastAPI, componentes Next.js,
  agentes LangGraph, servicios RAG, o configuración de Supabase. Contiene convenciones
  de código, estructura de archivos, y reglas de seguridad específicas del proyecto.
---

# ContentSpark SaaS Development Skill

## Contexto
ContentSpark es un SaaS para creadores de contenido. Usa Next.js 16 + FastAPI + Supabase + Qdrant + LangGraph.

## Reglas de desarrollo

### Backend (Python/FastAPI)
- Todos los endpoints nuevos van en `backend/app/routers/` organizados por módulo.
- Cada router debe usar el auth middleware para extraer `user_id` del token verificado.
- Los servicios de negocio van en `backend/app/services/`.
- Los agentes LangGraph van en `backend/app/agents/`.
- Los modelos de base de datos (SQLAlchemy) van en `backend/app/models/`.
- Los schemas de validación (Pydantic) van en `backend/app/schemas/`.
- Usar async/await en todos los endpoints y servicios.
- Logging con prints descriptivos (emojis + contexto) para debug.
- Modelos Pydantic para request/response validation siempre.
- Variables de entorno se cargan con Pydantic BaseSettings desde `backend/app/config.py`.
- NUNCA hardcodear API keys, URLs de DB, o secrets.

### Frontend (Next.js/TypeScript)
- App Router con carpetas `(auth)` y `(app)` para rutas públicas y protegidas.
- Módulos autocontenidos en `frontend/features/` organizados por feature.
- Componentes compartidos en `frontend/shared/components/ui/`.
- Cliente API en `frontend/shared/lib/api-client.ts`.
- Cliente Supabase en `frontend/shared/lib/supabase.ts`.
- Estilo: Tailwind CSS 4 con glassmorphism (ver FRONTEND_SPECS en CLAUDE.md).
- Fuente: Inter (Light 300, Regular 400, Semibold 600).
- Todos los componentes interactivos deben ser Client Components (`"use client"`).
- Estado global mínimo: preferir props y composición.
- El frontend NO accede a la base de datos directamente — todo pasa por la API del backend.

### Base de datos (SQLAlchemy 2.0 + Alembic)
- Modelos SQLAlchemy en `backend/app/models/` (un archivo por dominio: user.py, chat.py, profile.py, calendar.py).
- Base declarativa compartida en `backend/app/models/base.py`.
- Engine async con `asyncpg` configurado en `backend/app/database.py`.
- Cada cambio de schema requiere una migración:
  ```bash
  alembic revision --autogenerate -m "descripcion del cambio"
  alembic upgrade head
  ```
- Conexión: Supabase PostgreSQL via `DATABASE_URL=postgresql+asyncpg://...`.
- Usar `AsyncSession` en todos los endpoints (inyectada via `Depends(get_db)`).
- SIEMPRE filtrar queries por `user_id` del token verificado.

### Autenticación (Supabase Auth + nuevas API keys)
- Supabase Auth maneja login/signup/OAuth.
- Frontend: `@supabase/supabase-js` + `@supabase/ssr` para auth client-side.
- Backend: Verificar token del usuario llamando a Supabase Auth con la secret key (`sb_secret_...`), NO decodificando JWTs manualmente.
- Token se envía como `Authorization: Bearer <token>` en cada request al backend.
- API keys de Supabase (formato nuevo):
  - `sb_publishable_...` → frontend (reemplaza a la antigua `anon` key).
  - `sb_secret_...` → backend solamente (reemplaza a la antigua `service_role` key).
  - Ya NO se usa `SUPABASE_JWT_SECRET`.

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
   - backend/app/routers/x.py          (endpoints)
   - backend/app/schemas/x.py          (validación Pydantic)
   - backend/app/services/x_service.py  (lógica de negocio)
   - backend/app/models/x.py           (modelo SQLAlchemy, si tiene tabla nueva)
   - backend/app/agents/x_agent.py     (si tiene agente LangGraph)
   - Migración: alembic revision --autogenerate -m "add x tables"
2. Frontend:
   - frontend/app/(app)/x/page.tsx     (página — solo routing)
   - frontend/features/x/              (componentes, hooks, types del módulo)
3. DB:
   - Agregar modelo en backend/app/models/x.py
   - Importar en backend/app/models/__init__.py
   - Crear migración con Alembic
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
