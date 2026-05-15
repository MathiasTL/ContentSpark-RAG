# Auth Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Cerrar la pieza "Auth completo" del sprint MVP — lazy sync de usuarios de Supabase a la tabla local, endpoint `/api/auth/me`, logout desde sidebar, limpieza de duplicaciones, manejo de 401 en el cliente.

**Architecture:** El frontend mantiene la propiedad del flujo de auth (Supabase client + `proxy.ts`). El backend es consumidor de tokens: anade un endpoint `GET /api/auth/me` y un lazy upsert dentro de `get_current_user` para garantizar la fila local antes de cualquier FK. `onboarding_completed` queda solo en Supabase `user_metadata`.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async, Alembic, Supabase, Next.js 16, `@supabase/ssr`, Radix UI, Tailwind.

**Spec de referencia:** `docs/superpowers/specs/2026-05-15-auth-completion-design.md`

---

## File Structure

**Backend — crear:**
- `backend/alembic/versions/<id>_drop_users_onboarding_completed.py` — migracion drop columna
- `backend/tests/test_auth.py` — sobrescribir el placeholder con tests reales (4 tests)

**Backend — modificar:**
- `backend/requirements.txt` — anadir pytest, pytest-asyncio, pytest-mock, httpx
- `backend/app/middleware/auth.py` — `verify_supabase_token` retorna ahora el user object completo
- `backend/app/dependencies.py` — `get_current_user` hace lazy upsert
- `backend/app/models/user.py` — drop columna `onboarding_completed`
- `backend/app/schemas/auth.py` — reemplazar contenido por `UserResponse`
- `backend/app/routers/auth.py` — implementar `GET /me`
- `backend/main.py` — incluir `auth.router`, eliminar `Base.metadata.create_all`
- `backend/tests/conftest.py` — extender con fixtures de supabase mock + db session mock + TestClient

**Backend — eliminar:**
- `backend/app/models/profile.py` — archivo vacio redundante con `creator_profile.py`

**Frontend — crear:**
- `frontend/shared/components/ui/Popover.tsx` — wrapper generico de `@radix-ui/react-popover`
- `frontend/shared/components/layout/UserMenu.tsx` — popover con item logout

**Frontend — modificar:**
- `frontend/package.json` — anadir `@radix-ui/react-popover`
- `frontend/shared/components/layout/AppSidebar.tsx` — envolver bloque user en `UserMenu`
- `frontend/shared/lib/api-client.ts` — helper que captura 401 y cierra sesion

**Frontend — no tocar:**
- `proxy.ts`, `LoginView.tsx`, `SignupView.tsx`, `callback/page.tsx`, `supabase.ts`, `supabase-server.ts`

---

## Task 1: Test infrastructure backend

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/tests/conftest.py`

- [x] **Step 1: Anadir dependencias de testing a `requirements.txt`**

Anadir al final del archivo:

```
# Testing
pytest
pytest-asyncio
pytest-mock
httpx
```

- [x] **Step 2: Instalar dependencias**

Run: `cd backend && pip install -r requirements.txt`
Expected: instala pytest, pytest-asyncio, pytest-mock, httpx sin errores.

- [x] **Step 3: Reemplazar `backend/tests/conftest.py`**

```python
"""Fixtures compartidos para tests del backend."""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.dependencies import get_current_user, get_db
from app.middleware.auth import get_supabase_admin
from main import app


@pytest.fixture
def mock_user_id() -> str:
    return "11111111-1111-1111-1111-111111111111"


@pytest.fixture
def mock_supabase_user(mock_user_id: str) -> SimpleNamespace:
    """Fake Supabase user object con la forma minima que usamos."""
    return SimpleNamespace(
        id=mock_user_id,
        email="creator@example.com",
        user_metadata={"name": "Maria", "avatar_url": "https://avatars/m.png"},
    )


@pytest.fixture
def mock_supabase_admin(mock_supabase_user: SimpleNamespace):
    """Cliente Supabase admin mockeado. Retorna mock_supabase_user en get_user."""
    admin = MagicMock()
    admin.auth.get_user.return_value = SimpleNamespace(user=mock_supabase_user)
    return admin


@pytest.fixture
def mock_db_session():
    """AsyncSession mockeada — execute() es AsyncMock."""
    session = AsyncMock()
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    return session


@pytest.fixture
def client(mock_supabase_admin, mock_db_session):
    """TestClient con dependencias de Supabase y DB sobreescritas."""
    app.dependency_overrides[get_db] = lambda: mock_db_session
    # get_supabase_admin esta cacheado con lru_cache; lo reemplazamos via override
    # de FastAPI para los tests que pasen por la dep, y monkeypatchamos el import
    # directo para el middleware:
    import app.middleware.auth as auth_module

    original = auth_module.get_supabase_admin
    auth_module.get_supabase_admin = lambda: mock_supabase_admin

    with TestClient(app) as test_client:
        yield test_client

    auth_module.get_supabase_admin = original
    app.dependency_overrides.clear()
```

- [x] **Step 4: Verificar pytest descubre el conftest**

Run: `cd backend && pytest --collect-only -q`
Expected: lista tests existentes sin "import errors". No tests fallan todavia.

- [x] **Step 5: Commit**

```bash
cd backend
git add requirements.txt tests/conftest.py
git commit -m "test: add backend testing infrastructure (pytest + httpx + fixtures)"
```

---

## Task 2: `verify_supabase_token` retorna user object completo

**Files:**
- Modify: `backend/app/middleware/auth.py`

- [x] **Step 1: Refactorizar `verify_supabase_token`**

Reemplazar el cuerpo del archivo `backend/app/middleware/auth.py`:

```python
"""Helpers de autenticacion para Supabase Auth."""
from __future__ import annotations

from functools import lru_cache
from typing import Any

from fastapi import HTTPException
from supabase import Client, create_client

from app.config import settings


@lru_cache()
def get_supabase_admin() -> Client:
    """Crea un cliente Supabase con service role key (sb_secret_...)."""
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("Supabase credentials missing")
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def _extract_user(response: Any) -> Any:
    user = getattr(response, "user", None)
    if user is None and isinstance(response, dict):
        user = response.get("user")
    return user


def verify_supabase_token(token: str) -> Any:
    """Verifica el token y retorna el objeto user completo de Supabase."""
    if not token:
        raise HTTPException(status_code=401, detail="Token de autenticacion requerido")

    try:
        supabase_admin = get_supabase_admin()
        response = supabase_admin.auth.get_user(token)
        user = _extract_user(response)
        if user is None or getattr(user, "id", None) in (None, ""):
            raise HTTPException(status_code=401, detail="Token invalido")
        return user
    except HTTPException:
        raise
    except Exception as exc:
        print(f"Auth error: {exc}")
        raise HTTPException(status_code=401, detail="Error de autenticacion")
```

- [x] **Step 2: Verificar que el unico consumidor sigue compilando**

Run: `cd backend && python -c "from app.middleware.auth import verify_supabase_token; print('ok')"`
Expected: imprime "ok" sin errores.

- [x] **Step 3: Commit**

```bash
cd backend
git add app/middleware/auth.py
git commit -m "refactor(auth): return full user object from verify_supabase_token"
```

---

## Task 3: Lazy sync en `get_current_user` (TDD)

**Files:**
- Modify: `backend/app/dependencies.py`
- Modify: `backend/app/schemas/auth.py`
- Test: `backend/tests/test_auth.py`

- [x] **Step 1: Definir `UserResponse` en `schemas/auth.py`**

Reemplazar contenido completo de `backend/app/schemas/auth.py`:

```python
"""Schemas Pydantic para endpoints de auth."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, EmailStr


class UserResponse(BaseModel):
    user_id: str
    email: EmailStr
    name: Optional[str] = None
    avatar_url: Optional[str] = None
```

- [x] **Step 2: Escribir el test fallido del 401 sin token**

Sobrescribir `backend/tests/test_auth.py`:

```python
"""Tests de auth: verifica /api/auth/me y lazy sync."""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock


def test_me_without_token_returns_401(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401
```

- [x] **Step 3: Verificar que el test falla porque el endpoint no existe**

Run: `cd backend && pytest tests/test_auth.py::test_me_without_token_returns_401 -v`
Expected: FAIL con 404 (el router no esta registrado todavia) o 401 si ya estuviera. Si pasa con 404 → seguimos. Si pasa con 401 → el endpoint ya retorna 401 sin token (improbable).

- [x] **Step 4: Modificar `get_current_user` para hacer lazy upsert**

Reemplazar contenido completo de `backend/app/dependencies.py`:

```python
"""Dependencias compartidas para endpoints FastAPI."""
from __future__ import annotations

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.middleware.auth import verify_supabase_token
from app.models.user import User


async def get_db():
    """Inyecta una AsyncSession de SQLAlchemy en cada endpoint."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


security = HTTPBearer(auto_error=False)


def _meta_get(user_obj, key: str):
    meta = getattr(user_obj, "user_metadata", None) or {}
    if isinstance(meta, dict):
        return meta.get(key)
    return getattr(meta, key, None)


async def _lazy_upsert_user(db: AsyncSession, user_obj) -> None:
    """INSERT ... ON CONFLICT DO NOTHING para garantizar fila local."""
    stmt = pg_insert(User).values(
        id=user_obj.id,
        email=user_obj.email,
        name=_meta_get(user_obj, "name") or _meta_get(user_obj, "full_name"),
        avatar_url=_meta_get(user_obj, "avatar_url"),
    ).on_conflict_do_nothing(index_elements=["id"])
    await db.execute(stmt)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> str:
    """Verifica el token de Supabase, asegura fila en `users` y retorna user_id."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Token de autenticacion requerido")

    user_obj = verify_supabase_token(credentials.credentials)
    await _lazy_upsert_user(db, user_obj)
    return str(user_obj.id)
```

- [x] **Step 5: Verificar que el test del 401 sigue requiriendo el endpoint (404 todavia)**

Run: `cd backend && pytest tests/test_auth.py::test_me_without_token_returns_401 -v`
Expected: FAIL (404 — el endpoint /me todavia no existe). El cambio en deps todavia no esta probado hasta Task 6.

- [x] **Step 6: Commit**

```bash
cd backend
git add app/dependencies.py app/schemas/auth.py tests/test_auth.py
git commit -m "feat(auth): lazy upsert user on protected requests + UserResponse schema"
```

---

## Task 4: Drop columna `onboarding_completed`

**Files:**
- Modify: `backend/app/models/user.py`
- Create: `backend/alembic/versions/<id>_drop_users_onboarding_completed.py`

- [x] **Step 1: Quitar la columna del modelo `User`**

Reemplazar `backend/app/models/user.py`:

```python
"""Modelo User — sincronizado con Supabase Auth."""
import uuid

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relaciones
    profile: Mapped["CreatorProfile"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    chats: Mapped[list["Chat"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    calendars: Mapped[list["ContentCalendar"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
```

- [x] **Step 2: Generar la migracion con Alembic**

Run: `cd backend && alembic revision -m "drop_users_onboarding_completed"`
Expected: crea un archivo nuevo en `alembic/versions/`. Anotar su ID (ej. `abcd1234efgh`).

- [x] **Step 3: Escribir el cuerpo de la migracion**

Reemplazar el cuerpo del archivo recien creado:

```python
"""drop users.onboarding_completed

Revision ID: <auto>
Revises: 04bb76c6e29f
Create Date: <auto>

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers (los valores auto-generados se mantienen)
revision: str  # <auto>
down_revision: Union[str, Sequence[str], None] = "04bb76c6e29f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("users", "onboarding_completed")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "onboarding_completed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
```

(Mantener los valores `revision` y `Create Date` que Alembic genero — solo se modifica `down_revision`, `upgrade`, `downgrade`.)

- [x] **Step 4: Aplicar la migracion contra la DB local**

Run: `cd backend && alembic upgrade head`
Expected: log de Alembic confirmando upgrade a la nueva revision sin errores.

- [x] **Step 5: Verificar que la columna ya no existe**

Run: `cd backend && python -c "from app.models.user import User; print([c.name for c in User.__table__.columns])"`
Expected: lista sin `onboarding_completed`.

- [x] **Step 6: Commit**

```bash
cd backend
git add app/models/user.py alembic/versions/
git commit -m "feat(db): drop users.onboarding_completed (source of truth is supabase metadata)"
```

---

## Task 5: Eliminar `models/profile.py` redundante

**Files:**
- Delete: `backend/app/models/profile.py`

- [x] **Step 1: Verificar que el archivo no es importado en ningun lado**

Run: `cd backend && grep -rn "from app.models.profile\|app.models.profile" --include="*.py" .`
Expected: 0 resultados.

- [x] **Step 2: Eliminar el archivo**

Run: `cd backend && rm app/models/profile.py`

- [x] **Step 3: Verificar que la app sigue importando bien**

Run: `cd backend && python -c "import main; print('ok')"`
Expected: imprime "ok".

- [x] **Step 4: Commit**

```bash
cd backend
git add -A app/models/
git commit -m "chore(models): remove empty profile.py (redundant with creator_profile.py)"
```

---

## Task 6: Implementar `GET /api/auth/me` (TDD)

**Files:**
- Modify: `backend/app/routers/auth.py`
- Modify: `backend/main.py`
- Modify: `backend/tests/test_auth.py`

- [x] **Step 1: Escribir tests fallidos para los 4 escenarios**

Reemplazar `backend/tests/test_auth.py`:

```python
"""Tests de auth: verifica /api/auth/me y lazy sync."""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock


def test_me_without_token_returns_401(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_me_invalid_token_returns_401(client, mock_supabase_admin):
    mock_supabase_admin.auth.get_user.return_value = SimpleNamespace(user=None)
    response = client.get(
        "/api/auth/me", headers={"Authorization": "Bearer bogus"}
    )
    assert response.status_code == 401


def test_me_valid_token_returns_user_payload(
    client, mock_db_session, mock_supabase_user
):
    fetched_user = SimpleNamespace(
        id=mock_supabase_user.id,
        email=mock_supabase_user.email,
        name="Maria",
        avatar_url="https://avatars/m.png",
    )
    result = SimpleNamespace(scalar_one_or_none=lambda: fetched_user)
    mock_db_session.execute = AsyncMock(return_value=result)

    response = client.get(
        "/api/auth/me", headers={"Authorization": "Bearer valid"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body == {
        "user_id": mock_supabase_user.id,
        "email": "creator@example.com",
        "name": "Maria",
        "avatar_url": "https://avatars/m.png",
    }


def test_me_triggers_lazy_upsert(client, mock_db_session, mock_supabase_user):
    fetched_user = SimpleNamespace(
        id=mock_supabase_user.id,
        email=mock_supabase_user.email,
        name="Maria",
        avatar_url=None,
    )
    result = SimpleNamespace(scalar_one_or_none=lambda: fetched_user)
    mock_db_session.execute = AsyncMock(return_value=result)

    client.get("/api/auth/me", headers={"Authorization": "Bearer valid"})

    # `get_current_user` debe ejecutar al menos un INSERT (upsert) + un SELECT.
    assert mock_db_session.execute.await_count >= 2
```

- [x] **Step 2: Verificar que todos los tests fallan (endpoint no existe)**

Run: `cd backend && pytest tests/test_auth.py -v`
Expected: 4 tests, todos FAIL con 404 (excepto el primero que ya falla con 404 por la misma razon).

- [x] **Step 3: Implementar el router `GET /me`**

Reemplazar `backend/app/routers/auth.py`:

```python
"""Router de auth: endpoints minimos para el frontend."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me", response_model=UserResponse)
async def get_me(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Devuelve el perfil del user autenticado desde la DB local."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        # El lazy sync deberia haber creado la fila; si no, algo grave paso.
        raise HTTPException(status_code=500, detail="Usuario no encontrado tras sync")

    return UserResponse(
        user_id=str(user.id),
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
    )
```

- [x] **Step 4: Registrar el router en `main.py`**

Modificar `backend/main.py` — reemplazar contenido completo:

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.routers import auth, chat, ingest
from app.database import engine

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Cierra el engine al apagar. Las migraciones se manejan con Alembic."""
    yield
    await engine.dispose()
    print("Conexion a PostgreSQL cerrada")


app = FastAPI(
    title="ContentSpark API",
    description="API para la plataforma SaaS ContentSpark — RAG + agentes para creadores de contenido",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://contentspark.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(ingest.router)


@app.get("/")
async def root():
    """Health check."""
    return {"status": "ok", "service": "ContentSpark API", "version": "0.2.0"}
```

- [x] **Step 5: Correr todos los tests de auth y verificar que pasan**

Run: `cd backend && pytest tests/test_auth.py -v`
Expected: 4 tests PASS.

- [x] **Step 6: Verificar que la app arranca**

Run: `cd backend && python -c "import main; print(main.app.routes[-1].path)"`
Expected: imprime una ruta del API (sanity check sin levantar uvicorn).

- [x] **Step 7: Commit**

```bash
cd backend
git add app/routers/auth.py main.py tests/test_auth.py
git commit -m "feat(api): implement GET /api/auth/me with lazy user sync"
```

---

## Task 7: Verificar regresion del chat router

**Files:**
- Test: smoke test manual

- [x] **Step 1: Levantar el backend y comprobar /api/chat sigue protegido**

Run: `cd backend && uvicorn main:app --port 8000 &` (o en otra terminal: `uvicorn main:app --port 8000`)
Run: `curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8000/api/chat -H "Content-Type: application/json" -d '{"message":"hi","history":[]}'`
Expected: `401` (sin token).

- [x] **Step 2: Detener el backend**

Si quedo en background: `kill %1` (o `pkill -f "uvicorn main:app"`).

- [x] **Step 3: Confirmar tests pasan completos**

Run: `cd backend && pytest -v`
Expected: todos los tests del repositorio PASS (los de auth y los placeholders vacios no rompen).

(Sin commit en este task — es solo verificacion.)

---

## Task 8: Instalar `@radix-ui/react-popover`

**Files:**
- Modify: `frontend/package.json`

- [x] **Step 1: Instalar la dependencia con pnpm**

Run: `cd frontend && pnpm add @radix-ui/react-popover`
Expected: `package.json` actualizado, lock file modificado, sin errores.

- [x] **Step 2: Verificar que el paquete esta disponible**

Run: `cd frontend && node -e "console.log(require.resolve('@radix-ui/react-popover'))"`
Expected: imprime una ruta valida en `node_modules`.

- [x] **Step 3: Commit**

```bash
cd frontend
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): add @radix-ui/react-popover for user menu"
```

---

## Task 9: Componente generico `Popover`

**Files:**
- Create: `frontend/shared/components/ui/Popover.tsx`

- [x] **Step 1: Crear el wrapper**

Crear `frontend/shared/components/ui/Popover.tsx`:

```tsx
"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { forwardRef } from "react";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

type ContentProps = React.ComponentPropsWithoutRef<
  typeof PopoverPrimitive.Content
>;

export const PopoverContent = forwardRef<HTMLDivElement, ContentProps>(
  ({ className = "", sideOffset = 8, align = "start", ...props }, ref) => (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        className={`z-50 min-w-[12rem] rounded-2xl border border-white/20 bg-white/30 p-2 shadow-[0_24px_48px_-16px_rgba(110,44,224,0.18)] backdrop-blur-xl outline-none ${className}`}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
);
PopoverContent.displayName = "PopoverContent";
```

- [x] **Step 2: Verificar typecheck**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: cero errores en el archivo nuevo (puede haber pre-existentes — solo mira los del archivo creado).

- [x] **Step 3: Commit**

```bash
cd frontend
git add shared/components/ui/Popover.tsx
git commit -m "feat(ui): add generic glassmorphism Popover wrapper"
```

---

## Task 10: `UserMenu` con logout

**Files:**
- Create: `frontend/shared/components/layout/UserMenu.tsx`

- [x] **Step 1: Crear el componente**

Crear `frontend/shared/components/layout/UserMenu.tsx`:

```tsx
"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/Popover";
import { createClient } from "@/shared/lib/supabase";

type Props = {
  name: string;
  email?: string;
  avatar?: string;
  collapsed?: boolean;
};

export default function UserMenu({ name, email, avatar, collapsed }: Props) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleLogout = async () => {
    setIsSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      router.push("/login");
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Menu de usuario"
          className={`flex w-full items-center gap-3 rounded-2xl text-left transition-colors hover:bg-white/20 ${
            collapsed ? "justify-center px-0" : "px-2 py-2"
          }`}
        >
          <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/20 bg-white/10">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                alt={name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-white/70">
                {name.charAt(0).toUpperCase()}
              </span>
            )}
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-on-surface">
                {name}
              </span>
              <span className="block text-[10px] uppercase tracking-widest text-on-surface-variant">
                Pro Member
              </span>
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" sideOffset={12} className="w-56">
        <div className="px-3 py-2">
          <p className="truncate text-sm font-semibold text-on-surface">
            {name}
          </p>
          {email && (
            <p className="truncate text-xs font-light text-on-surface-variant">
              {email}
            </p>
          )}
        </div>
        <div className="my-1 h-px bg-white/20" />
        <button
          type="button"
          onClick={handleLogout}
          disabled={isSigningOut}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-on-surface transition-colors hover:bg-white/30 disabled:opacity-60"
        >
          <LogOut size={16} strokeWidth={1.75} />
          {isSigningOut ? "Cerrando sesion..." : "Cerrar sesion"}
        </button>
      </PopoverContent>
    </Popover>
  );
}
```

- [x] **Step 2: Verificar typecheck**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: cero errores en el archivo nuevo.

- [x] **Step 3: Commit**

```bash
cd frontend
git add shared/components/layout/UserMenu.tsx
git commit -m "feat(auth): UserMenu popover with logout action"
```

---

## Task 11: Integrar `UserMenu` en `AppSidebar`

**Files:**
- Modify: `frontend/shared/components/layout/AppSidebar.tsx`

- [x] **Step 1: Sustituir el bloque user del sidebar por `UserMenu`**

Aplicar este cambio en `frontend/shared/components/layout/AppSidebar.tsx`:

Eliminar el bloque actual (lineas ~134-159 — el `<div>` que renderiza avatar + nombre estatico) y reemplazarlo. Tambien anadir el state para `email` y el import.

Anadir al import principal:

```tsx
import UserMenu from "./UserMenu";
```

Reemplazar la declaracion `const [user, setUser]` y el `useEffect` siguiente por:

```tsx
const [user, setUser] = useState<{
  name: string;
  email?: string;
  avatar?: string;
} | null>(null);

useEffect(() => {
  const supabase = createClient();
  supabase.auth.getUser().then(({ data }) => {
    if (!data.user) return;
    const meta = data.user.user_metadata ?? {};
    setUser({
      name:
        meta.full_name ||
        meta.name ||
        data.user.email?.split("@")[0] ||
        "Creator",
      email: data.user.email ?? undefined,
      avatar: meta.avatar_url,
    });
  });
}, []);
```

Reemplazar el bloque `<div className="flex items-center gap-3 border-t border-white/5 pt-4 ...">` por:

```tsx
<div className="border-t border-white/5 pt-4">
  {user && (
    <UserMenu
      name={user.name}
      email={user.email}
      avatar={user.avatar}
      collapsed={collapsed}
    />
  )}
</div>
```

- [x] **Step 2: Verificar typecheck**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: cero errores.

- [x] **Step 3: Verificar lint**

Run: `cd frontend && pnpm lint`
Expected: cero errores nuevos (warnings pre-existentes ok).

- [x] **Step 4: Commit**

```bash
cd frontend
git add shared/components/layout/AppSidebar.tsx
git commit -m "feat(sidebar): wire UserMenu into AppSidebar avatar block"
```

---

## Task 12: Manejo de 401 en `api-client.ts`

**Files:**
- Modify: `frontend/shared/lib/api-client.ts`

- [x] **Step 1: Anadir helper `handleAuthErrors`**

Modificar `frontend/shared/lib/api-client.ts` — anadir despues de `getAuthHeaders`:

```ts
async function handleAuthError(response: Response): Promise<void> {
  if (response.status !== 401) return;
  if (typeof window === "undefined") return;

  const supabase = createClient();
  await supabase.auth.signOut();
  window.location.href = "/login";
}
```

Y modificar las tres funciones (`sendMessageToBackend`, `getSourcesFromBackend`, `streamMessageFromBackend`) para llamar `handleAuthError` justo despues de `await fetch(...)` y antes del `if (!response.ok)`. Ejemplo en `sendMessageToBackend`:

```ts
const response = await fetch(`${BACKEND_URL}/api/chat`, { /* ... */ });
await handleAuthError(response);
if (!response.ok) {
  throw new Error(`Error en el servidor: ${response.status}`);
}
```

Aplicar identico patron en `getSourcesFromBackend` y `streamMessageFromBackend`.

- [x] **Step 2: Verificar typecheck**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: cero errores.

- [x] **Step 3: Commit**

```bash
cd frontend
git add shared/lib/api-client.ts
git commit -m "feat(api-client): sign out and redirect on 401 responses"
```

---

## Task 13: QA manual end-to-end

Sin commits. Solo verificacion.

- [x] **Step 1: Levantar backend y frontend**

Backend: `cd backend && uvicorn main:app --reload --port 8000`
Frontend (otra terminal): `cd frontend && pnpm dev`

- [x] **Step 2: Validar checklist manual**

Probar en el navegador (`http://localhost:3000`):

- [x] Login email/password con cuenta existente → redirige a `/chat`.
- [x] Signup nuevo → email de confirmacion o entrada directa a `/chat` segun config Supabase.
- [x] Login Google OAuth → callback completa → `/chat`.
- [x] Sin sesion, intentar `/chat` directo → proxy redirige a `/login`.
- [x] Con sesion, click en avatar del sidebar → popover abre con nombre/email/avatar.
- [x] Click "Cerrar sesion" → vuelve a `/login`. El proximo intento de `/chat` redirige a `/login`.
- [x] Tras signup nuevo, verificar en DB: `SELECT id, email, name FROM users WHERE email = 'el_email';` debe tener una fila creada automaticamente.
- [x] Forzar token invalido (modificar cookie manualmente o esperar expiracion) → llamar al backend → frontend cierra sesion y redirige a `/login`.

- [x] **Step 3: Detener servidores**

Ctrl+C en ambas terminales.

---

## Self-Review (ya realizado por el plan author)

- **Spec coverage:**
  - Lazy sync → Task 3.
  - `/api/auth/me` → Task 6.
  - Drop `onboarding_completed` + migracion → Task 4.
  - `models/profile.py` eliminado → Task 5.
  - `auth.router` registrado + `Base.metadata.create_all` removido → Task 6.
  - 401 handling en frontend → Task 12.
  - Logout via popover → Tasks 8, 9, 10, 11.
  - Tests backend (4 casos) → Task 6.
  - No regresion de chat → Task 7.
  - QA frontend → Task 13.

- **Placeholders:** ninguno. Cada task tiene codigo completo.

- **Type consistency:** `UserResponse` (Task 3) coincide con el response del router (Task 6). `verify_supabase_token` retorna user object (Task 2) y `get_current_user` consume `user_obj.id`, `user_obj.email`, `user_obj.user_metadata` (Task 3) — consistente. `UserMenu` props (Task 10) coinciden con como `AppSidebar` los llama (Task 11).
