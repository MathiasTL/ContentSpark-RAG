# Sprint MVP — Auth + Deployable MVP

## Objetivo
Dejar el proyecto listo para deploy con landing page, auth completa (login/signup + OAuth), y multichat funcional.

## Alcance
- Auth completa (frontend + backend)
- Multichat (backend + frontend)
- Landing page
- Preparacion para deploy

## Fuera de alcance
- Onboarding inteligente (Fase 2)
- Calendario de contenido (Fase 3)
- Integracion n8n (Fase 4)

## Checklist por area

### 0) Base y coherencia de datos (Fase 0 pendiente)
- [ ] Implementar modelos SQLAlchemy faltantes: `CreatorProfile` y `SocialAccount`.
- [ ] Verificar que la migracion inicial refleja los modelos finales; crear nueva migracion si aplica.

### 1) Auth completa (Fase 1)

#### Frontend
- [x] Integrar Supabase Auth en login (email/password).
- [x] Integrar Supabase Auth en signup (email/password).
- [x] Implementar Google OAuth (login y signup).
- [x] Implementar callback OAuth y manejo de redireccion.
- [x] Alinear estados de carga y errores con UX.

#### Backend
- [x] Implementar verificacion de token con Supabase Auth (`sb_secret_...`).
- [x] Middleware o dependencia de auth operativa en endpoints protegidos.
- [ ] Definir endpoints de auth si son necesarios para la app (si no, documentar uso directo de Supabase).

### 2) Multichat

#### Backend
- [x] CRUD de chats: crear, listar, obtener con mensajes, renombrar, borrar.
- [x] Persistir mensajes con `chat_id` en DB.
- [x] Generar titulo automatico del chat desde el primer mensaje.

#### Frontend
- [x] Sidebar de chats (titulo + ultima actividad).
- [x] Boton "Nuevo chat" crea chat y navega.
- [x] Abrir chat carga historial desde backend.
- [x] Envio de mensajes incluye `chat_id`.

### 3) Landing page
- [ ] Definir contenido (hero, beneficios, CTA, pricing basico).
- [ ] Implementar landing en `/` enlazando a login/signup.
- [ ] Responsive + estilo consistente con app.

### 4) Preparacion para deploy
- [ ] Variables de entorno completas (frontend y backend).
- [ ] CORS configurado para dominio de frontend.
- [ ] Health check basico.
- [ ] Comandos de build/start verificados.

## Criterios de aceptacion MVP
- Usuario puede registrarse, iniciar sesion y usar Google OAuth.
- Usuario autenticado puede crear multiples chats y navegar entre ellos.
- Mensajes persisten en DB y se cargan por chat.
- Landing page publica con CTA.
- Proyecto deployable con envs configuradas.

## Orden sugerido de ejecucion
1) Auth completa
2) Multichat backend
3) Multichat frontend
4) Landing page
5) Preparacion para deploy

## Notas
- Mantener compatibilidad con el flujo actual de RAG.
- No iniciar Fase 2 hasta cerrar este sprint.
