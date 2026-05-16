"""Tests unitarios para chat_service.generate_title."""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services.chat_service import chat_service


@pytest.mark.asyncio
async def test_generate_title_uses_llm_response(monkeypatch):
    fake_llm = SimpleNamespace(
        ainvoke=AsyncMock(return_value=SimpleNamespace(content="Hooks para Reels"))
    )
    from app.services import chat_service as cs_module

    monkeypatch.setattr(cs_module.llm_service, "llm", fake_llm)

    title = await chat_service.generate_title(
        "Como hago un buen hook en Instagram Reels?"
    )
    assert title == "Hooks para Reels"
    fake_llm.ainvoke.assert_awaited_once()


@pytest.mark.asyncio
async def test_generate_title_falls_back_on_llm_error(monkeypatch):
    fake_llm = SimpleNamespace(ainvoke=AsyncMock(side_effect=Exception("boom")))
    from app.services import chat_service as cs_module

    monkeypatch.setattr(cs_module.llm_service, "llm", fake_llm)

    title = await chat_service.generate_title("Pregunta sobre TikTok algoritmo")
    assert title.startswith("Pregunta sobre TikTok algoritmo"[:50].rstrip()[:10])


@pytest.mark.asyncio
async def test_generate_title_falls_back_when_llm_returns_too_long(monkeypatch):
    fake_llm = SimpleNamespace(
        ainvoke=AsyncMock(
            return_value=SimpleNamespace(content="x" * 200)
        )
    )
    from app.services import chat_service as cs_module

    monkeypatch.setattr(cs_module.llm_service, "llm", fake_llm)

    title = await chat_service.generate_title("Mi pregunta corta")
    assert title == "Mi pregunta corta"


@pytest.mark.asyncio
async def test_generate_title_empty_message_returns_default():
    title = await chat_service.generate_title("   ")
    assert title == "Nuevo chat"
