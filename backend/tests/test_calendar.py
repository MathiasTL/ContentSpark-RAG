# Tests del calendario — Fase 5 (Unit 5)
"""Tests del router de calendario: generacion, CRUD y ciclo de vida de estado."""
from __future__ import annotations

from datetime import date
from types import SimpleNamespace

from fastapi import HTTPException

CALENDAR_ID = "44444444-4444-4444-4444-444444444444"
ENTRY_ID = "33333333-3333-3333-3333-333333333333"


def _fake_entry(**overrides):
    base = dict(
        id=ENTRY_ID,
        calendar_id=CALENDAR_ID,
        date=date(2026, 8, 3),
        time_slot=None,
        title="Titulo del video",
        format="short_video",
        platform="tiktok",
        hook=None,
        description=None,
        status="idea",
        google_calendar_event_id=None,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def _fake_calendar(**overrides):
    base = dict(
        id=CALENDAR_ID,
        name=None,
        start_date=date(2026, 8, 3),
        end_date=date(2026, 8, 9),
        frequency=3,
        status="draft",
        entries=[],
    )
    base.update(overrides)
    return SimpleNamespace(**base)


AUTH_HEADER = {"Authorization": "Bearer valid"}


# --- POST /api/calendar/generate ---


def test_generate_happy_path_returns_calendar_with_entries(
    client, patch_calendar_service
):
    calendar = _fake_calendar(entries=[_fake_entry()])
    patch_calendar_service.generate_calendar.return_value = calendar

    response = client.post(
        "/api/calendar/generate",
        headers=AUTH_HEADER,
        json={"period": "current_week"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "draft"
    assert len(body["entries"]) == 1
    patch_calendar_service.generate_calendar.assert_awaited_once()


def test_generate_incomplete_profile_returns_409_with_missing_fields(
    client, patch_calendar_service
):
    patch_calendar_service.generate_calendar.side_effect = HTTPException(
        status_code=409,
        detail={
            "detail": "El perfil del creador esta incompleto",
            "missing_fields": ["niche", "tone"],
        },
    )

    response = client.post(
        "/api/calendar/generate",
        headers=AUTH_HEADER,
        json={"period": "current_week"},
    )

    assert response.status_code == 409
    body = response.json()
    assert body["detail"]["missing_fields"] == ["niche", "tone"]


def test_generate_with_calendar_id_not_owned_returns_404(
    client, patch_calendar_service
):
    patch_calendar_service.generate_calendar.side_effect = HTTPException(
        status_code=404, detail="Calendario no encontrado"
    )

    response = client.post(
        "/api/calendar/generate",
        headers=AUTH_HEADER,
        json={"period": "current_week", "calendar_id": CALENDAR_ID},
    )

    assert response.status_code == 404


def test_generate_with_calendar_id_non_draft_returns_409(
    client, patch_calendar_service
):
    patch_calendar_service.generate_calendar.side_effect = HTTPException(
        status_code=409, detail="Solo se puede regenerar un calendario en borrador"
    )

    response = client.post(
        "/api/calendar/generate",
        headers=AUTH_HEADER,
        json={"period": "current_week", "calendar_id": CALENDAR_ID},
    )

    assert response.status_code == 409


def test_generate_invalid_period_returns_422_no_service_call(
    client, patch_calendar_service
):
    response = client.post(
        "/api/calendar/generate",
        headers=AUTH_HEADER,
        json={"period": "invalid_period"},
    )

    assert response.status_code == 422
    patch_calendar_service.generate_calendar.assert_not_awaited()


def test_generate_without_token_returns_401(client):
    response = client.post("/api/calendar/generate", json={"period": "current_week"})
    assert response.status_code == 401


# --- GET /api/calendars ---


def test_list_calendars_returns_caller_scoped_list(client, patch_calendar_service):
    patch_calendar_service.list_calendars.return_value = [
        _fake_calendar(),
        _fake_calendar(id="55555555-5555-5555-5555-555555555555"),
    ]

    response = client.get("/api/calendars", headers=AUTH_HEADER)

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2
    patch_calendar_service.list_calendars.assert_awaited_once()


def test_list_calendars_without_token_returns_401(client):
    response = client.get("/api/calendars")
    assert response.status_code == 401


# --- GET /api/calendars/{id} ---


def test_get_calendar_detail_returns_calendar_with_entries(
    client, patch_calendar_service
):
    patch_calendar_service.get_calendar.return_value = _fake_calendar(
        entries=[_fake_entry()]
    )

    response = client.get(f"/api/calendars/{CALENDAR_ID}", headers=AUTH_HEADER)

    assert response.status_code == 200
    body = response.json()
    assert len(body["entries"]) == 1


def test_get_calendar_detail_unknown_id_returns_404(client, patch_calendar_service):
    patch_calendar_service.get_calendar.side_effect = HTTPException(
        status_code=404, detail="Calendario no encontrado"
    )

    response = client.get(f"/api/calendars/{CALENDAR_ID}", headers=AUTH_HEADER)

    assert response.status_code == 404


def test_get_calendar_detail_without_token_returns_401(client):
    response = client.get(f"/api/calendars/{CALENDAR_ID}")
    assert response.status_code == 401


# --- PUT /api/calendars/{id}/entries/{entry_id} ---


def test_put_entry_updates_title(client, patch_calendar_service):
    patch_calendar_service.update_entry.return_value = _fake_entry(
        title="Nuevo titulo"
    )

    response = client.put(
        f"/api/calendars/{CALENDAR_ID}/entries/{ENTRY_ID}",
        headers=AUTH_HEADER,
        json={"title": "Nuevo titulo"},
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Nuevo titulo"
    kwargs = patch_calendar_service.update_entry.call_args.kwargs
    assert kwargs == {"title": "Nuevo titulo"}


def test_put_entry_omitted_field_excluded_from_kwargs(client, patch_calendar_service):
    """Un campo no enviado en el body no debe llegar como kwarg al servicio."""
    patch_calendar_service.update_entry.return_value = _fake_entry(status="recorded")

    response = client.put(
        f"/api/calendars/{CALENDAR_ID}/entries/{ENTRY_ID}",
        headers=AUTH_HEADER,
        json={"status": "recorded"},
    )

    assert response.status_code == 200
    kwargs = patch_calendar_service.update_entry.call_args.kwargs
    assert kwargs == {"status": "recorded"}
    assert "title" not in kwargs


def test_put_entry_not_found_returns_404(client, patch_calendar_service):
    patch_calendar_service.update_entry.side_effect = HTTPException(
        status_code=404, detail="Entrada no encontrada"
    )

    response = client.put(
        f"/api/calendars/{CALENDAR_ID}/entries/{ENTRY_ID}",
        headers=AUTH_HEADER,
        json={"title": "x"},
    )

    assert response.status_code == 404


def test_put_entry_invalid_status_returns_422_no_service_call(
    client, patch_calendar_service
):
    response = client.put(
        f"/api/calendars/{CALENDAR_ID}/entries/{ENTRY_ID}",
        headers=AUTH_HEADER,
        json={"status": "not_a_valid_status"},
    )

    assert response.status_code == 422
    patch_calendar_service.update_entry.assert_not_awaited()


def test_put_entry_without_token_returns_401(client):
    response = client.put(
        f"/api/calendars/{CALENDAR_ID}/entries/{ENTRY_ID}", json={"title": "x"}
    )
    assert response.status_code == 401


# --- POST /api/calendars/{id}/confirm ---


def test_confirm_draft_calendar_returns_confirmed(client, patch_calendar_service):
    patch_calendar_service.confirm_calendar.return_value = _fake_calendar(
        status="confirmed"
    )

    response = client.post(
        f"/api/calendars/{CALENDAR_ID}/confirm", headers=AUTH_HEADER
    )

    assert response.status_code == 200
    assert response.json()["status"] == "confirmed"


def test_confirm_not_found_returns_404(client, patch_calendar_service):
    patch_calendar_service.confirm_calendar.side_effect = HTTPException(
        status_code=404, detail="Calendario no encontrado"
    )

    response = client.post(
        f"/api/calendars/{CALENDAR_ID}/confirm", headers=AUTH_HEADER
    )

    assert response.status_code == 404


def test_confirm_already_confirmed_returns_409(client, patch_calendar_service):
    patch_calendar_service.confirm_calendar.side_effect = HTTPException(
        status_code=409,
        detail="Solo se puede confirmar un calendario en borrador",
    )

    response = client.post(
        f"/api/calendars/{CALENDAR_ID}/confirm", headers=AUTH_HEADER
    )

    assert response.status_code == 409


def test_confirm_without_token_returns_401(client):
    response = client.post(f"/api/calendars/{CALENDAR_ID}/confirm")
    assert response.status_code == 401


# --- DELETE /api/calendars/{id} ---


def test_delete_draft_calendar_returns_204(client, patch_calendar_service):
    patch_calendar_service.delete_calendar.return_value = None

    response = client.delete(f"/api/calendars/{CALENDAR_ID}", headers=AUTH_HEADER)

    assert response.status_code == 204
    patch_calendar_service.delete_calendar.assert_awaited_once()


def test_delete_not_found_returns_404(client, patch_calendar_service):
    patch_calendar_service.delete_calendar.side_effect = HTTPException(
        status_code=404, detail="Calendario no encontrado"
    )

    response = client.delete(f"/api/calendars/{CALENDAR_ID}", headers=AUTH_HEADER)

    assert response.status_code == 404


def test_delete_synced_calendar_returns_409(client, patch_calendar_service):
    patch_calendar_service.delete_calendar.side_effect = HTTPException(
        status_code=409, detail="No se puede eliminar un calendario sincronizado"
    )

    response = client.delete(f"/api/calendars/{CALENDAR_ID}", headers=AUTH_HEADER)

    assert response.status_code == 409


def test_delete_without_token_returns_401(client):
    response = client.delete(f"/api/calendars/{CALENDAR_ID}")
    assert response.status_code == 401
