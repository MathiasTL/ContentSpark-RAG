"""Tests de auth: verifica /api/auth/me y lazy sync."""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock


def test_me_without_token_returns_401(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_me_invalid_token_returns_401(client, mock_supabase_admin):
    mock_supabase_admin.auth.get_user.return_value = SimpleNamespace(user=None)
    response = client.get(
        "/api/auth/me", headers={"Authorization": "Bearer bogus"}
    )
    assert response.status_code == 401


def test_me_valid_token_returns_user_payload(
    client, mock_db_session, mock_supabase_user
):
    fetched_user = SimpleNamespace(
        id=mock_supabase_user.id,
        email=mock_supabase_user.email,
        name="Maria",
        avatar_url="https://avatars/m.png",
    )
    result = SimpleNamespace(scalar_one_or_none=lambda: fetched_user)
    mock_db_session.execute = AsyncMock(return_value=result)

    response = client.get(
        "/api/auth/me", headers={"Authorization": "Bearer valid"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body == {
        "user_id": mock_supabase_user.id,
        "email": "creator@example.com",
        "name": "Maria",
        "avatar_url": "https://avatars/m.png",
    }


def test_me_triggers_lazy_upsert(client, mock_db_session, mock_supabase_user):
    fetched_user = SimpleNamespace(
        id=mock_supabase_user.id,
        email=mock_supabase_user.email,
        name="Maria",
        avatar_url=None,
    )
    result = SimpleNamespace(scalar_one_or_none=lambda: fetched_user)
    mock_db_session.execute = AsyncMock(return_value=result)

    client.get("/api/auth/me", headers={"Authorization": "Bearer valid"})

    # `get_current_user` debe ejecutar al menos un INSERT (upsert) + un SELECT.
    assert mock_db_session.execute.await_count >= 2
