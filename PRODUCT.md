# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Creadores de contenido en TikTok, Instagram Reels, YouTube Shorts y LinkedIn, de nivel intermedio a avanzado (ya publican contenido y buscan sistematizar y escalar). Geografía inicial: Latinoamérica y España, interfaz en español.

## Product Purpose

ContentSpark centraliza el conocimiento disperso de un creador (guías, cursos, frameworks sobre creación de contenido) en una base RAG consultable, personaliza las respuestas según el perfil del creador (nicho, objetivo, tono, audiencia, frecuencia), y traduce estrategia en calendarios de contenido accionables sincronizados con Google Calendar.

## Positioning

A diferencia de un chatbot genérico de IA o una herramienta de calendarización sin contexto, ContentSpark combina tres piezas que un competidor no podría copiar sin rehacer la base: (1) una base de conocimiento curada e ingerida por el propio usuario (PDFs, URLs) con RAG (CRAG con query rewriting y filtrado por score), (2) un perfil de creador persistente que contextualiza cada respuesta, y (3) un puente directo entre esa estrategia conversacional y un calendario de contenido ejecutable, integrado a Google Calendar vía n8n.

## Operating Context

- Flujo principal: signup/login (Supabase Auth) → onboarding (perfil de creador) → chat RAG conversacional → generación de calendario de contenido → sincronización con Google Calendar/Gmail vía n8n.
- El frontend nunca accede a la base de datos directamente; toda comunicación pasa por el backend FastAPI vía JWT en el header Authorization.
- Interfaz visual: glassmorphism (estilo Apple/Liquid Glass) — fondo con gradiente púrpura/azul/rosa, contenedores `bg-white/10 backdrop-blur-xl`, burbujas de chat diferenciadas usuario/bot.
- Tipografía: Inter (Light 300, Regular 400, Semibold 600).

## Capabilities and Constraints

- Next.js 16 (App Router), React 19, Tailwind CSS 4, TypeScript.
- Auth: Supabase Auth (email/password + Google OAuth), guard de rutas en `frontend/proxy.ts`.
- Chat: streaming de respuestas LLM, Markdown renderizado con react-markdown + remark-gfm, historial multi-chat.
- Onboarding: wizard de perfil de creador (nicho, sub-nicho, objetivo, tono, audiencia, frecuencia, redes sociales).
- Perfil: vista/edición post-onboarding, con guard de "completitud" derivado del perfil.
- Calendario y n8n (Fase 3-4): en desarrollo/pendiente al momento de esta auditoría.
- Idioma: UI y prompts en español; identificadores de código en inglés.

## Brand Commitments

- Nombre: ContentSpark.
- Estética glassmorphism obligatoria como lenguaje visual del producto (no es una decisión abierta a rediseño total).

## Evidence on Hand

- Documentación de arquitectura y roadmap en `CONTENTSPARK_SAAS_PROJECT.md` y `CONTENTSPARK_SAAS_ROADMAP.md`.
- Historial SDD reciente: change `onboarding-profile` (Fase 2: onboarding + perfil) implementado y archivado.
- No hay testimonios, casos de estudio, ni datos de usuarios reales documentados — no inventar métricas ni prueba social.

## Product Principles

- El perfil del creador es la fuente de verdad que personaliza todo (chat, calendario); ninguna feature debe ignorarlo.
- La estrategia y la ejecución están conectadas: cada insight conversacional debe poder aterrizar en el calendario.
- El frontend es una capa delgada: sin lógica de negocio ni acceso a datos fuera del backend FastAPI.
- Español como idioma por defecto de la experiencia, coherente con la geografía objetivo.

## Accessibility & Inclusion

Sin requisito de compliance formal (no WCAG certificado); se aplican buenas prácticas estándar de accesibilidad (contraste, foco visible, semántica, soporte de teclado) como parte de la calidad esperada del producto.
