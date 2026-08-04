"""Tests del servicio de calendario (Fase 2, Unit 2a - CRUD skeleton + soft gate)."""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.services.calendar_service import CalendarService, _narrow_profile


# --- _narrow_profile ------------------------------------------------------


def _fake_creator_profile(**overrides):
    base = {
        "niche": "marketing",
        "sub_niche": "b2b",
        "primary_goal": "crecer",
        "tone": "cercano",
        "target_audience": "emprendedores",
        "desired_frequency": "3 por semana",
        "preferred_formats": ["short_video", "post"],
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def test_narrow_profile_returns_exactly_seven_keys():
    """`_narrow_profile` expone exactamente el subconjunto de 7 campos del diseno."""
    profile = _fake_creator_profile()
    narrowed = _narrow_profile(profile)
    assert narrowed == {
        "niche": "marketing",
        "sub_niche": "b2b",
        "primary_goal": "crecer",
        "tone": "cercano",
        "target_audience": "emprendedores",
        "desired_frequency": "3 por semana",
        "preferred_formats": ["short_video", "post"],
    }


def test_narrow_profile_defaults_preferred_formats_to_empty_list():
    """`preferred_formats` nulo se normaliza a lista vacia, nunca `None`."""
    profile = _fake_creator_profile(preferred_formats=None)
    narrowed = _narrow_profile(profile)
    assert narrowed["preferred_formats"] == []


# --- list_calendars / get_calendar — ownership scoping ---------------------


@pytest.mark.asyncio
async def test_list_calendars_scopes_query_by_user_id(monkeypatch):
    """`list_calendars` filtra la query por `user_id`, nunca devuelve datos de otro usuario."""
    service = CalendarService()
    fake_calendars = [SimpleNamespace(id="cal-1"), SimpleNamespace(id="cal-2")]

    scalars_result = MagicMock()
    scalars_result.all.return_value = fake_calendars
    execute_result = MagicMock()
    execute_result.scalars.return_value = scalars_result

    db = AsyncMock()
    db.execute = AsyncMock(return_value=execute_result)

    result = await service.list_calendars(db, "11111111-1111-1111-1111-111111111111")

    assert result == fake_calendars
    db.execute.assert_awaited_once()
    stmt = db.execute.call_args.args[0]
    compiled = str(stmt.compile(compile_kwargs={"literal_binds": True}))
    assert "content_calendars.user_id" in compiled


@pytest.mark.asyncio
async def test_get_calendar_not_owned_raises_404(monkeypatch):
    """Un calendario que no pertenece al usuario autenticado resuelve como 404."""
    service = CalendarService()

    execute_result = MagicMock()
    execute_result.scalar_one_or_none.return_value = None
    db = AsyncMock()
    db.execute = AsyncMock(return_value=execute_result)

    with pytest.raises(HTTPException) as exc_info:
        await service.get_calendar(
            db,
            "11111111-1111-1111-1111-111111111111",
            "22222222-2222-2222-2222-222222222222",
        )

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_get_calendar_found_scopes_by_user_id_in_query(monkeypatch):
    """`get_calendar` construye la query filtrando por `calendar_id` y `user_id`."""
    service = CalendarService()
    fake_calendar = SimpleNamespace(id="cal-1")

    execute_result = MagicMock()
    execute_result.scalar_one_or_none.return_value = fake_calendar
    db = AsyncMock()
    db.execute = AsyncMock(return_value=execute_result)

    result = await service.get_calendar(
        db,
        "11111111-1111-1111-1111-111111111111",
        "22222222-2222-2222-2222-222222222222",
    )

    assert result is fake_calendar
    stmt = db.execute.call_args.args[0]
    compiled = str(stmt.compile(compile_kwargs={"literal_binds": True}))
    assert "content_calendars.user_id" in compiled
    assert "content_calendars.id" in compiled


# --- generate_calendar — soft gate (profile completion) --------------------


@pytest.mark.asyncio
async def test_generate_calendar_raises_409_when_profile_incomplete(monkeypatch):
    """El soft gate rechaza la generacion con 409 antes de invocar al agente."""
    service = CalendarService()
    db = AsyncMock()

    from app.services import calendar_service as calendar_service_module

    get_status_mock = AsyncMock(return_value=(False, ["niche", "tone"]))
    monkeypatch.setattr(
        calendar_service_module.profile_service, "get_status", get_status_mock
    )

    mock_calendar_app = AsyncMock()
    monkeypatch.setattr(
        "app.agents.calendar_agent.calendar_app", mock_calendar_app, raising=False
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.generate_calendar(
            db,
            "11111111-1111-1111-1111-111111111111",
            period="current_week",
            frequency=None,
            formats=None,
            calendar_id=None,
        )

    assert exc_info.value.status_code == 409
    detail = exc_info.value.detail
    assert detail["detail"]
    assert detail["missing_fields"] == ["niche", "tone"]
    get_status_mock.assert_awaited_once_with(
        db, "11111111-1111-1111-1111-111111111111"
    )
    mock_calendar_app.ainvoke.assert_not_awaited()


@pytest.mark.asyncio
async def test_generate_calendar_proceeds_past_gate_when_profile_complete(
    monkeypatch,
):
    """Con perfil completo, el gate no dispara: el resto del cuerpo esta stubbed en 2b."""
    service = CalendarService()
    db = AsyncMock()

    from app.services import calendar_service as calendar_service_module

    get_status_mock = AsyncMock(return_value=(True, []))
    monkeypatch.setattr(
        calendar_service_module.profile_service, "get_status", get_status_mock
    )

    with pytest.raises(NotImplementedError):
        await service.generate_calendar(
            db,
            "11111111-1111-1111-1111-111111111111",
            period="current_week",
            frequency=None,
            formats=None,
            calendar_id=None,
        )

    get_status_mock.assert_awaited_once_with(
        db, "11111111-1111-1111-1111-111111111111"
    )
