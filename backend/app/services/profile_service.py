"""Servicio de perfil: regla de completitud derivada + CRUD."""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.profile import CreatorProfile, SocialAccount

REQUIRED_PROFILE_FIELDS: tuple[str, ...] = (
    "niche",
    "primary_goal",
    "tone",
    "target_audience",
)


def _to_uuid(value: str, label: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except (ValueError, AttributeError, TypeError) as exc:
        raise HTTPException(
            status_code=400, detail=f"{label} no es un UUID valido"
        ) from exc


def _missing_fields(profile: Any) -> list[str]:
    """Campos requeridos ausentes o vacios/blancos. `None` implica todos faltantes."""
    if profile is None:
        return list(REQUIRED_PROFILE_FIELDS)
    missing = []
    for field in REQUIRED_PROFILE_FIELDS:
        value = getattr(profile, field, None)
        if value is None or (isinstance(value, str) and not value.strip()):
            missing.append(field)
    return missing


class ProfileService:
    async def get_or_create_profile(
        self, db: AsyncSession, user_id: str
    ) -> CreatorProfile:
        uid = _to_uuid(user_id, "user_id")
        stmt = (
            select(CreatorProfile)
            .options(selectinload(CreatorProfile.social_accounts))
            .where(CreatorProfile.user_id == uid)
        )
        result = await db.execute(stmt)
        profile = result.scalar_one_or_none()
        if profile is None:
            profile = CreatorProfile(user_id=uid)
            db.add(profile)
            await db.flush()
            await db.refresh(profile)
            await db.refresh(profile, attribute_names=["social_accounts"])
        return profile

    async def get_status(
        self, db: AsyncSession, user_id: str
    ) -> tuple[bool, list[str]]:
        uid = _to_uuid(user_id, "user_id")
        stmt = select(CreatorProfile).where(CreatorProfile.user_id == uid)
        result = await db.execute(stmt)
        profile = result.scalar_one_or_none()
        missing = _missing_fields(profile)
        return (not missing, missing)

    async def update_profile(
        self, db: AsyncSession, user_id: str, **fields: Any
    ) -> CreatorProfile:
        # `fields` ya viene filtrado por el router via `model_fields_set`:
        # una clave AUSENTE significa "no tocar", una clave presente con
        # valor `None` significa "limpiar explicitamente" (JD-1).
        social_accounts = fields.pop("social_accounts", None)
        profile = await self.get_or_create_profile(db, user_id)
        for key, value in fields.items():
            if hasattr(profile, key):
                setattr(profile, key, value)
        if social_accounts is not None:
            await self._replace_social_accounts(db, profile, social_accounts)
        await db.flush()
        await db.refresh(profile)
        # `refresh()` expira TODAS las relaciones ya cargadas (incluso las
        # que trajo el `selectinload` de `get_or_create_profile`), aunque no
        # se hayan tocado en este request. Sin este refresh explicito,
        # `social_accounts` queda expirada y dispara un lazy-load sincronico
        # al serializar la respuesta -> MissingGreenlet.
        await db.refresh(profile, attribute_names=["social_accounts"])
        return profile

    async def complete_onboarding(
        self, db: AsyncSession, user_id: str, payload: Any
    ) -> CreatorProfile:
        # Aplica el mismo contrato que `update_profile`: un campo opcional
        # omitido en el reenvio del onboarding no debe sobreescribir el
        # valor ya guardado (JD-2). Se usa `include=model_fields_set` (no
        # `exclude_unset=True`) para no recortar tambien los campos
        # no-enviados de modelos anidados como `social_accounts`.
        # `dict(payload)` se mantiene como fallback para llamadas de test
        # con dicts crudos, donde las claves presentes ya representan
        # "explicitamente enviado".
        data = (
            payload.model_dump(include=payload.model_fields_set)
            if hasattr(payload, "model_dump")
            else dict(payload)
        )
        social_accounts = data.pop("social_accounts", None)
        profile = await self.get_or_create_profile(db, user_id)
        for key, value in data.items():
            if hasattr(profile, key):
                setattr(profile, key, value)
        if social_accounts is not None:
            await self._replace_social_accounts(db, profile, social_accounts)
        await db.flush()
        await db.refresh(profile)
        await db.refresh(profile, attribute_names=["social_accounts"])
        return profile

    async def _replace_social_accounts(
        self, db: AsyncSession, profile: CreatorProfile, accounts: list[Any]
    ) -> None:
        """Reemplaza las cuentas sociales del perfil por las recibidas."""
        stmt = select(SocialAccount).where(SocialAccount.profile_id == profile.id)
        result = await db.execute(stmt)
        for existing in result.scalars().all():
            await db.delete(existing)
        for account in accounts:
            data = account.model_dump() if hasattr(account, "model_dump") else dict(account)
            db.add(SocialAccount(profile_id=profile.id, **data))
        await db.flush()


profile_service = ProfileService()
