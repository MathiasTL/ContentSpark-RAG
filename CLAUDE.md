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
- **ORM:** Prisma Client (queries type-safe desde API routes)
- **Markdown:** react-markdown + remark-gfm
- **Componentes:** Radix UI (Scroll Area)
- **Directorio:** `frontend/`

### Backend (Python)
- **Framework:** FastAPI + Uvicorn
- **LLM:** Groq (Llama 3.1 8B) vía LangChain
- **Embeddings:** Google Gemini (`gemini-embedding-001`, 3072 dims)
- **Vector DB:** Qdrant (colección: `contentspark_knowledge`)
- **Agentes:** LangGraph (onboarding, calendario, CRAG)
- **Validación:** Pydantic
- **Directorio:** `backend/`

### Base de datos
- **PostgreSQL** via Supabase (usuarios, perfiles, chats, calendarios)
- **Prisma ORM** (schema, migrations, type-safe queries)
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
├── .claude/skills/
│   ├── contentspark-dev/SKILL.md
│   ├── supabase-prisma/SKILL.md
│   └── langgraph-agents/SKILL.md
├── backend/
│   ├── main.py
│   ├── ingest_data.py
│   ├── urls_to_ingest.json
│   ├── requirements.txt
│   ├── data/
│   └── app/
│       ├── services/
│       │   ├── llm_services.py
│       │   ├── embeddings_service.py
│       │   ├── qdrant_services.py
│       │   └── rag_service.py
│       ├── agents/
│       │   ├── onboarding_agent.py
│       │   └── calendar_agent.py
│       ├── routers/
│       │   ├── auth.py
│       │   ├── chat.py
│       │   ├── profile.py
│       │   ├── calendar.py
│       │   └── ingest.py
│       └── middleware/
│           └── auth.py
├── frontend/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── signup/
│   │   ├── (app)/
│   │   │   ├── chat/[id]/
│   │   │   ├── onboarding/
│   │   │   ├── calendar/
│   │   │   └── profile/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── chat/
│   │   ├── calendar/
│   │   ├── onboarding/
│   │   └── ui/
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── api.ts
│   │   └── prisma.ts
│   └── prisma/
│       └── schema.prisma
└── n8n/
    └── workflows/
```

## Flujo RAG (pipeline optimizado)
1. Usuario escribe en chat → frontend envía `message` + `history` + JWT a `POST /api/chat`
2. Backend verifica JWT, extrae `user_id`, carga perfil del creador
3. Recorta historial a los últimos 6 turnos (ventana deslizante)
4. Si hay historial, reescribe el query para que sea autocontenido (query rewriting vía LLM)
5. Grafo CRAG: busca en Qdrant (top_k=4) → filtra por score threshold (0.35) → fallback a DuckDuckGo
6. Construye prompt con: contexto RAG + perfil del creador + historial recortado
7. LLM (Groq) genera respuesta en streaming → se retorna al frontend
8. Mensaje se persiste en PostgreSQL (tabla Message)
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
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=postgresql://...
SUPABASE_JWT_SECRET=...
N8N_WEBHOOK_URL=...
```

### Frontend (frontend/.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Modelos de datos (Prisma)
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
- Modelos Pydantic para validación

### Frontend
- Componentes funcionales con TypeScript
- `"use client"` solo donde se necesite estado
- JWT en Authorization header en cada request al backend
- Estado global mínimo

### Base de datos
- Migración tras cada cambio: `npx prisma migrate dev --name descripcion`
- SIEMPRE filtrar queries por user_id
- NUNCA exponer SUPABASE_SERVICE_ROLE_KEY en frontend

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
- RAG pipeline: optimizado (query rewriting, score filtering, ventana deslizante)
- Ingesta: PDFs + URLs con metadata rica
- Frontend: glassmorphism base, pendiente mejoras UI
- Auth: pendiente (Fase 1)
- Onboarding: pendiente (Fase 2)
- Calendario: pendiente (Fase 3)
- n8n: pendiente (Fase 4)
