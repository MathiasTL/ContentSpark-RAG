"""Tests del endpoint POST /api/chat (streaming + persistencia)."""
from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID


def _fake_chat(title=None):
    now = datetime(2026, 5, 16, 12, 0, tzinfo=timezone.utc)
    return SimpleNamespace(
        id=UUID("22222222-2222-2222-2222-222222222222"),
        user_id=UUID("11111111-1111-1111-1111-111111111111"),
        title=title,
        is_archived=False,
        created_at=now,
        updated_at=now,
    )


async def _fake_stream(message, history):
    yield "Hola "
    yield "mundo"


def test_chat_requires_chat_id(client):
    response = client.post(
        "/api/chat",
        headers={"Authorization": "Bearer valid"},
        json={"message": "hi"},
    )
    assert response.status_code == 422


def test_chat_requires_message(client):
    response = client.post(
        "/api/chat",
        headers={"Authorization": "Bearer valid"},
        json={"chat_id": "22222222-2222-2222-2222-222222222222"},
    )
    assert response.status_code == 422


def test_chat_returns_404_when_chat_not_owned(client, patch_chat_service):
    from fastapi import HTTPException

    patch_chat_service.get_chat.side_effect = HTTPException(
        status_code=404, detail="Chat no encontrado"
    )
    response = client.post(
        "/api/chat",
        headers={"Authorization": "Bearer valid"},
        json={
            "chat_id": "22222222-2222-2222-2222-222222222222",
            "message": "hola",
        },
    )
    assert response.status_code == 404


def test_chat_persists_and_streams(client, patch_chat_service):
    patch_chat_service.get_chat.return_value = _fake_chat(title="ya tiene titulo")
    patch_chat_service.load_history.return_value = []

    with patch(
        "app.routers.chat.rag_service.generate_response_stream",
        side_effect=_fake_stream,
    ), patch(
        "app.routers.chat.AsyncSessionLocal"
    ) as session_factory:
        fake_session = AsyncMock()
        fake_session.__aenter__.return_value = fake_session
        fake_session.__aexit__.return_value = None
        session_factory.return_value = fake_session

        response = client.post(
            "/api/chat",
            headers={"Authorization": "Bearer valid"},
            json={
                "chat_id": "22222222-2222-2222-2222-222222222222",
                "message": "Hola",
            },
        )

    assert response.status_code == 200
    assert response.text == "Hola mundo"
    # user message persisted en la sesion del request
    assert patch_chat_service.add_message.await_count >= 1
    first_call = patch_chat_service.add_message.await_args_list[0]
    assert first_call.kwargs.get("role") == "user" or first_call.args[2] == "user"


def test_chat_generates_title_when_missing(client, patch_chat_service):
    patch_chat_service.get_chat.return_value = _fake_chat(title=None)
    patch_chat_service.load_history.return_value = []
    patch_chat_service.generate_title.return_value = "Titulo IA"

    with patch(
        "app.routers.chat.rag_service.generate_response_stream",
        side_effect=_fake_stream,
    ), patch(
        "app.routers.chat.AsyncSessionLocal"
    ) as session_factory:
        fake_session = AsyncMock()
        fake_session.__aenter__.return_value = fake_session
        fake_session.__aexit__.return_value = None
        session_factory.return_value = fake_session

        response = client.post(
            "/api/chat",
            headers={"Authorization": "Bearer valid"},
            json={
                "chat_id": "22222222-2222-2222-2222-222222222222",
                "message": "Como hago un hook?",
            },
        )

    assert response.status_code == 200
    patch_chat_service.generate_title.assert_awaited_once_with(
        "Como hago un hook?"
    )
    patch_chat_service.update_chat.assert_awaited()
