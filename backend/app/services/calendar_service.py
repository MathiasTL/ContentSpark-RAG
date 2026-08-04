"""Servicio de calendarios: CRUD, soft gate de completitud, orquestacion del agente.

Unit 2b completa `generate_calendar` (pasos 2-5: carga/creacion del calendario
objetivo, invocacion de `calendar_app`, reemplazo de entries) y agrega
`update_entry`, `confirm_calendar`, `delete_calendar` con sus guardas de
estado (design.md §8).
"""
from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.agents import calendar_agent
from app.agents.shared_state import CalendarState
from app.models.calendar import ContentCalendar, ContentEntry
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
        # Paso 1 (design.md:518-519): soft gate de completitud de perfil,
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

        uid = _to_uuid(user_id, "user_id")

        # Paso 2 (design.md:520-521): cargar el calendario objetivo scoped a
        # user_id (404 si no existe, 409 si no esta en draft), o crear uno
        # nuevo en draft. `id` se asigna aqui (no se delega al default de
        # columna) para que este disponible antes del flush final, cuando se
        # insertan las entries via calendar_id explicito.
        if calendar_id:
            # `.with_for_update()` locks the row for the transaction: two
            # concurrent POST /api/calendar/generate for the same
            # calendar_id would otherwise both read status == "draft",
            # both pass the guard below, and both delete-then-insert in
            # independent sessions (TOCTOU race), leaving entries from two
            # runs mixed together.
            stmt = (
                select(ContentCalendar)
                .where(
                    ContentCalendar.id == _to_uuid(calendar_id, "calendar_id"),
                    ContentCalendar.user_id == uid,
                )
                .with_for_update()
            )
            result = await db.execute(stmt)
            calendar = result.scalar_one_or_none()
            if calendar is None:
                raise HTTPException(
                    status_code=404, detail="Calendario no encontrado"
                )
            if calendar.status != "draft":
                raise HTTPException(
                    status_code=409,
                    detail="Solo se puede regenerar un calendario en borrador",
                )
        else:
            today = date.today()
            calendar = ContentCalendar(
                id=uuid.uuid4(),
                user_id=uid,
                status="draft",
                start_date=today,
                end_date=today,
                frequency=frequency or 1,
            )
            db.add(calendar)

        # Paso 3 (design.md:522-523): narrow del perfil, construir el estado
        # inicial e invocar el grafo.
        profile = await profile_service.get_or_create_profile(db, user_id)
        narrowed = _narrow_profile(profile)
        initial_state: CalendarState = {
            "user_id": user_id,
            "profile": narrowed,
            "calendar_id": calendar_id,
            "period": period,
            "frequency": frequency,
            "formats": formats,
        }
        final_state = await calendar_agent.calendar_app.ainvoke(initial_state)

        # Paso 4 (design.md:524-527): delete-then-insert de ContentEntry,
        # mismo patron que `_replace_social_accounts`.
        await db.execute(delete(ContentEntry).where(ContentEntry.calendar_id == calendar.id))
        for entry in final_state["calendar_entries"]:
            db.add(ContentEntry(calendar_id=calendar.id, **entry))

        # Paso 5 (design.md:528-530): actualizar campos resueltos y refrescar
        # con entries eager-loaded.
        calendar.start_date = final_state["start_date"]
        calendar.end_date = final_state["end_date"]
        calendar.frequency = final_state["frequency"]

        await db.flush()
        await db.refresh(calendar, attribute_names=["entries"])
        return calendar

    async def update_entry(
        self,
        db: AsyncSession,
        user_id: str,
        calendar_id: str,
        entry_id: str,
        **fields: Any,
    ) -> ContentEntry:
        # Independiente del status del calendario padre (draft/confirmed/synced)
        # — la unica guarda es ownership + pertenencia al calendario dado.
        stmt = (
            select(ContentEntry)
            .join(ContentCalendar, ContentEntry.calendar_id == ContentCalendar.id)
            .where(
                ContentEntry.id == _to_uuid(entry_id, "entry_id"),
                ContentEntry.calendar_id == _to_uuid(calendar_id, "calendar_id"),
                ContentCalendar.user_id == _to_uuid(user_id, "user_id"),
            )
        )
        result = await db.execute(stmt)
        entry = result.scalar_one_or_none()
        if entry is None:
            raise HTTPException(status_code=404, detail="Entrada no encontrada")
        for key, value in fields.items():
            if hasattr(entry, key):
                setattr(entry, key, value)
        await db.flush()
        await db.refresh(entry)
        return entry

    async def confirm_calendar(
        self, db: AsyncSession, user_id: str, calendar_id: str
    ) -> ContentCalendar:
        calendar = await self.get_calendar(db, user_id, calendar_id)
        if calendar.status != "draft":
            raise HTTPException(
                status_code=409, detail="Solo se puede confirmar un calendario en borrador"
            )
        calendar.status = "confirmed"
        await db.flush()
        await db.refresh(calendar)
        return calendar

    async def delete_calendar(
        self, db: AsyncSession, user_id: str, calendar_id: str
    ) -> None:
        calendar = await self.get_calendar(db, user_id, calendar_id)
        if calendar.status == "synced":
            # Ruling explicito del usuario: eliminar un calendario sincronizado
            # dejaria huerfanos los eventos ya empujados a Google Calendar
            # (Fase 4) — no se relaja esta guarda.
            raise HTTPException(
                status_code=409,
                detail="No se puede eliminar un calendario sincronizado",
            )
        await db.delete(calendar)
        await db.flush()


calendar_service = CalendarService()
