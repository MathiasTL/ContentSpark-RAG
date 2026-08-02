"""Tests de los schemas y del servicio de perfil (Fase 2 - Slice 1)."""
from __future__ import annotations

from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.schemas.profile import ProfileCreate, ProfileStatusResponse
from app.services.profile_service import _missing_fields


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


def _fake_profile(**overrides):
    base = {
        "niche": None,
        "primary_goal": None,
        "tone": None,
        "target_audience": None,
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def test_missing_fields_all_empty_row():
    """Una fila con los cuatro campos requeridos vacios reporta los cuatro."""
    profile = _fake_profile()
    assert _missing_fields(profile) == [
        "niche",
        "primary_goal",
        "tone",
        "target_audience",
    ]


def test_missing_fields_whitespace_only_counts_as_missing():
    """Un valor de solo espacios en blanco cuenta como faltante."""
    profile = _fake_profile(
        niche="marketing",
        primary_goal="crecer",
        tone=" ",
        target_audience="emprendedores",
    )
    assert _missing_fields(profile) == ["tone"]


def test_missing_fields_all_present():
    """Con los cuatro campos requeridos presentes, no falta ninguno."""
    profile = _fake_profile(
        niche="marketing",
        primary_goal="crecer",
        tone="cercano",
        target_audience="emprendedores",
    )
    assert _missing_fields(profile) == []


def test_missing_fields_none_profile():
    """Un perfil `None` reporta los cuatro campos requeridos como faltantes."""
    assert _missing_fields(None) == [
        "niche",
        "primary_goal",
        "tone",
        "target_audience",
    ]
