# Fase 3: Endpoints del calendario de contenido
"""Router del calendario de contenido: generacion, CRUD y ciclo de vida de estado."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.schemas.calendar import (
    CalendarDetailResponse,
    CalendarGenerateRequest,
    CalendarResponse,
    EntryResponse,
    EntryUpdate,
)
from app.services.calendar_service import calendar_service

router = APIRouter(prefix="/api", tags=["calendar"])


@router.post("/calendar/generate", response_model=CalendarDetailResponse)
async def post_generate(
    payload: CalendarGenerateRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> CalendarDetailResponse:
    calendar = await calendar_service.generate_calendar(
        db,
        user_id,
        period=payload.period,
        frequency=payload.frequency,
        formats=payload.formats,
        calendar_id=payload.calendar_id,
    )
    return CalendarDetailResponse.model_validate(calendar)


@router.get("/calendars", response_model=list[CalendarResponse])
async def get_calendars(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> list[CalendarResponse]:
    calendars = await calendar_service.list_calendars(db, user_id)
    return [CalendarResponse.model_validate(c) for c in calendars]


@router.get("/calendars/{calendar_id}", response_model=CalendarDetailResponse)
async def get_calendar_detail(
    calendar_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> CalendarDetailResponse:
    calendar = await calendar_service.get_calendar(db, user_id, calendar_id)
    return CalendarDetailResponse.model_validate(calendar)


@router.put(
    "/calendars/{calendar_id}/entries/{entry_id}", response_model=EntryResponse
)
async def put_entry(
    calendar_id: str,
    entry_id: str,
    payload: EntryUpdate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> EntryResponse:
    # Distingue "campo omitido" (no tocar) de "campo enviado con null
    # explicito" (limpiarlo) — mismo patron que profile.py's put_profile
    # (JD-1): se usa `include=model_fields_set` en vez de `exclude_unset=True`.
    entry = await calendar_service.update_entry(
        db,
        user_id,
        calendar_id,
        entry_id,
        **payload.model_dump(include=payload.model_fields_set),
    )
    return EntryResponse.model_validate(entry)


@router.post("/calendars/{calendar_id}/confirm", response_model=CalendarResponse)
async def post_confirm(
    calendar_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> CalendarResponse:
    calendar = await calendar_service.confirm_calendar(db, user_id, calendar_id)
    return CalendarResponse.model_validate(calendar)


@router.delete("/calendars/{calendar_id}", status_code=204)
async def delete_calendar(
    calendar_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> Response:
    await calendar_service.delete_calendar(db, user_id, calendar_id)
    return Response(status_code=204)
