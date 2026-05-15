"""Tests de auth: verifica /api/auth/me y lazy sync."""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock


def test_me_without_token_returns_401(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401
