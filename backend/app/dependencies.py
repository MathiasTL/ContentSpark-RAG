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
