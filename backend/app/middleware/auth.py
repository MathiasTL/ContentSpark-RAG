"""Helpers de autenticacion para Supabase Auth."""
from __future__ import annotations

from functools import lru_cache
from typing import Any

from fastapi import HTTPException
from supabase import Client, create_client

from app.config import settings


@lru_cache
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
