# ContentSpark — Contexto para Claude Code

## Qué es este proyecto
ContentSpark es una plataforma SaaS para creadores de contenido que combina RAG (Retrieval-Augmented Generation), agentes inteligentes y planificación de contenido. Permite a creadores consultar una base de conocimiento curada, recibir respuestas personalizadas según su perfil, y generar calendarios de contenido accionables sincronizados con Google Calendar.

## Documentos de referencia
- `CONTENTSPARK_SAAS_PROJECT.md` — Arquitectura completa, módulos, modelos de datos, decisiones técnicas.
- `CONTENTSPARK_SAAS_ROADMAP.md` — Roadmap de 5 fases con tareas detalladas y prompts para Claude Code.
- Consultar estos documentos antes de implementar cualquier feature nueva.

## Stack técnico

### Frontend (TypeScript)
- **Framework:** Next.js 16 (App Router)
- **UI:** React 19 + Tailwind CSS 4
- **Auth:** Supabase Auth (`@supabase/supabase-js`, `@supabase/ssr`)
- **Markdown:** react-markdown + remark-gfm
- **Componentes:** Radix UI (Scroll Area)
- **Directorio:** `frontend/`
- **Nota:** El frontend NO tiene ORM ni acceso directo a la base de datos. Toda comunicación con la DB pasa por el backend FastAPI.

### Backend (Python)
- **Framework:** FastAPI + Uvicorn
- **ORM:** SQLAlchemy 2.0 (async) + Alembic (migraciones)
- **LLM:** Groq (Llama 3.1 8B) vía LangChain
- **Embeddings:** Google Gemini (`gemini-embedding-001`, 3072 dims)
- **Vector DB:** Qdrant (colección: `contentspark_knowledge`)
- **Agentes:** LangGraph (onboarding, calendario, CRAG)
- **Validación:** Pydantic
- **Directorio:** `backend/`

### Base de datos
- **PostgreSQL** via Supabase (usuarios, perfiles, chats, calendarios)
- **SQLAlchemy 2.0** (modelos, queries async, relaciones)
- **Alembic** (migraciones versionadas)
- **Qdrant Cloud** (vector store para RAG)

### Integraciones
- **n8n** (workflow automation — Google Calendar + Gmail)
- **Supabase Auth** (email/password + Google OAuth)

## Estructura del proyecto
```
ContentSpark/
├── CLAUDE.md
├── CONTENTSPARK_SAAS_PROJECT.md
├── CONTENTSPARK_SAAS_ROADMAP.md
├── docker-compose.yml
├── docker-compose.dev.yml
├── .claude/skills/
│   ├── contentspark-dev/SKILL.md
│   ├── supabase-sqlalchemy/SKILL.md
│   └── langgraph-agents/SKILL.md
├── .github/workflows/
│   ├── ci.yml
│   └── deploy.yml
├── docs/                          # Documentación de diseño (01-07)
├── backend/
│   ├── main.py                    # Solo imports de routers + CORS
│   ├── ingest_data.py
│   ├── requirements.txt
│   ├── alembic.ini                # Configuración de Alembic
│   ├── alembic/                   # Migraciones de base de datos
│   │   ├── env.py
│   │   └── versions/
│   ├── data/
│   └── app/
│       ├── config.py              # Pydantic BaseSettings centralizado
│       ├── database.py            # Engine SQLAlchemy async + SessionLocal
│       ├── dependencies.py        # get_current_user, get_db (Fase 1)
│       ├── core/                  # Configuración base
│       ├── models/                # Modelos SQLAlchemy (user, chat, profile, calendar)
│       │   ├── __init__.py        # Importa todos los modelos + Base
│       │   ├── base.py            # DeclarativeBase compartido
│       │   ├── user.py
│       │   ├── chat.py
│       │   ├── profile.py
│       │   └── calendar.py
│       ├── schemas/               # Validación Pydantic (auth, chat, profile, calendar)
│       ├── services/
│       │   ├── llm_services.py
│       │   ├── embeddings_service.py
│       │   ├── qdrant_services.py
│       │   └── rag_service.py
│       ├── agents/
│       │   ├── shared_state.py    # TypedDicts compartidos entre agentes
│       │   ├── crag_agent.py      # Pipeline CRAG (extraído de rag_service)
│       │   ├── onboarding_agent.py
│       │   └── calendar_agent.py
│       ├── routers/               # Endpoints por módulo
│       │   ├── chat.py            # POST /api/chat (activo)
│       │   ├── ingest.py          # Ingesta + búsqueda + test endpoints (activo)
│       │   ├── auth.py            # Fase 1
│       │   ├── profile.py         # Fase 2
│       │   ├── calendar.py        # Fase 3
│       │   └── webhooks.py        # Fase 4 (n8n callbacks)
│       └── middleware/
│           ├── auth.py            # Verificación de tokens via Supabase (Fase 1)
│           └── rate_limiter.py    # Por tier (Fase 5)
├── tests/                         # pytest
├── frontend/
│   ├── app/                       # Solo routing — cada page importa de features/
│   │   ├── layout.tsx
│   │   ├── page.tsx               # → importa ChatView (temporal, Fase 5: landing)
│   │   ├── (auth)/login/
│   │   ├── (auth)/signup/
│   │   ├── (auth)/callback/       # OAuth callback
│   │   └── (app)/                 # Rutas protegidas
│   │       ├── layout.tsx         # Auth guard (Fase 1)
│   │       ├── chat/[id]/
│   │       ├── onboarding/
│   │       ├── calendar/
│   │       └── profile/
│   ├── features/                  # Módulos autocontenidos por feature
│   │   ├── chat/                  # ChatView + componentes + hooks + types
│   │   ├── auth/                  # Fase 1
│   │   ├── onboarding/            # Fase 2
│   │   ├── calendar/              # Fase 3
│   │   ├── profile/               # Fase 2
│   │   └── landing/               # Fase 5
│   ├── shared/                    # Código compartido entre features
│   │   ├── components/ui/         # Background, scroll-area y futuros
│   │   ├── hooks/                 # useApi
│   │   ├── lib/                   # api-client.ts, supabase.ts, utils.ts
│   │   ├── types/                 # User, ApiResponse
│   │   └── constants/             # NICHES, PLATFORMS, FORMATS
│   └── package.json
└── n8n/workflows/                 # JSON placeholders (Fase 4)
```

## Flujo RAG (pipeline optimizado)
1. Usuario escribe en chat → frontend envía `message` + `history` + JWT a `POST /api/chat`
2. Backend verifica token via Supabase Auth (usando `sb_secret_...`), extrae `user_id`, carga perfil del creador
3. Recorta historial a los últimos 6 turnos (ventana deslizante)
4. Si hay historial, reescribe el query para que sea autocontenido (query rewriting vía LLM)
5. Grafo CRAG: busca en Qdrant (top_k=4) → filtra por score threshold (0.35) → fallback a DuckDuckGo
6. Construye prompt con: contexto RAG + perfil del creador + historial recortado
7. LLM (Groq) genera respuesta en streaming → se retorna al frontend
8. Mensaje se persiste en PostgreSQL (tabla Message) via SQLAlchemy
9. Frontend renderiza respuesta con Markdown

## Pipeline de ingesta (mejorado)
- Soporta PDFs y URLs web con metadata rica
- Chunking semántico: 500 chars, overlap 80, separadores por headers Markdown
- Categorías automáticas: hooks_retencion, estrategia_contenido, plataformas_algoritmos, monetizacion, seo_ai_search, storytelling_copywriting
- CLI: `python ingest_data.py [pdfs|urls|all|url <URL>|stats]`

## Variables de entorno

### Backend (backend/.env)
```
GROQ_API_KEY=...
GOOGLE_API_KEY=...
QDRANT_URL=...
QDRANT_API_KEY=...
SUPABASE_URL=...
SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
DATABASE_URL=postgresql+asyncpg://...
N8N_WEBHOOK_URL=...
```

### Frontend (frontend/.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Notas sobre API keys de Supabase
- `sb_publishable_...` reemplaza a la antigua `anon` key. Segura para el frontend.
- `sb_secret_...` reemplaza a la antigua `service_role` key. Solo en el backend, bypasea RLS.
- Ya NO se necesita `SUPABASE_JWT_SECRET`. El backend verifica tokens de usuario llamando a Supabase Auth con la secret key, no decodificando JWTs manualmente.
- Las keys legacy (`anon` y `service_role` en formato JWT) aún funcionan durante la transición, pero se recomienda usar las nuevas.

## Modelos de datos (SQLAlchemy)
- `User` — id, email, name, avatar_url, onboarding_completed
- `CreatorProfile` — nicho, sub_nicho, objetivo, tono, audiencia, frecuencia
- `SocialAccount` — plataforma, handle, url
- `Chat` — id, user_id, title, is_archived
- `Message` — id, chat_id, role, content, sources
- `ContentCalendar` — id, user_id, frecuencia, período, status
- `ContentEntry` — id, calendar_id, fecha, formato, título, hook, status
- Ver schemas completos en CONTENTSPARK_SAAS_PROJECT.md

## Convenciones de código

### Idioma
- Variables y funciones: inglés
- Comentarios y UI: español
- Prompts de LLM: español
- Archivos Python: snake_case, TypeScript: kebab-case, Componentes: PascalCase

### Backend
- Endpoints nuevos en `backend/app/routers/` (NO en main.py)
- Auth middleware en todo endpoint protegido
- Siempre async/await
- Logging con prints descriptivos
- Modelos Pydantic para validación (schemas/)
- Modelos SQLAlchemy para DB (models/)

### Frontend
- Componentes funcionales con TypeScript
- `"use client"` solo donde se necesite estado
- JWT en Authorization header en cada request al backend
- Estado global mínimo
- NO accede a la base de datos directamente — todo pasa por la API del backend

### Base de datos
- Migración tras cada cambio: `alembic revision --autogenerate -m "descripcion"` + `alembic upgrade head`
- SIEMPRE filtrar queries por user_id
- NUNCA exponer SUPABASE_SERVICE_ROLE_KEY (`sb_secret_...`) en frontend
- Usar async sessions de SQLAlchemy (`AsyncSession`)

### Agentes LangGraph
- StateGraph con TypedDict para estado
- Groq para generación, Gemini solo para embeddings
- Prints de debug en cada nodo

## Diseño UI/UX

### Tipografía
- Inter (Light 300, Regular 400, Semibold 600)

### Estética glassmorphism
- Fondo: gradiente púrpura/azul/rosa
- Contenedores: `bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl`
- Burbujas usuario: `bg-blue-500 text-white rounded-2xl rounded-br-none`
- Burbujas bot: `bg-white/30 backdrop-blur-md rounded-2xl rounded-bl-none`
- Header: barra glass separada arriba del chat
- Input: placeholder "Pregunta sobre tu contenido..."

### Comportamiento
- Auto-scroll, Markdown en respuestas, suggested prompts vacíos
- Typing indicator 3 dots, sidebar multi-chat, responsive

## Estado actual del desarrollo
- Estructura SaaS: reorganizada (features/, shared/, routers/, agents/, schemas/)
- RAG pipeline: optimizado (query rewriting, score filtering, ventana deslizante)
- Ingesta: PDFs + URLs con metadata rica
- Frontend: ChatView en features/chat/, glassmorphism base
- Auth: pendiente (Fase 1)
- Onboarding: pendiente (Fase 2)
- Calendario: pendiente (Fase 3)
- n8n: pendiente (Fase 4)
