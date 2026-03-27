# ContentSpark SaaS — Roadmap de desarrollo

## Resumen de fases

| Fase | Nombre | Duración estimada | Descripción |
|------|--------|-------------------|-------------|
| 0 | Setup de infraestructura | 1 semana | Supabase, Prisma, estructura de proyecto |
| 1 | Auth + multi-chat | 2 semanas | Login/signup, persistencia de chats |
| 2 | Onboarding inteligente | 2 semanas | Agente LangGraph para perfil del creador |
| 3 | Calendario de contenido | 2-3 semanas | Generación AI + UI del calendario |
| 4 | Integración n8n | 1-2 semanas | Google Calendar + Gmail |
| 5 | Pulido y lanzamiento | 1-2 semanas | Testing, landing page, deploy |

**Duración total estimada: 9-12 semanas**

---

## Fase 0 — Setup de infraestructura (Semana 1)

### Objetivos
- Configurar Supabase (proyecto, base de datos, auth).
- Configurar Prisma ORM con los schemas iniciales.
- Reestructurar el proyecto para soportar SaaS.

### Tareas

**0.1 — Crear proyecto en Supabase**
- Crear cuenta/proyecto en supabase.com.
- Obtener las credenciales: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`.
- Habilitar autenticación con email/password y Google OAuth.
- Configurar las URLs de redirect para auth (localhost:3000 para dev).

**0.2 — Configurar Prisma**
- Instalar Prisma en el proyecto: `npm install prisma @prisma/client`.
- Crear `prisma/schema.prisma` con los modelos iniciales:
  - User, CreatorProfile, SocialAccount, Chat, Message.
- Ejecutar primera migración: `npx prisma migrate dev --name init`.
- Generar Prisma Client: `npx prisma generate`.

**0.3 — Reestructurar el proyecto**
```
ContentSpark/
├── backend/
│   ├── main.py
│   ├── app/
│   │   ├── services/          # Servicios existentes (RAG, LLM, etc.)
│   │   ├── agents/            # NUEVO: Agentes LangGraph
│   │   │   ├── onboarding_agent.py
│   │   │   └── calendar_agent.py
│   │   ├── routers/           # NUEVO: Endpoints organizados por módulo
│   │   │   ├── auth.py
│   │   │   ├── chat.py
│   │   │   ├── profile.py
│   │   │   ├── calendar.py
│   │   │   └── ingest.py
│   │   └── middleware/        # NUEVO: Auth middleware
│   │       └── auth.py
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── (auth)/            # NUEVO: Rutas de auth
│   │   │   ├── login/
│   │   │   └── signup/
│   │   ├── (app)/             # NUEVO: App autenticada
│   │   │   ├── chat/[id]/
│   │   │   ├── onboarding/
│   │   │   ├── calendar/
│   │   │   └── profile/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── chat/              # Componentes de chat
│   │   ├── calendar/          # Componentes de calendario
│   │   ├── onboarding/        # Componentes de onboarding
│   │   └── ui/                # Componentes reutilizables
│   ├── lib/
│   │   ├── supabase.ts        # NUEVO: Cliente Supabase
│   │   ├── api.ts             # Cliente API actualizado
│   │   └── prisma.ts          # NUEVO: Prisma client
│   └── prisma/
│       └── schema.prisma
└── n8n/
    └── workflows/             # NUEVO: Exportaciones de workflows n8n
```

**0.4 — Variables de entorno actualizadas**

Backend `.env`:
```
# Existentes
GROQ_API_KEY=...
GOOGLE_API_KEY=...
QDRANT_URL=...
QDRANT_API_KEY=...

# Nuevas
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=postgresql://...
JWT_SECRET=...
N8N_WEBHOOK_URL=...
```

Frontend `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Entregable
- Proyecto reestructurado con Supabase conectado y Prisma configurado.
- Base de datos creada con tablas iniciales.
- Verificar conexión desde backend y frontend.

---

## Fase 1 — Auth + multi-chat (Semanas 2-3)

### Objetivos
- Login y signup funcional.
- Sistema de múltiples chats persistentes.
- Middleware de autenticación en el backend.

### Tareas

**1.1 — Auth en frontend**
- Crear páginas de login y signup con diseño glassmorphism.
- Integrar Supabase Auth client (`@supabase/supabase-js`).
- Implementar flujo de login con email/password.
- Implementar login con Google OAuth.
- Crear middleware de Next.js para proteger rutas autenticadas.
- Redirect: si no autenticado → login. Si autenticado y no onboarded → onboarding.

**1.2 — Auth middleware en backend**
- Crear middleware FastAPI que verifica el JWT de Supabase en cada request.
- Extraer `user_id` del token y pasarlo al endpoint.
- Endpoints públicos: `/`, `/api/test-*`.
- Endpoints protegidos: todo lo demás.

**1.3 — Multi-chat: Backend**
- Crear endpoints CRUD para chats:
  - `POST /api/chats` — Crear nuevo chat.
  - `GET /api/chats` — Listar chats del usuario (ordenados por updated_at).
  - `GET /api/chats/{id}` — Obtener chat con sus mensajes.
  - `DELETE /api/chats/{id}` — Eliminar chat.
  - `PATCH /api/chats/{id}` — Renombrar chat.
- Modificar `POST /api/chat` para recibir `chat_id` y persistir mensajes en DB.
- Auto-generar título del chat basado en el primer mensaje (usando LLM).

**1.4 — Multi-chat: Frontend**
- Rediseñar sidebar para mostrar lista de chats.
- Cada chat muestra: título, fecha de última actividad.
- Botón "Nuevo Chat" crea un chat y navega a él.
- Click en un chat carga su historial desde la DB.
- Implementar las mejoras de UI del documento PROMPT_CLAUDE_CODE_FRONTEND.md.

### Entregable
- Usuario puede registrarse, hacer login, crear múltiples chats y navegar entre ellos.
- Los mensajes persisten en PostgreSQL.

---

## Fase 2 — Onboarding inteligente (Semanas 4-5)

### Objetivos
- Agente LangGraph que guía al usuario para completar su perfil.
- Perfil del creador almacenado y utilizado como contexto en el RAG.

### Tareas

**2.1 — Agente de onboarding (LangGraph)**
- Crear `onboarding_agent.py` con un StateGraph que modela el flujo:
  ```
  greeting → ask_name → ask_socials → ask_niche → ask_goals → 
  ask_frequency → ask_formats → ask_tone → ask_audience → 
  generate_summary → confirm → save_profile
  ```
- Cada nodo:
  - Lee el estado actual (qué ya se recopiló).
  - Genera una pregunta natural usando el LLM.
  - Valida la respuesta del usuario (el LLM determina si es válida).
  - Si es válida, actualiza el estado y avanza al siguiente nodo.
  - Si es ambigua, pide clarificación sin avanzar.
- El nodo `generate_summary` muestra un resumen formateado del perfil.
- El nodo `confirm` espera confirmación del usuario.
- El nodo `save_profile` persiste en PostgreSQL.

**2.2 — Endpoints de perfil**
- `GET /api/profile` — Obtener perfil del creador.
- `PUT /api/profile` — Actualizar perfil manualmente (edición posterior).
- `POST /api/profile/onboarding` — Endpoint de streaming para el agente de onboarding.

**2.3 — UI de onboarding**
- Página `/onboarding` con el mismo estilo de chat pero con el flujo guiado.
- Indicador visual de progreso (steps o barra de progreso sutil).
- Al completar, animación de éxito y redirect al chat principal.

**2.4 — Integración del perfil con RAG**
- Modificar `build_system_prompt` en `rag_service.py` para inyectar el perfil del creador.
- El prompt ahora incluye: nicho, tono, audiencia objetivo, plataformas activas.
- Las respuestas del RAG se personalizan automáticamente.

### Entregable
- Flujo de onboarding funcional con agente conversacional.
- Perfil guardado en DB y utilizado en respuestas del RAG.

---

## Fase 3 — Calendario de contenido (Semanas 6-8)

### Objetivos
- Generar calendarios de contenido personalizados con AI.
- UI de calendario interactiva para visualizar y editar el plan.

### Tareas

**3.1 — Agente de calendario (LangGraph)**
- Crear `calendar_agent.py` con un StateGraph:
  ```
  receive_params → analyze_profile → query_rag → 
  generate_ideas → optimize_distribution → format_calendar
  ```
- El agente recibe: frecuencia deseada, período, distribución de formatos.
- Consulta el RAG para obtener frameworks de contenido relevantes al nicho.
- Genera ideas específicas con título, hook, formato y plataforma.
- Optimiza la distribución (no repetir formatos, variar temas, respetar mejores horarios).

**3.2 — Endpoints de calendario**
- `POST /api/calendar/generate` — Generar nuevo calendario (streaming).
- `GET /api/calendars` — Listar calendarios del usuario.
- `GET /api/calendars/{id}` — Obtener calendario con sus entries.
- `PUT /api/calendars/{id}/entries/{entry_id}` — Editar una entrada.
- `POST /api/calendars/{id}/confirm` — Confirmar calendario (trigger sync).
- `DELETE /api/calendars/{id}` — Eliminar calendario.

**3.3 — UI del calendario**
- Vista semanal y mensual (grid de días).
- Cada día muestra las entries con color por formato (video = azul, carrusel = verde, story = rosa).
- Click en una entry abre modal de edición (título, hook, descripción, status).
- Panel de configuración: selector de frecuencia, distribución de formatos, período.
- Botón "Generar con AI" que llama al agente.
- Drag & drop para mover entries entre días (futuro).

**3.4 — Lógica de recomendación de frecuencia**
- Al seleccionar el nicho, se sugiere automáticamente una frecuencia.
- Se muestra como: "Para tu nicho de [tecnología], te recomendamos [5 posts/semana]".
- El usuario puede ajustar libremente.

### Entregable
- Calendario generado por AI, editable y confirmable.
- UI visual con vista semanal/mensual.

---

## Fase 4 — Integración n8n (Semanas 9-10)

### Objetivos
- Sincronizar calendarios confirmados con Google Calendar.
- Enviar recordatorios diarios por email.

### Tareas

**4.1 — Setup de n8n**
- Instalar n8n (Docker local o n8n Cloud).
- Configurar credenciales de Google (OAuth para Calendar y Gmail).
- Crear webhook endpoints que el backend de ContentSpark llamará.

**4.2 — Workflow: Sync a Google Calendar**
- Trigger: Webhook POST desde ContentSpark backend.
- Input: Array de ContentEntries con fecha, hora, título, descripción.
- Proceso: Loop por cada entry → Create Google Calendar Event.
- Output: Array de event_ids → respuesta al backend para guardar en DB.
- Manejo de errores: Si falla un evento, continuar con los demás y reportar.

**4.3 — Workflow: Recordatorio diario**
- Trigger: Cron node (8:00 AM, zona horaria configurable).
- Proceso:
  1. HTTP Request a ContentSpark API: `GET /api/calendar/today?user_id=...`
  2. Si hay entries para hoy, formatear email HTML con las tareas.
  3. Enviar via Gmail node.
- Template del email: diseño limpio con las tareas del día, hooks sugeridos y links.

**4.4 — Workflow: Resumen semanal**
- Trigger: Cron node (domingos 10:00 AM).
- Proceso similar al diario pero con datos de toda la semana + preview de la siguiente.

**4.5 — Backend: Endpoints para n8n**
- `POST /api/calendar/{id}/sync` — Trigger sync a Google Calendar via n8n webhook.
- `GET /api/calendar/today` — Entries de hoy para un usuario (para el recordatorio).
- `GET /api/calendar/weekly-summary` — Resumen semanal.
- Guardar `google_calendar_event_id` en cada ContentEntry tras el sync.

### Entregable
- Calendario sincronizado con Google Calendar.
- Emails de recordatorio diario y resumen semanal funcionando.

---

## Fase 5 — Pulido y lanzamiento (Semanas 11-12)

### Tareas

**5.1 — Landing page**
- Página pública en `/` con:
  - Hero section explicando ContentSpark.
  - Features principales con capturas de pantalla.
  - Pricing (Free vs Pro).
  - CTA de registro.
- Diseño consistente con el glassmorphism de la app.

**5.2 — Testing**
- Test del flujo completo: registro → onboarding → chat → calendario → sync.
- Test de edge cases: usuario sin perfil, chat vacío, calendario sin entries.
- Test de rate limits de APIs (Gemini, Groq).
- Test responsive (mobile).

**5.3 — Deploy**
- Frontend: Vercel (Next.js natural fit).
- Backend: Railway, Render, o Fly.io.
- n8n: n8n Cloud o VPS con Docker.
- Supabase: ya en cloud.
- Qdrant: ya en cloud.
- Configurar dominio, SSL, CORS por entorno.

**5.4 — Monitoreo**
- Logs estructurados en el backend.
- Alertas de errores (Sentry o similar).
- Métricas básicas: usuarios registrados, chats creados, calendarios generados.

---

## Prioridad de implementación

Si necesitas lanzar un MVP lo más rápido posible, este es el orden de máximo impacto con mínimo esfuerzo:

1. **Auth + multi-chat** (lo mínimo para ser un SaaS).
2. **Onboarding** (diferenciador clave — personalización).
3. **Calendario** (la feature que genera retención).
4. **n8n** (el puente a la vida real del creador).

Cada fase es desplegable independientemente. Puedes lanzar con auth + multi-chat y agregar el resto iterativamente.

---

## Prompts para Claude Code

Para cada fase, puedes usar estos prompts en Claude Code:

### Fase 0
```
Lee el CLAUDE.md. Necesito configurar Supabase Auth y Prisma ORM en el proyecto. 
Crea el schema de Prisma con los modelos User, CreatorProfile, SocialAccount, Chat y Message 
según el documento CONTENTSPARK_SAAS_PROJECT.md. Configura la conexión a Supabase PostgreSQL 
y ejecuta la primera migración.
```

### Fase 1
```
Lee el CLAUDE.md. Implementa autenticación con Supabase Auth en el frontend (login/signup 
con email y Google OAuth). Crea middleware de auth en FastAPI que verifique JWT de Supabase. 
Implementa endpoints CRUD para chats y modifica el sistema de chat actual para soportar 
múltiples conversaciones persistentes en PostgreSQL.
```

### Fase 2
```
Lee el CLAUDE.md. Crea un agente LangGraph en backend/app/agents/onboarding_agent.py 
que guíe al usuario a través de un onboarding conversacional para recopilar su perfil 
de creador (nicho, redes sociales, objetivos, tono, audiencia). El agente debe validar 
respuestas y pedir clarificación cuando sea ambiguo. Al finalizar, guarda el perfil 
en PostgreSQL via Prisma. Modifica el RAG service para inyectar el perfil como contexto.
```

### Fase 3
```
Lee el CLAUDE.md. Crea un agente LangGraph en backend/app/agents/calendar_agent.py 
que genere calendarios de contenido personalizados. Debe consultar el perfil del creador 
y la base RAG, generar ideas con título/hook/formato para cada día según la frecuencia 
elegida, y optimizar la distribución. Crea la UI del calendario con vista semanal/mensual, 
permitiendo editar entries y confirmar el calendario.
```
