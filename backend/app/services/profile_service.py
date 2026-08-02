"""Servicio de perfil: regla de completitud derivada + CRUD."""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
        stmt = select(CreatorProfile).where(CreatorProfile.user_id == uid)
        result = await db.execute(stmt)
        profile = result.scalar_one_or_none()
        if profile is None:
            profile = CreatorProfile(user_id=uid)
            db.add(profile)
            await db.flush()
            await db.refresh(profile)
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
        social_accounts = fields.pop("social_accounts", None)
        profile = await self.get_or_create_profile(db, user_id)
        for key, value in fields.items():
            if value is not None and hasattr(profile, key):
                setattr(profile, key, value)
        if social_accounts is not None:
            await self._replace_social_accounts(db, profile, social_accounts)
        await db.flush()
        await db.refresh(profile)
        return profile

    async def complete_onboarding(
        self, db: AsyncSession, user_id: str, payload: Any
    ) -> CreatorProfile:
        data = payload.model_dump() if hasattr(payload, "model_dump") else dict(payload)
        social_accounts = data.pop("social_accounts", None)
        profile = await self.get_or_create_profile(db, user_id)
        for key, value in data.items():
            if hasattr(profile, key):
                setattr(profile, key, value)
        if social_accounts is not None:
            await self._replace_social_accounts(db, profile, social_accounts)
        await db.flush()
        await db.refresh(profile)
        return profile

    async def _replace_social_accounts(
        self, db: AsyncSession, profile: CreatorProfile, accounts: list[Any]
    ) -> None:
        """Reemplaza las cuentas sociales del perfil por las recibidas."""
        for existing in list(profile.social_accounts):
            await db.delete(existing)
        for account in accounts:
            data = account.model_dump() if hasattr(account, "model_dump") else dict(account)
            db.add(SocialAccount(profile_id=profile.id, **data))
        await db.flush()


profile_service = ProfileService()
