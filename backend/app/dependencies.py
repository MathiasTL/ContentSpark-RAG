# Inyección de dependencias FastAPI
# TODO Fase 1: Implementar get_current_user (verifica JWT y retorna user_id)
# TODO Fase 1: Implementar get_db (conexión Prisma/Supabase)
from fastapi import Header, HTTPException
from typing import Optional


async def get_current_user(authorization: Optional[str] = Header(None)) -> str:
    """
    Extrae y verifica el JWT de Supabase.
    Retorna el user_id si es válido.
    TODO Fase 1: Implementar verificación real con SUPABASE_JWT_SECRET
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token de autenticación requerido")
    # token = authorization.split(" ")[1]
    # Verificación JWT pendiente — Fase 1
    raise HTTPException(status_code=501, detail="Auth no implementado aún — Fase 1")
