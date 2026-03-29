# ContentSpark SaaS — Documento de Proyecto

## Visión general

ContentSpark evoluciona de una herramienta RAG local a una plataforma SaaS completa para creadores de contenido. La plataforma permitirá a creadores profesionales gestionar su estrategia de contenido de forma integral: desde la investigación y planificación hasta la ejecución y distribución, todo asistido por inteligencia artificial contextualizada.

## Problema que resuelve

Los creadores de contenido enfrentan tres problemas recurrentes:

1. **Falta de consistencia:** No tienen un sistema para planificar qué publicar, cuándo y en qué formato. Esto lleva a publicar de forma errática, lo cual perjudica el crecimiento algorítmico.
2. **Pérdida de conocimiento:** Consumen decenas de guías, cursos y frameworks sobre creación de contenido, pero esa información se pierde. No tienen una forma de consultarla cuando la necesitan.
3. **Desconexión entre estrategia y ejecución:** Saben que deben publicar 5 veces por semana, pero no tienen un puente entre esa meta y un calendario accionable con ideas concretas para cada día.

ContentSpark resuelve los tres: centraliza el conocimiento del creador en una base RAG consultable, lo conoce a nivel personal (nicho, objetivos, plataformas) para dar respuestas contextualizadas, y genera calendarios de contenido accionables que se sincronizan directamente con Google Calendar.

## Usuarios objetivo

- Creadores de contenido en TikTok, Instagram Reels, YouTube Shorts y LinkedIn.
- Nivel: Intermedio a avanzado (ya publican contenido pero quieren sistematizar y escalar).
- Geografía inicial: Latinoamérica y España (interfaz en español, contenido bilingüe).

## Stack tecnológico

### Frontend
- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS 4
- Diseño glassmorphism (estilo Apple/Liquid Glass)
- Supabase Auth client (solo para login/signup, NO accede a la DB)

### Backend
- FastAPI + Uvicorn
- Python 3.10+
- SQLAlchemy 2.0 (async) + Alembic (migraciones)

### Base de datos
- **PostgreSQL** via Supabase (usuarios, perfiles, chats, calendarios)
- **SQLAlchemy 2.0** (ORM async nativo de Python — modelos, queries, relaciones)
- **Alembic** (migraciones versionadas con auto-generate)
- **Qdrant** (vector store para RAG — se mantiene)

### IA y agentes
- **LLM:** Groq (Llama 3.1 8B) para generación rápida
- **Embeddings:** Google Gemini (`gemini-embedding-001`, 3072 dims)
- **Agentes:** LangGraph (orquestación del flujo de onboarding y planificación)
- **RAG:** Pipeline CRAG con query rewriting y score-based retrieval

### Integraciones externas
- **n8n** (workflow automation — integración con Gmail y Google Calendar)
- **Supabase Auth** (autenticación con email/password y OAuth con Google)

### Infraestructura
- Supabase (DB + Auth + Storage)
- Qdrant Cloud (vector store)
- n8n Cloud o self-hosted (automaciones)

---

## Arquitectura funcional

### Módulo 1: Autenticación y gestión de usuarios

**Objetivo:** Registro, login y gestión de sesiones.

**Flujo:**
1. Usuario accede a ContentSpark → ve landing page con opción de login/signup.
2. Signup con email/password o Google OAuth (via Supabase Auth).
3. Al registrarse por primera vez, se redirige al flujo de onboarding (Módulo 2).
4. Login retorna JWT que el frontend envía en cada request al backend.

**Modelo de datos:**
```
User
├── id (UUID, PK)
├── email (unique)
├── name
├── avatar_url
├── created_at
├── updated_at
└── onboarding_completed (boolean)
```

**Tecnología:** Supabase Auth + SQLAlchemy ORM en el backend.

---

### Módulo 2: Onboarding inteligente (agente conversacional)

**Objetivo:** Conocer al creador para personalizar toda la experiencia.

**Flujo:**
1. Tras el primer login, se inicia un chat guiado con un agente LangGraph.
2. El agente hace preguntas en orden para recopilar el perfil del creador:
   - Nombre/alias de creador
   - Redes sociales activas (TikTok, Instagram, YouTube, LinkedIn, X)
   - Handles/usernames en cada red
   - Nicho principal (tecnología, fitness, finanzas, educación, lifestyle, etc.)
   - Sub-nicho o especialización
   - Objetivo principal (crecer audiencia, monetizar, educar, marca personal)
   - Frecuencia de publicación actual
   - Frecuencia de publicación deseada
   - Formatos preferidos (video corto, carrusel, stories, largo, podcast)
   - Tono de comunicación (profesional, casual, humorístico, inspiracional)
   - Audiencia objetivo (edad, intereses, nivel)
3. El agente valida las respuestas, pide clarificación si es ambiguo, y al finalizar genera un resumen del perfil.
4. El usuario confirma y el perfil se guarda en PostgreSQL via SQLAlchemy.
5. El perfil se inyecta como contexto adicional en todas las consultas RAG futuras.

**¿Por qué LangGraph y no Google ADK?**

LangGraph es la mejor opción para ContentSpark por varias razones:

- **Ya está en tu stack:** Tu proyecto usa LangChain y LangGraph para el pipeline CRAG actual. Agregar agentes de onboarding es una extensión natural, no un framework nuevo.
- **Control explícito del flujo:** El onboarding tiene un orden específico de preguntas con validaciones. LangGraph permite modelar esto como un grafo con nodos claros (pregunta → validación → siguiente pregunta), algo que ADK haría con abstracciones más opacas.
- **Independencia de proveedor:** LangGraph funciona con cualquier LLM (Groq, OpenAI, Anthropic). ADK está optimizado para Gemini y el ecosistema Google Cloud, lo cual agregaría una dependencia innecesaria.
- **Madurez en producción:** LangGraph tiene la mayor puntuación de production readiness entre los frameworks de agentes, con checkpointing, streaming por nodo y debugging visual via LangGraph Studio.
- **Estado compartido:** El TypedDict de LangGraph permite que el perfil del usuario se construya incrementalmente durante el onboarding, con cada nodo leyendo y escribiendo al mismo estado.

**Modelo de datos:**
```
CreatorProfile
├── id (UUID, PK)
├── user_id (FK → User)
├── display_name
├── bio
├── niche
├── sub_niche
├── primary_goal
├── tone
├── target_audience
├── current_frequency
├── desired_frequency
├── preferred_formats (JSON array)
├── created_at
└── updated_at

SocialAccount
├── id (UUID, PK)
├── profile_id (FK → CreatorProfile)
├── platform (enum: tiktok, instagram, youtube, linkedin, x)
├── handle
├── url
├── follower_count (nullable)
└── added_at
```

---

### Módulo 3: Chat RAG multi-conversación

**Objetivo:** Permitir múltiples conversaciones independientes con el asistente RAG.

**Cambios respecto al sistema actual:**
- Actualmente solo existe un chat que se borra al reiniciar. Ahora cada chat tiene persistencia.
- El usuario puede crear, renombrar y eliminar chats.
- El sidebar muestra la lista de chats con título auto-generado del primer mensaje.
- El contexto del perfil del creador se inyecta automáticamente en cada chat.

**Flujo:**
1. Usuario hace click en "Nuevo Chat" → se crea un registro en DB via SQLAlchemy.
2. Cada mensaje se guarda en DB (user message + AI response).
3. El historial se carga desde DB al abrir un chat existente.
4. El sidebar muestra chats ordenados por última actividad.

**Modelo de datos:**
```
Chat
├── id (UUID, PK)
├── user_id (FK → User)
├── title (auto-generado del primer mensaje)
├── created_at
├── updated_at
└── is_archived (boolean)

Message
├── id (UUID, PK)
├── chat_id (FK → Chat)
├── role (enum: user, ai)
├── content (text)
├── sources (JSON array, nullable — fuentes RAG usadas)
├── created_at
```

---

### Módulo 4: Calendario de contenido inteligente

**Objetivo:** Generar un calendario semanal/mensual de contenido personalizado.

**Flujo:**
1. Usuario accede a la sección "Calendario" desde la navegación principal.
2. Configura parámetros:
   - Frecuencia de publicación: 3, 5 o 7 veces por semana (con recomendación basada en nicho).
   - Distribución de formatos: cuántos videos cortos vs carruseles vs stories.
   - Período: semana actual, próxima semana, o mes completo.
3. Un agente LangGraph genera el calendario:
   - Nodo 1: Analiza el perfil del creador (nicho, tono, audiencia).
   - Nodo 2: Consulta la base RAG para obtener frameworks y tendencias relevantes.
   - Nodo 3: Genera ideas de contenido específicas para cada día con título, formato, hook sugerido y notas.
   - Nodo 4: Optimiza la distribución (no repetir formatos consecutivos, variar temas).
4. El usuario revisa, edita y confirma el calendario.
5. Al confirmar, se sincroniza con Google Calendar via n8n.

**Recomendaciones de frecuencia por nicho (configurables):**
- Tecnología/AI: 5 veces/semana (el nicho se mueve rápido)
- Fitness: 5-7 veces/semana (contenido visual diario)
- Finanzas: 3-5 veces/semana (contenido denso, menos frecuencia)
- Educación: 3-4 veces/semana (calidad sobre cantidad)
- Lifestyle: 5-7 veces/semana (contenido ligero y frecuente)
- Negocios/Emprendimiento: 4-5 veces/semana

**Modelo de datos:**
```
ContentCalendar
├── id (UUID, PK)
├── user_id (FK → User)
├── name
├── start_date
├── end_date
├── frequency (int: posts por semana)
├── status (enum: draft, confirmed, synced)
├── created_at
└── updated_at

ContentEntry
├── id (UUID, PK)
├── calendar_id (FK → ContentCalendar)
├── date
├── time_slot (morning, afternoon, evening)
├── title
├── format (enum: short_video, carousel, story, long_video, post)
├── platform (enum: tiktok, instagram, youtube, linkedin)
├── hook (text, nullable)
├── description (text)
├── status (enum: idea, drafted, recorded, published)
├── google_calendar_event_id (nullable)
├── created_at
└── updated_at
```

---

### Módulo 5: Integración n8n (Gmail + Google Calendar)

**Objetivo:** Sincronizar el calendario de contenido con Google Calendar y enviar recordatorios por email.

**Workflows n8n:**

**Workflow 1 — Sync calendario a Google Calendar:**
- Trigger: Webhook desde ContentSpark backend cuando el usuario confirma un calendario.
- Acción: Para cada ContentEntry, crea un evento en Google Calendar con título, descripción y hora.
- Respuesta: Retorna los event_ids para guardarlos en la DB.

**Workflow 2 — Recordatorio diario por email:**
- Trigger: Cron diario a las 8:00 AM (zona horaria del usuario).
- Acción: Consulta las ContentEntries del día → genera un email con las tareas de contenido del día.
- Envío: Via Gmail API al email del usuario.

**Workflow 3 — Resumen semanal:**
- Trigger: Cron semanal (domingos).
- Acción: Resumen de la semana (publicaciones completadas vs planeadas) + preview de la próxima semana.
- Envío: Via Gmail.

---

## Funcionalidades adicionales sugeridas

### Sugerencia 1: Banco de hooks

Una sección dedicada donde el usuario puede guardar hooks que le gustaron (propios o de la base RAG), organizarlos por categoría, y marcarlos como "usados" para no repetir. Esto convierte ContentSpark en un repositorio personal de ideas reutilizables.

### Sugerencia 2: Análisis de tendencias

Un módulo que periódicamente (via n8n) busca tendencias en DuckDuckGo o Google Trends relacionadas al nicho del creador, las ingesta en la base RAG, y notifica al usuario cuando hay oportunidades de contenido trending.

### Sugerencia 3: Templates de contenido

Plantillas predefinidas para diferentes formatos: scripts de video de 30 segundos, estructura de carrusel de 10 slides, outline de video largo. El usuario selecciona un template y el LLM lo llena con el tema y tono de su perfil.

### Sugerencia 4: Métricas y tracking

Permitir al usuario registrar manualmente las métricas de cada publicación (views, likes, shares, saves) para que el sistema aprenda qué tipo de contenido funciona mejor y ajuste las recomendaciones futuras.

### Sugerencia 5: Exportación de contenido

Exportar el calendario como PDF o CSV, y los scripts/hooks generados como documentos descargables.

### Sugerencia 6: Modo colaboración (futuro)

Permitir que un equipo (editor, camarógrafo, community manager) acceda al calendario del creador y marque el status de cada pieza de contenido.

---

## Modelo de negocio sugerido

### Free tier
- 1 chat activo
- Calendario semanal (máximo 3 posts/semana)
- RAG con base de conocimiento pública (los PDFs que ya tenemos)
- Sin integración Calendar/Gmail

### Pro tier ($9-15/mes)
- Chats ilimitados
- Calendario mensual (hasta 7 posts/semana)
- Integración Google Calendar + recordatorios email
- Base RAG pública + posibilidad de subir sus propios PDFs
- Banco de hooks
- Templates de contenido

### Team tier ($29-49/mes)
- Todo lo de Pro
- Hasta 3 miembros de equipo
- Métricas y tracking
- Análisis de tendencias automatizado
- API access

---

## Decisiones técnicas clave

### ¿Por qué Supabase y no Firebase?
- PostgreSQL es más robusto y flexible que Firestore para queries complejas (calendarios, filtros por fecha, joins entre chats y perfiles).
- Supabase Auth soporta OAuth con Google nativamente.
- Row Level Security (RLS) de Supabase protege los datos por usuario sin lógica extra en el backend.
- Supabase tiene un free tier generoso para MVP.

### ¿Por qué SQLAlchemy y no Prisma?
- **Nativo de Python:** SQLAlchemy es el ORM estándar del ecosistema Python. Como el backend es FastAPI (Python), usar un ORM de Python es lo natural. Prisma está diseñado para TypeScript/JavaScript.
- **Async support maduro:** SQLAlchemy 2.0 tiene soporte async completo con `asyncpg`, ideal para FastAPI que es 100% async.
- **Sin dependencia de Node.js en el backend:** Prisma Client Python requiere Node.js para generar el client, lo cual agrega complejidad innecesaria al backend Python.
- **Alembic para migraciones:** Alembic (de los mismos creadores de SQLAlchemy) soporta auto-generate de migraciones y es el estándar en proyectos Python.
- **El frontend no necesita ORM:** El frontend React/Next.js no accede a la base de datos directamente — toda comunicación pasa por la API del backend. Solo necesita Supabase Auth para login/signup.

### ¿Por qué LangGraph para agentes?
- Ya está en el stack (el CRAG actual usa LangGraph).
- Control explícito del flujo de onboarding y generación de calendario.
- Model-agnostic (funciona con Groq/Llama, no depende de Gemini).
- Mayor madurez en producción que Google ADK.

### ¿Por qué n8n y no desarrollo custom?
- Las integraciones con Gmail y Google Calendar requieren OAuth flows complejos.
- n8n abstrae toda esa complejidad con nodos visuales.
- Permite agregar nuevas integraciones (Notion, Slack, WhatsApp) sin código.
- Self-hosteable o cloud, sin vendor lock-in.

### API Keys de Supabase (formato nuevo)
- **`sb_publishable_...`** (reemplaza a `anon`): Para el frontend. Segura para exponer en el navegador. Sujeta a RLS.
- **`sb_secret_...`** (reemplaza a `service_role`): Solo para el backend. Bypasea RLS, acceso total a la DB.
- Ya NO se necesita `SUPABASE_JWT_SECRET`. El backend verifica tokens de usuario llamando a Supabase Auth con la secret key.
- Las keys legacy (formato JWT) siguen funcionando durante la transición.
