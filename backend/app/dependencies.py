# Inyeccion de dependencias FastAPI
from fastapi import Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.database import AsyncSessionLocal


async def get_db():
    """Inyecta una AsyncSession de SQLAlchemy en cada endpoint."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_current_user(authorization: Optional[str] = Header(None)) -> str:
    """
    Extrae y verifica el JWT de Supabase.
    Retorna el user_id si es valido.
    TODO Fase 1: Implementar verificacion real con Supabase Auth (sb_secret_...)
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token de autenticacion requerido")
    # token = authorization.split(" ")[1]
    # Verificacion JWT pendiente — Fase 1
    raise HTTPException(status_code=501, detail="Auth no implementado aun — Fase 1")
