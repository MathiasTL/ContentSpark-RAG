"""Servicio de calendarios: CRUD, soft gate de completitud, orquestacion del agente.

Unit 2a: `_narrow_profile`, CRUD de lectura (`list_calendars`/`get_calendar`) y la
precondicion del soft gate dentro de `generate_calendar`. El resto del cuerpo de
`generate_calendar` (creacion/reuso de calendario, invocacion del agente,
reemplazo de entries) se completa en Unit 2b.
"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.calendar import ContentCalendar
from app.services.profile_service import profile_service


def _to_uuid(value: str, label: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except (ValueError, AttributeError, TypeError) as exc:
        raise HTTPException(
            status_code=400, detail=f"{label} no es un UUID valido"
        ) from exc


def _narrow_profile(profile: Any) -> dict:
    """Narrowed subset passed into CalendarState — never a raw ORM dump."""
    return {
        "niche": profile.niche,
        "sub_niche": profile.sub_niche,
        "primary_goal": profile.primary_goal,
        "tone": profile.tone,
        "target_audience": profile.target_audience,
        "desired_frequency": profile.desired_frequency,  # free text, unused for parsing
        "preferred_formats": profile.preferred_formats or [],
    }


class CalendarService:
    async def list_calendars(
        self, db: AsyncSession, user_id: str
    ) -> list[ContentCalendar]:
        stmt = (
            select(ContentCalendar)
            .where(ContentCalendar.user_id == _to_uuid(user_id, "user_id"))
            .order_by(ContentCalendar.created_at.desc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_calendar(
        self, db: AsyncSession, user_id: str, calendar_id: str
    ) -> ContentCalendar:
        stmt = (
            select(ContentCalendar)
            .where(
                ContentCalendar.id == _to_uuid(calendar_id, "calendar_id"),
                ContentCalendar.user_id == _to_uuid(user_id, "user_id"),
            )
            .options(selectinload(ContentCalendar.entries))
        )
        result = await db.execute(stmt)
        calendar = result.scalar_one_or_none()
        if calendar is None:
            raise HTTPException(status_code=404, detail="Calendario no encontrado")
        return calendar

    async def generate_calendar(
        self,
        db: AsyncSession,
        user_id: str,
        period: str,
        frequency: int | None,
        formats: dict | None,
        calendar_id: str | None,
    ) -> ContentCalendar:
        # Paso 1 (design.md:483-485): soft gate de completitud de perfil,
        # debe correr antes de cualquier llamada al LLM/RAG o escritura en DB.
        is_complete, missing = await profile_service.get_status(db, user_id)
        if not is_complete:
            raise HTTPException(
                status_code=409,
                detail={
                    "detail": "El perfil del creador esta incompleto",
                    "missing_fields": missing,
                },
            )
        # TODO Unit 2b: pasos 2-5 (design.md:486-496) — cargar/crear calendario
        # objetivo, narrow del perfil, invocar calendar_app.ainvoke, reemplazar
        # entries, actualizar start_date/end_date/frequency y refrescar.
        raise NotImplementedError(
            "generate_calendar: pasos 2-5 se completan en Unit 2b"
        )


calendar_service = CalendarService()
