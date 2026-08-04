"""Tests del servicio de calendario.

Unit 2a: CRUD skeleton (list/get) + soft gate de completitud de perfil.
Unit 2b: `generate_calendar` pasos 2-5, `update_entry`, `confirm_calendar`,
`delete_calendar` y sus guardas de estado.
"""
from __future__ import annotations

import uuid
from datetime import date
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


USER_ID = "11111111-1111-1111-1111-111111111111"
OTHER_USER_ID = "22222222-2222-2222-2222-222222222222"


def _fake_final_state(**overrides) -> dict:
    base = {
        "start_date": date(2026, 8, 3),
        "end_date": date(2026, 8, 9),
        "frequency": 4,
        "calendar_entries": [
            {
                "title": "Idea 1",
                "format": "short_video",
                "platform": "tiktok",
                "hook": "Hook 1",
                "description": "Desc 1",
                "date": date(2026, 8, 4),
                "time_slot": "morning",
            },
            {
                "title": "Idea 2",
                "format": "post",
                "platform": "linkedin",
                "hook": "Hook 2",
                "description": "Desc 2",
                "date": date(2026, 8, 6),
                "time_slot": "afternoon",
            },
        ],
    }
    base.update(overrides)
    return base


def _patch_soft_gate_and_profile(monkeypatch, is_complete=True, missing=None):
    from app.services import calendar_service as calendar_service_module

    get_status_mock = AsyncMock(return_value=(is_complete, missing or []))
    monkeypatch.setattr(
        calendar_service_module.profile_service, "get_status", get_status_mock
    )
    fake_profile = _fake_creator_profile()
    get_or_create_mock = AsyncMock(return_value=fake_profile)
    monkeypatch.setattr(
        calendar_service_module.profile_service,
        "get_or_create_profile",
        get_or_create_mock,
    )
    return get_status_mock, get_or_create_mock


def _patch_calendar_app(monkeypatch, final_state: dict) -> AsyncMock:
    mock_calendar_app = AsyncMock()
    mock_calendar_app.ainvoke = AsyncMock(return_value=final_state)
    monkeypatch.setattr(
        "app.agents.calendar_agent.calendar_app", mock_calendar_app, raising=False
    )
    return mock_calendar_app


# --- generate_calendar — no calendar_id: creates a new draft ---------------


@pytest.mark.asyncio
async def test_generate_calendar_without_calendar_id_creates_new_draft(monkeypatch):
    """Sin `calendar_id`, se crea un `ContentCalendar(status='draft')` nuevo
    y se invoca `calendar_app.ainvoke` con un `CalendarState` narrowed."""
    service = CalendarService()
    db = AsyncMock()
    db.add = MagicMock()
    db.execute = AsyncMock(return_value=MagicMock())

    _patch_soft_gate_and_profile(monkeypatch)
    final_state = _fake_final_state()
    mock_calendar_app = _patch_calendar_app(monkeypatch, final_state)

    result = await service.generate_calendar(
        db,
        USER_ID,
        period="current_week",
        frequency=None,
        formats=None,
        calendar_id=None,
    )

    assert result.status == "draft"
    assert result.user_id == uuid.UUID(USER_ID)
    assert result.start_date == final_state["start_date"]
    assert result.end_date == final_state["end_date"]
    assert result.frequency == final_state["frequency"]

    mock_calendar_app.ainvoke.assert_awaited_once()
    invoked_state = mock_calendar_app.ainvoke.call_args.args[0]
    assert invoked_state["calendar_id"] is None
    assert invoked_state["period"] == "current_week"
    assert invoked_state["profile"]["niche"] == "marketing"

    added_types = [type(call.args[0]).__name__ for call in db.add.call_args_list]
    assert added_types.count("ContentCalendar") == 1
    assert added_types.count("ContentEntry") == 2

    db.flush.assert_awaited()
    db.refresh.assert_awaited_once()
    assert db.refresh.call_args.kwargs.get("attribute_names") == ["entries"]


# --- generate_calendar — calendar_id targeting a draft calendar ------------


@pytest.mark.asyncio
async def test_generate_calendar_with_draft_calendar_id_reuses_and_replaces_entries(
    monkeypatch,
):
    """Con `calendar_id` apuntando a un draft propio, se reusa la fila y se
    reemplazan sus entries (delete-then-insert)."""
    service = CalendarService()
    existing = SimpleNamespace(
        id=uuid.uuid4(),
        user_id=uuid.UUID(USER_ID),
        status="draft",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 7),
        frequency=3,
    )

    select_result = MagicMock()
    select_result.scalar_one_or_none.return_value = existing
    delete_result = MagicMock()
    db = AsyncMock()
    db.add = MagicMock()
    db.execute = AsyncMock(side_effect=[select_result, delete_result])

    _patch_soft_gate_and_profile(monkeypatch)
    final_state = _fake_final_state()
    mock_calendar_app = _patch_calendar_app(monkeypatch, final_state)

    result = await service.generate_calendar(
        db,
        USER_ID,
        period="month",
        frequency=None,
        formats=None,
        calendar_id=str(existing.id),
    )

    assert result is existing
    assert result.status == "draft"
    assert result.frequency == final_state["frequency"]
    mock_calendar_app.ainvoke.assert_awaited_once()
    # No se crea un ContentCalendar nuevo — solo se agregan las 2 entries.
    added_types = [type(call.args[0]).__name__ for call in db.add.call_args_list]
    assert "ContentCalendar" not in added_types
    assert added_types.count("ContentEntry") == 2
    delete_stmt = db.execute.call_args_list[1].args[0]
    compiled = str(delete_stmt.compile(compile_kwargs={"literal_binds": True}))
    assert "content_entries.calendar_id" in compiled


# --- generate_calendar — calendar_id targeting a non-draft calendar --------


@pytest.mark.asyncio
async def test_generate_calendar_with_non_draft_calendar_id_raises_409(monkeypatch):
    """Regenerar un calendario `confirmed`/`synced` es rechazado con 409, sin
    tocar entries ni invocar el agente."""
    service = CalendarService()
    existing = SimpleNamespace(
        id=uuid.uuid4(), user_id=uuid.UUID(USER_ID), status="confirmed"
    )

    select_result = MagicMock()
    select_result.scalar_one_or_none.return_value = existing
    db = AsyncMock()
    db.execute = AsyncMock(return_value=select_result)

    _patch_soft_gate_and_profile(monkeypatch)
    mock_calendar_app = _patch_calendar_app(monkeypatch, _fake_final_state())

    with pytest.raises(HTTPException) as exc_info:
        await service.generate_calendar(
            db,
            USER_ID,
            period="current_week",
            frequency=None,
            formats=None,
            calendar_id=str(existing.id),
        )

    assert exc_info.value.status_code == 409
    mock_calendar_app.ainvoke.assert_not_awaited()


# --- generate_calendar — calendar_id targeting another user's calendar -----


@pytest.mark.asyncio
async def test_generate_calendar_with_other_users_calendar_id_raises_404(monkeypatch):
    """`calendar_id` que no resuelve scoped a `user_id` es un 404, no un 403."""
    service = CalendarService()

    select_result = MagicMock()
    select_result.scalar_one_or_none.return_value = None
    db = AsyncMock()
    db.execute = AsyncMock(return_value=select_result)

    _patch_soft_gate_and_profile(monkeypatch)
    mock_calendar_app = _patch_calendar_app(monkeypatch, _fake_final_state())

    with pytest.raises(HTTPException) as exc_info:
        await service.generate_calendar(
            db,
            USER_ID,
            period="current_week",
            frequency=None,
            formats=None,
            calendar_id=str(uuid.uuid4()),
        )

    assert exc_info.value.status_code == 404
    mock_calendar_app.ainvoke.assert_not_awaited()


# --- confirm_calendar --------------------------------------------------


@pytest.mark.asyncio
async def test_confirm_calendar_transitions_draft_to_confirmed(monkeypatch):
    service = CalendarService()
    calendar = SimpleNamespace(
        id=uuid.uuid4(), user_id=uuid.UUID(USER_ID), status="draft"
    )
    execute_result = MagicMock()
    execute_result.scalar_one_or_none.return_value = calendar
    db = AsyncMock()
    db.execute = AsyncMock(return_value=execute_result)

    result = await service.confirm_calendar(db, USER_ID, str(calendar.id))

    assert result.status == "confirmed"
    db.flush.assert_awaited()
    db.refresh.assert_awaited()


@pytest.mark.asyncio
async def test_confirm_calendar_twice_raises_409(monkeypatch):
    service = CalendarService()
    calendar = SimpleNamespace(
        id=uuid.uuid4(), user_id=uuid.UUID(USER_ID), status="confirmed"
    )
    execute_result = MagicMock()
    execute_result.scalar_one_or_none.return_value = calendar
    db = AsyncMock()
    db.execute = AsyncMock(return_value=execute_result)

    with pytest.raises(HTTPException) as exc_info:
        await service.confirm_calendar(db, USER_ID, str(calendar.id))

    assert exc_info.value.status_code == 409
    assert calendar.status == "confirmed"


# --- delete_calendar --------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize("status", ["draft", "confirmed"])
async def test_delete_calendar_succeeds_on_draft_and_confirmed(monkeypatch, status):
    service = CalendarService()
    calendar = SimpleNamespace(id=uuid.uuid4(), user_id=uuid.UUID(USER_ID), status=status)
    execute_result = MagicMock()
    execute_result.scalar_one_or_none.return_value = calendar
    db = AsyncMock()
    db.execute = AsyncMock(return_value=execute_result)

    await service.delete_calendar(db, USER_ID, str(calendar.id))

    db.delete.assert_awaited_once_with(calendar)
    db.flush.assert_awaited()


@pytest.mark.asyncio
async def test_delete_calendar_on_synced_raises_409(monkeypatch):
    """Eliminar un calendario `synced` se rechaza — dejaria huerfanos los
    eventos ya empujados a Google Calendar en Fase 4."""
    service = CalendarService()
    calendar = SimpleNamespace(id=uuid.uuid4(), user_id=uuid.UUID(USER_ID), status="synced")
    execute_result = MagicMock()
    execute_result.scalar_one_or_none.return_value = calendar
    db = AsyncMock()
    db.execute = AsyncMock(return_value=execute_result)

    with pytest.raises(HTTPException) as exc_info:
        await service.delete_calendar(db, USER_ID, str(calendar.id))

    assert exc_info.value.status_code == 409
    db.delete.assert_not_awaited()


# --- update_entry --------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize("calendar_status", ["draft", "confirmed", "synced"])
async def test_update_entry_succeeds_regardless_of_calendar_status(
    monkeypatch, calendar_status
):
    """`update_entry` nunca consulta ni depende del status del calendario
    padre — succeeds identically for draft/confirmed/synced."""
    service = CalendarService()
    entry = SimpleNamespace(
        id=uuid.uuid4(), calendar_id=uuid.uuid4(), title="Old title", status="idea"
    )
    execute_result = MagicMock()
    execute_result.scalar_one_or_none.return_value = entry
    db = AsyncMock()
    db.execute = AsyncMock(return_value=execute_result)

    result = await service.update_entry(
        db, USER_ID, str(entry.calendar_id), str(entry.id), title="New title"
    )

    assert result.title == "New title"
    stmt = db.execute.call_args.args[0]
    compiled = str(stmt.compile(compile_kwargs={"literal_binds": True}))
    assert "content_calendars.user_id" in compiled
    assert "content_entries.calendar_id" in compiled
    db.flush.assert_awaited()
    db.refresh.assert_awaited()


@pytest.mark.asyncio
async def test_update_entry_not_belonging_to_calendar_raises_404(monkeypatch):
    service = CalendarService()
    execute_result = MagicMock()
    execute_result.scalar_one_or_none.return_value = None
    db = AsyncMock()
    db.execute = AsyncMock(return_value=execute_result)

    with pytest.raises(HTTPException) as exc_info:
        await service.update_entry(
            db, USER_ID, str(uuid.uuid4()), str(uuid.uuid4()), title="New title"
        )

    assert exc_info.value.status_code == 404
