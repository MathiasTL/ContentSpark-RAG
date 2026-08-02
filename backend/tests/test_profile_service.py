"""Tests de los schemas de perfil (Fase 2 - Slice 1)."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.profile import ProfileCreate, ProfileStatusResponse


def test_profile_create_accepts_string_frequency():
    """`current_frequency` acepta strings como '3 por semana', no solo enteros."""
    profile = ProfileCreate(
        niche="marketing",
        primary_goal="crecer",
        tone="cercano",
        target_audience="emprendedores",
        current_frequency="3 por semana",
    )
    assert profile.current_frequency == "3 por semana"


def test_profile_create_rejects_missing_niche():
    """`niche` sigue siendo requerido para la creación."""
    with pytest.raises(ValidationError):
        ProfileCreate(
            primary_goal="crecer",
            tone="cercano",
            target_audience="emprendedores",
        )


def test_profile_status_response_serializes():
    """`ProfileStatusResponse` expone is_complete + missing_fields."""
    status = ProfileStatusResponse(is_complete=False, missing_fields=["niche"])
    assert status.model_dump() == {"is_complete": False, "missing_fields": ["niche"]}
