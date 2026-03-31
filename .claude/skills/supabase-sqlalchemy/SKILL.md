---
name: supabase-sqlalchemy
description: >
  Skill para la integración de Supabase (Auth + PostgreSQL) con SQLAlchemy 2.0 async en
  ContentSpark. Usar cuando se configure la conexión a la base de datos, se creen o modifiquen
  modelos SQLAlchemy, se ejecuten migraciones con Alembic, se implemente autenticación con
  Supabase Auth, o se trabaje con el middleware de verificación de tokens en FastAPI. También
  cubre patrones de queries async, manejo de sesiones, y reglas de seguridad.
---

# Supabase + SQLAlchemy Integration Skill

## Contexto
ContentSpark usa Supabase como backend-as-a-service (PostgreSQL + Auth) y SQLAlchemy 2.0 (async) como ORM en el backend FastAPI. El frontend solo usa Supabase para autenticación, NO accede a la base de datos directamente.

## Setup inicial

### Instalar dependencias (backend)
```bash
pip install sqlalchemy[asyncio] asyncpg alembic python-dotenv supabase
```

### Instalar dependencias (frontend — solo auth)
```bash
npm install @supabase/supabase-js @supabase/ssr
```

### Configuración de SQLAlchemy async

```python
# backend/app/database.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.config import settings

# DATABASE_URL debe usar el driver asyncpg:
# postgresql+asyncpg://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,  # True para debug SQL
    pool_size=5,
    max_overflow=10,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

async def get_db():
    """Dependency para inyectar sesión en endpoints FastAPI."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

### Base declarativa compartida

```python
# backend/app/models/base.py
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import DateTime, func
from datetime import datetime
import uuid

class Base(DeclarativeBase):
    pass

class TimestampMixin:
    """Mixin para created_at y updated_at automáticos."""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
```

### Ejemplo de modelo

```python
# backend/app/models/user.py
from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin
import uuid

class User(Base, TimestampMixin):
    __tablename__ = "users"
    
    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Relaciones
    profile: Mapped["CreatorProfile"] = relationship(back_populates="user", uselist=False)
    chats: Mapped[list["Chat"]] = relationship(back_populates="user")
```

### Registrar todos los modelos

```python
# backend/app/models/__init__.py
from app.models.base import Base
from app.models.user import User
from app.models.profile import CreatorProfile, SocialAccount
from app.models.chat import Chat, Message
from app.models.calendar import ContentCalendar, ContentEntry

# Exportar Base y todos los modelos para que Alembic los descubra
__all__ = [
    "Base", "User", "CreatorProfile", "SocialAccount",
    "Chat", "Message", "ContentCalendar", "ContentEntry",
]
```

### Configurar Alembic

```bash
# Desde backend/
alembic init alembic
```

Editar `alembic/env.py`:
```python
from app.models import Base
from app.config import settings

config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
target_metadata = Base.metadata
```

Comandos de migración:
```bash
# Crear migración automática
alembic revision --autogenerate -m "descripcion del cambio"

# Aplicar migraciones
alembic upgrade head

# Ver historial
alembic history

# Revertir última migración
alembic downgrade -1
```

## Patrones de queries con SQLAlchemy async

### Crear registros
```python
from sqlalchemy import select
from app.models.chat import Chat

async def create_chat(session: AsyncSession, user_id: str, title: str) -> Chat:
    chat = Chat(user_id=user_id, title=title)
    session.add(chat)
    await session.flush()  # Para obtener el id generado
    return chat
```

### Queries con relaciones
```python
from sqlalchemy.orm import selectinload

async def get_chat_with_messages(session: AsyncSession, chat_id: str) -> Chat | None:
    result = await session.execute(
        select(Chat)
        .where(Chat.id == chat_id)
        .options(selectinload(Chat.messages))
    )
    return result.scalar_one_or_none()
```

### Filtrar por usuario (seguridad)
SIEMPRE filtrar por user_id en TODAS las queries:
```python
async def get_user_chats(session: AsyncSession, user_id: str) -> list[Chat]:
    result = await session.execute(
        select(Chat)
        .where(Chat.user_id == user_id)
        .order_by(Chat.updated_at.desc())
    )
    return list(result.scalars().all())
```

### Actualizar registros
```python
from sqlalchemy import update

async def rename_chat(session: AsyncSession, chat_id: str, user_id: str, new_title: str):
    await session.execute(
        update(Chat)
        .where(Chat.id == chat_id, Chat.user_id == user_id)
        .values(title=new_title)
    )
```

### Eliminar registros
```python
from sqlalchemy import delete

async def delete_chat(session: AsyncSession, chat_id: str, user_id: str):
    await session.execute(
        delete(Chat)
        .where(Chat.id == chat_id, Chat.user_id == user_id)
    )
```

### Uso en endpoints FastAPI
```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/chats", tags=["chats"])

@router.get("/")
async def list_chats(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    chats = await get_user_chats(db, user_id)
    return [{"id": c.id, "title": c.title} for c in chats]
```

## Patrones de Supabase Auth

### API keys (formato nuevo)
- `sb_publishable_...` → reemplaza la antigua `anon` key. Para el frontend.
- `sb_secret_...` → reemplaza la antigua `service_role` key. Solo para el backend.
- Ya NO se necesita `SUPABASE_JWT_SECRET`. El backend verifica tokens llamando a Supabase Auth.

### Frontend: Cliente
```typescript
// shared/lib/supabase.ts
import { createBrowserClient } from "@supabase/ssr";

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!  // sb_publishable_...
);
```

### Frontend: Login
```typescript
// Email/password
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});

// Google OAuth
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo: `${window.location.origin}/auth/callback` },
});
```

### Frontend: Obtener sesión y token
```typescript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
// Enviar token al backend en cada request
```

### Frontend: Proteger rutas
```typescript
// middleware.ts (Next.js)
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function middleware(request) {
  const supabase = createServerClient(/* ... */);
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session && request.nextUrl.pathname.startsWith("/(app)")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}
```

### Backend: Verificar token via Supabase Auth (FastAPI)
```python
# backend/app/dependencies.py
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client
import os

security = HTTPBearer()

# Cliente Supabase con secret key para verificar tokens
supabase_admin = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")  # sb_secret_...
)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """Verifica el token del usuario via Supabase Auth y retorna user_id."""
    token = credentials.credentials
    try:
        # Supabase verifica el token internamente
        user_response = supabase_admin.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Token inválido")
        return user_response.user.id
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Error de autenticación: {str(e)}")
```

**Nota importante:** Este patrón reemplaza al antiguo método de decodificar JWTs manualmente con `SUPABASE_JWT_SECRET`. Con las nuevas API keys de Supabase, la verificación se hace llamando a `supabase.auth.get_user(token)` usando la secret key (`sb_secret_...`).

## Errores comunes

### "connection refused" o "timeout"
Causa: El `DATABASE_URL` no usa el driver async correcto.
Solución: Usar `postgresql+asyncpg://...` en vez de `postgresql://...`.

### "relation does not exist"
Causa: No se ejecutó la migración con Alembic.
Solución: `alembic upgrade head`.

### "MissingGreenlet" o "async not supported"
Causa: Se está usando `session.execute()` sin `await`.
Solución: Todas las operaciones de SQLAlchemy async requieren `await`.

### Token expirado
Causa: El access token de Supabase expiró (default 1 hora).
Solución: Implementar refresh del token en el frontend con `supabase.auth.onAuthStateChange()`.

### "sb_secret used in browser"
Causa: La secret key se expuso en el frontend.
Solución: La secret key (`sb_secret_...`) solo se usa en el backend. El frontend solo usa `sb_publishable_...`.

## Reglas de seguridad

- NUNCA exponer `SUPABASE_SERVICE_ROLE_KEY` (`sb_secret_...`) en el frontend.
- SIEMPRE filtrar queries por `user_id` del token verificado.
- SIEMPRE validar que el recurso pertenece al usuario antes de retornarlo.
- Usar `AsyncSession` con el patrón try/commit/rollback/close del `get_db` dependency.
- Usar RLS en Supabase como capa extra de seguridad (además del filtro por user_id en SQLAlchemy).
