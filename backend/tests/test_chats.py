"""Tests del CRUD de chats."""
from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import UUID


def _fake_chat(
    chat_id: str = "22222222-2222-2222-2222-222222222222",
    user_id: str = "11111111-1111-1111-1111-111111111111",
    title: str | None = None,
    is_archived: bool = False,
):
    now = datetime(2026, 5, 16, 12, 0, tzinfo=timezone.utc)
    return SimpleNamespace(
        id=UUID(chat_id),
        user_id=UUID(user_id),
        title=title,
        is_archived=is_archived,
        created_at=now,
        updated_at=now,
        messages=[],
    )


def test_create_chat_returns_201_and_payload(client, patch_chat_service):
    patch_chat_service.create_chat.return_value = _fake_chat(title=None)

    response = client.post(
        "/api/chats",
        headers={"Authorization": "Bearer valid"},
        json={},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["id"] == "22222222-2222-2222-2222-222222222222"
    assert body["title"] is None
    assert body["is_archived"] is False
    patch_chat_service.create_chat.assert_awaited_once()


def test_create_chat_without_token_returns_401(client):
    response = client.post("/api/chats", json={})
    assert response.status_code == 401


def test_list_chats_returns_ordered_list(client, patch_chat_service):
    chat_a = _fake_chat(chat_id="22222222-2222-2222-2222-222222222222", title="A")
    chat_b = _fake_chat(chat_id="33333333-3333-3333-3333-333333333333", title="B")
    patch_chat_service.list_chats.return_value = [chat_a, chat_b]

    response = client.get(
        "/api/chats", headers={"Authorization": "Bearer valid"}
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2
    assert body[0]["title"] == "A"
    assert body[1]["title"] == "B"
    patch_chat_service.list_chats.assert_awaited_once()


def test_list_chats_without_token_returns_401(client):
    response = client.get("/api/chats")
    assert response.status_code == 401
