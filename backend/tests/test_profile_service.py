"""Tests de los schemas y del servicio de perfil (Fase 2 - Slice 1)."""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from pydantic import ValidationError

from app.schemas.profile import ProfileCreate, ProfileStatusResponse, ProfileUpdate
from app.services.profile_service import ProfileService, _missing_fields


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


# --- ProfileUpdate.social_accounts (remediacion CRITICAL de sdd-verify) --------


def test_profile_update_social_accounts_defaults_to_none():
    """Omitir `social_accounts` en el update deja el campo en `None` (no se toca nada)."""
    update = ProfileUpdate(bio="Nueva bio")
    assert update.social_accounts is None


def test_profile_update_accepts_social_accounts_list():
    """`ProfileUpdate` acepta cuentas sociales explicitas para reemplazarlas."""
    update = ProfileUpdate(
        social_accounts=[{"platform": "tiktok", "handle": "@maria"}]
    )
    assert update.social_accounts[0].handle == "@maria"


def test_profile_update_accepts_empty_social_accounts_list():
    """Una lista vacia es distinguible de omitir el campo (limpia las cuentas)."""
    update = ProfileUpdate(social_accounts=[])
    assert update.social_accounts == []


# --- ProfileService.update_profile — social_accounts ---------------------------


@pytest.mark.asyncio
async def test_update_profile_with_social_accounts_replaces_them(monkeypatch):
    """Enviar `social_accounts` en el update los persiste via `_replace_social_accounts`."""
    service = ProfileService()
    fake_profile = SimpleNamespace(id="profile-1", social_accounts=[])
    monkeypatch.setattr(
        service, "get_or_create_profile", AsyncMock(return_value=fake_profile)
    )
    replace_mock = AsyncMock()
    monkeypatch.setattr(service, "_replace_social_accounts", replace_mock)
    db = AsyncMock()

    accounts = [{"platform": "tiktok", "handle": "@maria"}]
    await service.update_profile(db, "user-1", social_accounts=accounts)

    replace_mock.assert_awaited_once_with(db, fake_profile, accounts)


@pytest.mark.asyncio
async def test_update_profile_without_social_accounts_leaves_untouched(monkeypatch):
    """Omitir `social_accounts` en el payload no toca las cuentas existentes."""
    service = ProfileService()
    fake_profile = SimpleNamespace(id="profile-1", social_accounts=["existing"])
    monkeypatch.setattr(
        service, "get_or_create_profile", AsyncMock(return_value=fake_profile)
    )
    replace_mock = AsyncMock()
    monkeypatch.setattr(service, "_replace_social_accounts", replace_mock)
    db = AsyncMock()

    await service.update_profile(db, "user-1", bio="Nueva bio")

    replace_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_update_profile_empty_list_clears_social_accounts(monkeypatch):
    """Enviar una lista vacia limpia las cuentas sociales existentes."""
    service = ProfileService()
    fake_profile = SimpleNamespace(id="profile-1", social_accounts=["existing"])
    monkeypatch.setattr(
        service, "get_or_create_profile", AsyncMock(return_value=fake_profile)
    )
    replace_mock = AsyncMock()
    monkeypatch.setattr(service, "_replace_social_accounts", replace_mock)
    db = AsyncMock()

    await service.update_profile(db, "user-1", social_accounts=[])

    replace_mock.assert_awaited_once_with(db, fake_profile, [])


@pytest.mark.asyncio
async def test_update_profile_scopes_get_or_create_by_user_id(monkeypatch):
    """`update_profile` SIEMPRE resuelve el perfil via `user_id` (nunca otro usuario)."""
    service = ProfileService()
    fake_profile = SimpleNamespace(id="profile-1", social_accounts=[])
    get_or_create_mock = AsyncMock(return_value=fake_profile)
    monkeypatch.setattr(service, "get_or_create_profile", get_or_create_mock)
    monkeypatch.setattr(service, "_replace_social_accounts", AsyncMock())
    db = AsyncMock()

    await service.update_profile(
        db, "user-42", social_accounts=[{"platform": "x", "handle": "@m"}]
    )

    get_or_create_mock.assert_awaited_once_with(db, "user-42")


# --- ProfileService.update_profile — distincion null explicito vs omitido -----


@pytest.mark.asyncio
async def test_update_profile_clears_field_with_explicit_null(monkeypatch):
    """Un `None` explicito (presente en kwargs) SI debe limpiar el campo."""
    service = ProfileService()
    fake_profile = SimpleNamespace(id="profile-1", bio="bio vieja", social_accounts=[])
    monkeypatch.setattr(
        service, "get_or_create_profile", AsyncMock(return_value=fake_profile)
    )
    db = AsyncMock()

    await service.update_profile(db, "user-1", bio=None)

    assert fake_profile.bio is None


@pytest.mark.asyncio
async def test_update_profile_leaves_omitted_field_untouched(monkeypatch):
    """Un campo ausente de kwargs (no enviado por el cliente) no se toca."""
    service = ProfileService()
    fake_profile = SimpleNamespace(
        id="profile-1", bio="bio vieja", niche=None, social_accounts=[]
    )
    monkeypatch.setattr(
        service, "get_or_create_profile", AsyncMock(return_value=fake_profile)
    )
    db = AsyncMock()

    await service.update_profile(db, "user-1", niche="tech")

    assert fake_profile.bio == "bio vieja"
    assert fake_profile.niche == "tech"


# --- ProfileService.complete_onboarding — consistencia con update_profile -----


@pytest.mark.asyncio
async def test_complete_onboarding_preserves_omitted_optional_fields(monkeypatch):
    """Reenviar onboarding sin `bio` no debe sobreescribirla con None."""
    from app.schemas.profile import ProfileCreate

    service = ProfileService()
    fake_profile = SimpleNamespace(
        id="profile-1", bio="bio existente", niche=None, social_accounts=[]
    )
    monkeypatch.setattr(
        service, "get_or_create_profile", AsyncMock(return_value=fake_profile)
    )
    monkeypatch.setattr(service, "_replace_social_accounts", AsyncMock())
    db = AsyncMock()

    payload = ProfileCreate(
        niche="marketing",
        primary_goal="crecer",
        tone="cercano",
        target_audience="emprendedores",
    )

    await service.complete_onboarding(db, "user-1", payload)

    assert fake_profile.bio == "bio existente"
    assert fake_profile.niche == "marketing"


@pytest.mark.asyncio
async def test_complete_onboarding_without_social_accounts_preserves_existing(
    monkeypatch,
):
    """Reenviar onboarding sin `social_accounts` no debe borrar las existentes."""
    from app.schemas.profile import ProfileCreate

    service = ProfileService()
    fake_profile = SimpleNamespace(id="profile-1", social_accounts=["existing"])
    monkeypatch.setattr(
        service, "get_or_create_profile", AsyncMock(return_value=fake_profile)
    )
    replace_mock = AsyncMock()
    monkeypatch.setattr(service, "_replace_social_accounts", replace_mock)
    db = AsyncMock()

    payload = ProfileCreate(
        niche="marketing",
        primary_goal="crecer",
        tone="cercano",
        target_audience="emprendedores",
    )

    await service.complete_onboarding(db, "user-1", payload)

    replace_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_complete_onboarding_explicit_empty_social_accounts_clears(
    monkeypatch,
):
    """Enviar `social_accounts=[]` explicitamente SI limpia las cuentas existentes."""
    from app.schemas.profile import ProfileCreate

    service = ProfileService()
    fake_profile = SimpleNamespace(id="profile-1", social_accounts=["existing"])
    monkeypatch.setattr(
        service, "get_or_create_profile", AsyncMock(return_value=fake_profile)
    )
    replace_mock = AsyncMock()
    monkeypatch.setattr(service, "_replace_social_accounts", replace_mock)
    db = AsyncMock()

    payload = ProfileCreate(
        niche="marketing",
        primary_goal="crecer",
        tone="cercano",
        target_audience="emprendedores",
        social_accounts=[],
    )

    await service.complete_onboarding(db, "user-1", payload)

    replace_mock.assert_awaited_once_with(db, fake_profile, [])


@pytest.mark.asyncio
async def test_replace_social_accounts_scopes_new_rows_to_profile():
    """Las cuentas creadas quedan asociadas exclusivamente al `profile_id` del usuario autenticado."""
    from app.schemas.profile import SocialAccountCreate

    service = ProfileService()
    fake_profile = SimpleNamespace(id="profile-99", social_accounts=[])
    db = AsyncMock()
    db.add = MagicMock()

    await service._replace_social_accounts(
        db, fake_profile, [SocialAccountCreate(platform="tiktok", handle="@maria")]
    )

    added = db.add.call_args.args[0]
    assert added.profile_id == "profile-99"
    assert added.handle == "@maria"
