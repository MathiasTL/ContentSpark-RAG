"""Helpers de autenticacion para Supabase Auth."""

from functools import lru_cache

from fastapi import HTTPException
from supabase import Client, create_client

from app.config import settings


@lru_cache()
def get_supabase_admin() -> Client:
	"""Crea un cliente Supabase con service role key (sb_secret_...)."""
	if not settings.supabase_url or not settings.supabase_service_role_key:
		raise RuntimeError("Supabase credentials missing")
	return create_client(settings.supabase_url, settings.supabase_service_role_key)


def _extract_user_id(user: object) -> str | None:
	if user is None:
		return None
	if isinstance(user, dict):
		return user.get("id")
	return getattr(user, "id", None)


def verify_supabase_token(token: str) -> str:
	"""Verifica el token via Supabase Auth y retorna el user_id."""
	if not token:
		raise HTTPException(status_code=401, detail="Token de autenticacion requerido")

	try:
		supabase_admin = get_supabase_admin()
		response = supabase_admin.auth.get_user(token)
		user = getattr(response, "user", None)
		if user is None and isinstance(response, dict):
			user = response.get("user")

		user_id = _extract_user_id(user)
		if not user_id:
			raise HTTPException(status_code=401, detail="Token invalido")
		return user_id
	except HTTPException:
		raise
	except Exception as exc:
		print(f"Auth error: {exc}")
		raise HTTPException(status_code=401, detail="Error de autenticacion")
