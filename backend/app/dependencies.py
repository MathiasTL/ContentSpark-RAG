"""Dependencias compartidas para endpoints FastAPI."""

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.middleware.auth import verify_supabase_token


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


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """Verifica el token de Supabase y retorna el user_id."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Token de autenticacion requerido")

    token = credentials.credentials
    return verify_supabase_token(token)
