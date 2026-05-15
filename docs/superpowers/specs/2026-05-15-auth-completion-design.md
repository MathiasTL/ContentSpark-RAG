# Auth Completion — Design Spec

**Fecha:** 2026-05-15
**Sprint:** MVP Auth + Deployable
**Alcance:** Cerrar el item "Auth completo" del `SPRINT_MVP_AUTH.md`.

## Contexto

El frontend ya tiene login email/password, signup, Google OAuth, callback con PKCE y `proxy.ts` (Next.js middleware) protegiendo `/chat`, `/onboarding`, `/calendar`, `/profile`. El backend ya tiene `verify_supabase_token` y `get_current_user` operativos. Falta cerrar las piezas que hacen que el flujo end-to-end sea consistente y que el proyecto sea deployable.

## Brechas que cierra este spec

1. `routers/auth.py` esta vacio y no esta registrado en `main.py`.
2. No hay sincronizacion entre `auth.users` (Supabase) y la tabla local `users` — el chat persistira mensajes con FK hacia un user_id inexistente.
3. No hay endpoint `GET /api/auth/me` para que el frontend obtenga el perfil del user autenticado desde la DB local.
4. No hay logout desde la UI.
5. Doble source-of-truth para `onboarding_completed`: `proxy.ts` lee de Supabase `user_metadata`, el modelo `User` tiene una columna duplicada sin usar.
6. `models/profile.py` es un archivo vacio redundante con `creator_profile.py`.
7. `main.py` usa `Base.metadata.create_all` en el `lifespan` — choca con la filosofia Alembic-only del proyecto.
8. `api-client.ts` no maneja 401 (un token expirado deja al user en bucle de errores).

## Decisiones tomadas

| Decision | Eleccion | Razon |
|---|---|---|
| Alcance | A — MVP minimo deployable | Sprint actual prioriza desbloquear multichat, landing y deploy. Forgot password queda fuera. |
| Sync user → DB local | A — Lazy sync en `get_current_user` | Resiliente a edge cases (OAuth, confirm tarde). Sin acoplamiento con frontend. Si el overhead pesa, se cachea con Redis luego. |
| Guard de rutas | Ya existe (`proxy.ts`) | No tocar lo que funciona. |
| Source of truth `onboarding_completed` | C — Solo en Supabase `user_metadata` | El proxy ya lo lee de ahi. Drop columna del modelo `User` evita doble fuente. |
| UI logout | A — Popover en avatar del sidebar | Patron estandar, extensible para Profile/Settings/Theme futuros. |

## Arquitectura

**Frontend** sigue siendo dueno del flujo de auth (Supabase client + PKCE). `proxy.ts` intercepta requests, refresca cookies y maneja redirecciones por `onboarding_completed`. No se modifica.

**Backend** es consumidor de tokens, no emisor. Anade un endpoint minimo bajo `/api/auth` y un lazy sync transparente.

### Source of truth

| Dato | Fuente |
|---|---|
| `email`, `name`, `avatar_url` | Supabase Auth (original); DB local guarda copia para joins |
| `onboarding_completed` | Solo Supabase `user_metadata` |
| Chats, messages, calendars, profile | DB local con FK → `users.id` |

### Diagrama de flujo (signup/login feliz path)

```
User → Supabase Auth (login/signup/OAuth)
     ↓ (cookie session + PKCE)
proxy.ts → refresca cookie, decide redirect por onboarding_completed
     ↓
Frontend monta /chat → fetch backend con Bearer token
     ↓
get_current_user (FastAPI dep):
  1. verify_supabase_token(token) → user object completo
  2. lazy_upsert_user(db, user) → INSERT ... ON CONFLICT DO NOTHING
  3. return user_id
     ↓
Endpoint protegido procede (chat, /me, etc.)
```

## Componentes

### Backend — modificar

- **`app/middleware/auth.py`**: `verify_supabase_token` ahora retorna el objeto user completo de Supabase (no solo `user_id`). Permite al lazy sync usar email/name/avatar sin segunda llamada.
- **`app/dependencies.py`**: `get_current_user` hace lazy upsert en `users` y retorna `user_id`. Firma publica del retorno (`str`) no cambia para no romper consumidores existentes (chat router).
- **`app/routers/auth.py`**: implementar `GET /me`. Prefijo `/api/auth`, tag `auth`.
- **`app/models/user.py`**: drop columna `onboarding_completed`.
- **`app/schemas/auth.py`**: quitar `LoginRequest`, `SignupRequest`, `TokenResponse` (no se usan). Anadir `UserResponse`.
- **`main.py`**: registrar `auth.router`. Eliminar `Base.metadata.create_all` del `lifespan` (Alembic-only).

### Backend — crear

- **`alembic/versions/<id>_drop_users_onboarding_completed.py`**: drop column `users.onboarding_completed`.

### Backend — eliminar

- **`app/models/profile.py`**: archivo vacio redundante con `creator_profile.py`.

### Frontend — modificar

- **`shared/components/layout/AppSidebar.tsx`**: envolver el bloque "avatar + name" en el trigger de `UserMenu`.
- **`shared/lib/api-client.ts`**: helper que captura 401, hace `supabase.auth.signOut()` y redirige a `/login`.

### Frontend — crear

- **`shared/components/ui/Popover.tsx`**: wrapper de `@radix-ui/react-popover` con estilo glassmorphism (`bg-white/30 backdrop-blur-md border-white/20 rounded-2xl`). Generico, sin logica de auth.
- **`shared/components/layout/UserMenu.tsx`**: popover concreto que muestra `{name, email, avatar}` y un item "Cerrar sesion" con la logica `supabase.auth.signOut() → router.push('/login')`.

### Frontend — no tocar

- `proxy.ts`
- `LoginView.tsx`, `SignupView.tsx`, `callback/page.tsx`
- `supabase.ts`, `supabase-server.ts`

## Interfaces

### `GET /api/auth/me`

**Request:** `Authorization: Bearer <jwt>`

**Response 200:**
```json
{
  "user_id": "uuid",
  "email": "creator@example.com",
  "name": "Maria",
  "avatar_url": "https://..."
}
```
`name` y `avatar_url` pueden ser `null`.

**Errores:**
- `401` sin token o token invalido.

No se contempla `404` porque el lazy sync garantiza la fila antes de que el handler de `/me` corra.

### `get_current_user`

- Firma publica: retorna `str` (user_id). Sin cambios para los routers existentes.
- Side effect: garantiza que existe la fila en `users` antes de retornar.

### `UserMenu` (frontend)

Props: `{ name: string, email: string, avatar?: string }`. Renderiza popover con item logout. Maneja `signOut` y `router.push` internamente.

## Flujo de errores

| Donde | Que falla | Que ve el user |
|---|---|---|
| LoginView / SignupView | Supabase error (credenciales, email duplicado) | Banner rojo con `error.message` (ya existe) |
| Callback page | exchange fallido o tokens missing | "No pudimos completar el inicio de sesion" (ya existe) |
| Cualquier request al backend | 401 | api-client cierra sesion y redirige a `/login` |
| Cualquier request al backend | 500 | Mensaje generico de error (ya existe) |
| Logout | `signOut()` falla offline | Redirige igual a `/login`; proxima request al backend devolvera 401 y proxy.ts redirige |

### Race condition en lazy sync

Dos requests concurrentes del mismo user nuevo: `INSERT ... ON CONFLICT DO NOTHING` lo resuelve a nivel DB. El `SELECT` que sigue siempre encuentra la fila porque la sesion que la creo commiteo antes de retornar.

## Testing

### Backend (pytest, mockeando Supabase)

- `tests/test_auth_dependencies.py`
  - `get_current_user` sin token → 401.
  - `get_current_user` con token valido (mock) → retorna `user_id`.
  - `get_current_user` crea fila en `users` si no existe.
  - `get_current_user` no duplica si ya existe.
- `tests/test_auth_router.py`
  - `GET /api/auth/me` sin Authorization → 401.
  - `GET /api/auth/me` con user existente → retorna shape correcto.

### Frontend (validacion manual)

- Login email/password feliz path.
- Signup feliz path.
- Login OAuth Google.
- Click sidebar avatar → popover abre → "Cerrar sesion" → redirige a `/login`.
- Sin sesion → entrar a `/chat` → redirige a `/login`.
- Con sesion + `onboarding_completed=false` → redirige a `/onboarding`.

## Criterios de aceptacion

1. Tras login con un user nuevo, la fila aparece automaticamente en `users` en el primer request autenticado.
2. `GET /api/auth/me` devuelve el perfil del user autenticado.
3. Logout desde el popover del sidebar cierra sesion y redirige a `/login`.
4. `models/profile.py` eliminado, columna `onboarding_completed` dropeada via Alembic, `auth.router` registrado en `main.py`, `Base.metadata.create_all` removido del `lifespan`.
5. 401 en el backend → frontend cierra sesion y redirige a `/login`.
6. `POST /api/chat` sigue funcionando para users existentes y para users recien creados.
7. Tests backend listados pasan.

## Fuera de alcance

- Forgot password / reset por email.
- Reenviar email de confirmacion.
- Refresh token manual (Supabase lo maneja).
- Tests E2E.
- Rate limiting.
- Cache Redis del lazy sync (re-evaluar si pesa en produccion).

## Riesgos y mitigaciones

- **Lazy sync anade una query por request.** Mitigacion: `ON CONFLICT DO NOTHING` es barato (un index lookup). Si el profiling muestra overhead, anadir cache (Redis) sin cambiar la interfaz publica.
- **Drop de columna `onboarding_completed` rompe en produccion si ya tiene datos.** Mitigacion: la columna esta sin uso real hoy (`proxy.ts` lee de `user_metadata`). La migracion es safe en este momento; ejecutar antes de que cualquier feature dependa de la columna.
- **Cambio del retorno de `verify_supabase_token` (de `str` a objeto).** Mitigacion: solo lo consume `get_current_user`. El retorno de `get_current_user` (str) no cambia.
