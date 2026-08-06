"""Tests del router de perfil."""
from __future__ import annotations

from types import SimpleNamespace


def _fake_profile(**overrides):
    base = dict(
        id="55555555-5555-5555-5555-555555555555",
        user_id="11111111-1111-1111-1111-111111111111",
        display_name=None,
        bio=None,
        niche=None,
        sub_niche=None,
        primary_goal=None,
        tone=None,
        target_audience=None,
        current_frequency=None,
        desired_frequency=None,
        preferred_formats=[],
        timezone=None,
        social_accounts=[],
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def test_get_profile_returns_empty_shape(client, patch_profile_service):
    patch_profile_service.get_or_create_profile.return_value = _fake_profile()

    response = client.get(
        "/api/profile", headers={"Authorization": "Bearer valid"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["niche"] is None
    assert body["social_accounts"] == []
    patch_profile_service.get_or_create_profile.assert_awaited_once()


def test_get_profile_without_token_returns_401(client):
    response = client.get("/api/profile")
    assert response.status_code == 401


def test_put_profile_partial_update_preserves_other_fields(
    client, patch_profile_service
):
    updated = _fake_profile(niche="marketing", tone="cercano", bio="Nueva bio")
    patch_profile_service.update_profile.return_value = updated

    response = client.put(
        "/api/profile",
        headers={"Authorization": "Bearer valid"},
        json={"bio": "Nueva bio"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["bio"] == "Nueva bio"
    assert body["tone"] == "cercano"
    patch_profile_service.update_profile.assert_awaited_once()


def test_put_profile_without_token_returns_401(client):
    response = client.put("/api/profile", json={"bio": "x"})
    assert response.status_code == 401


def test_put_profile_with_social_accounts_forwards_them(client, patch_profile_service):
    """Spec creator-profile: 'Social accounts submitted with profile update' se persisten."""
    updated = _fake_profile(
        social_accounts=[
            {
                "platform": "tiktok",
                "handle": "@maria",
                "url": None,
                "follower_count": None,
            }
        ]
    )
    patch_profile_service.update_profile.return_value = updated

    response = client.put(
        "/api/profile",
        headers={"Authorization": "Bearer valid"},
        json={"social_accounts": [{"platform": "tiktok", "handle": "@maria"}]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["social_accounts"] == [
        {
            "platform": "tiktok",
            "handle": "@maria",
            "url": None,
            "follower_count": None,
        }
    ]
    kwargs = patch_profile_service.update_profile.call_args.kwargs
    assert kwargs["social_accounts"] == [
        {
            "platform": "tiktok",
            "handle": "@maria",
            "url": None,
            "follower_count": None,
        }
    ]


def test_put_profile_omitting_social_accounts_leaves_them_untouched(
    client, patch_profile_service
):
    """Omitir `social_accounts` en el body no debe tocar las cuentas existentes.

    Con `exclude_unset=True`, un campo omitido ni siquiera llega como kwarg
    al servicio (JD-1/JD-2: distinguir "omitido" de "null explicito").
    """
    updated = _fake_profile(bio="Nueva bio")
    patch_profile_service.update_profile.return_value = updated

    response = client.put(
        "/api/profile",
        headers={"Authorization": "Bearer valid"},
        json={"bio": "Nueva bio"},
    )

    assert response.status_code == 200
    kwargs = patch_profile_service.update_profile.call_args.kwargs
    assert "social_accounts" not in kwargs


def test_put_profile_explicit_null_clears_field(client, patch_profile_service):
    """Un `null` explicito en el body SI debe llegar al servicio (limpiar el campo)."""
    updated = _fake_profile(bio=None)
    patch_profile_service.update_profile.return_value = updated

    response = client.put(
        "/api/profile",
        headers={"Authorization": "Bearer valid"},
        json={"bio": None},
    )

    assert response.status_code == 200
    kwargs = patch_profile_service.update_profile.call_args.kwargs
    assert "bio" in kwargs
    assert kwargs["bio"] is None


def test_put_profile_omitted_field_excluded_from_kwargs(client, patch_profile_service):
    """Un campo no enviado en el body no debe aparecer como kwarg (no se toca)."""
    updated = _fake_profile(niche="marketing")
    patch_profile_service.update_profile.return_value = updated

    response = client.put(
        "/api/profile",
        headers={"Authorization": "Bearer valid"},
        json={"niche": "marketing"},
    )

    assert response.status_code == 200
    kwargs = patch_profile_service.update_profile.call_args.kwargs
    assert "bio" not in kwargs
    assert kwargs["niche"] == "marketing"


def test_put_profile_empty_social_accounts_clears_them(client, patch_profile_service):
    """Enviar una lista vacia es distinguible de omitir el campo: limpia las cuentas."""
    updated = _fake_profile(social_accounts=[])
    patch_profile_service.update_profile.return_value = updated

    response = client.put(
        "/api/profile",
        headers={"Authorization": "Bearer valid"},
        json={"social_accounts": []},
    )

    assert response.status_code == 200
    kwargs = patch_profile_service.update_profile.call_args.kwargs
    assert kwargs["social_accounts"] == []


def test_post_onboarding_creates_profile_with_string_frequency(
    client, patch_profile_service
):
    created = _fake_profile(
        niche="marketing",
        primary_goal="crecer",
        tone="cercano",
        target_audience="emprendedores",
        current_frequency="3 por semana",
    )
    patch_profile_service.complete_onboarding.return_value = created

    response = client.post(
        "/api/profile/onboarding",
        headers={"Authorization": "Bearer valid"},
        json={
            "niche": "marketing",
            "primary_goal": "crecer",
            "tone": "cercano",
            "target_audience": "emprendedores",
            "current_frequency": "3 por semana",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["current_frequency"] == "3 por semana"
    patch_profile_service.complete_onboarding.assert_awaited_once()


def test_post_onboarding_missing_niche_returns_422_no_service_call(
    client, patch_profile_service
):
    response = client.post(
        "/api/profile/onboarding",
        headers={"Authorization": "Bearer valid"},
        json={
            "primary_goal": "crecer",
            "tone": "cercano",
            "target_audience": "emprendedores",
        },
    )

    assert response.status_code == 422
    patch_profile_service.complete_onboarding.assert_not_awaited()


def test_post_onboarding_resubmission_calls_complete_onboarding(
    client, patch_profile_service
):
    updated = _fake_profile(
        niche="marketing",
        primary_goal="crecer",
        tone="cercano",
        target_audience="emprendedores",
    )
    patch_profile_service.complete_onboarding.return_value = updated

    response = client.post(
        "/api/profile/onboarding",
        headers={"Authorization": "Bearer valid"},
        json={
            "niche": "marketing",
            "primary_goal": "crecer",
            "tone": "cercano",
            "target_audience": "emprendedores",
        },
    )

    assert response.status_code == 200
    patch_profile_service.complete_onboarding.assert_awaited_once()


def test_post_onboarding_resubmission_preserves_omitted_optional_field(
    client, patch_profile_service
):
    """Reenviar onboarding sin `bio` no debe llegar al servicio como campo explicito."""
    updated = _fake_profile(
        niche="marketing",
        primary_goal="crecer",
        tone="cercano",
        target_audience="emprendedores",
        bio="bio existente",
    )
    patch_profile_service.complete_onboarding.return_value = updated

    response = client.post(
        "/api/profile/onboarding",
        headers={"Authorization": "Bearer valid"},
        json={
            "niche": "marketing",
            "primary_goal": "crecer",
            "tone": "cercano",
            "target_audience": "emprendedores",
        },
    )

    assert response.status_code == 200
    payload = patch_profile_service.complete_onboarding.call_args.args[2]
    assert "bio" not in payload.model_fields_set


def test_post_onboarding_resubmission_without_social_accounts_key(
    client, patch_profile_service
):
    """Reenviar onboarding sin `social_accounts` no debe llegar como campo explicito."""
    updated = _fake_profile(
        niche="marketing",
        primary_goal="crecer",
        tone="cercano",
        target_audience="emprendedores",
    )
    patch_profile_service.complete_onboarding.return_value = updated

    response = client.post(
        "/api/profile/onboarding",
        headers={"Authorization": "Bearer valid"},
        json={
            "niche": "marketing",
            "primary_goal": "crecer",
            "tone": "cercano",
            "target_audience": "emprendedores",
        },
    )

    assert response.status_code == 200
    payload = patch_profile_service.complete_onboarding.call_args.args[2]
    assert "social_accounts" not in payload.model_fields_set


def test_post_onboarding_without_token_returns_401(client):
    response = client.post("/api/profile/onboarding", json={})
    assert response.status_code == 401


def test_get_status_returns_completion_shape(client, patch_profile_service):
    patch_profile_service.get_status.return_value = (
        False,
        ["niche", "primary_goal", "tone", "target_audience"],
    )

    response = client.get(
        "/api/profile/status", headers={"Authorization": "Bearer valid"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["is_complete"] is False
    assert body["missing_fields"] == [
        "niche",
        "primary_goal",
        "tone",
        "target_audience",
    ]
    patch_profile_service.get_status.assert_awaited_once()


def test_get_status_without_token_returns_401(client):
    response = client.get("/api/profile/status")
    assert response.status_code == 401


# --- timezone: schema validation + round-trip ------------------------------


def test_put_profile_invalid_timezone_returns_422_and_does_not_persist(
    client, patch_profile_service
):
    response = client.put(
        "/api/profile",
        headers={"Authorization": "Bearer valid"},
        json={"timezone": "Mars/Olympus_Mons"},
    )

    assert response.status_code == 422
    patch_profile_service.update_profile.assert_not_awaited()


def test_put_profile_valid_timezone_round_trips_through_get(
    client, patch_profile_service
):
    updated = _fake_profile(timezone="America/Argentina/Buenos_Aires")
    patch_profile_service.update_profile.return_value = updated

    put_response = client.put(
        "/api/profile",
        headers={"Authorization": "Bearer valid"},
        json={"timezone": "America/Argentina/Buenos_Aires"},
    )

    assert put_response.status_code == 200
    assert put_response.json()["timezone"] == "America/Argentina/Buenos_Aires"

    patch_profile_service.get_or_create_profile.return_value = updated
    get_response = client.get(
        "/api/profile", headers={"Authorization": "Bearer valid"}
    )
    assert get_response.status_code == 200
    assert get_response.json()["timezone"] == "America/Argentina/Buenos_Aires"


def test_get_profile_with_no_stored_timezone_returns_null(
    client, patch_profile_service
):
    patch_profile_service.get_or_create_profile.return_value = _fake_profile()

    response = client.get(
        "/api/profile", headers={"Authorization": "Bearer valid"}
    )

    assert response.status_code == 200
    assert response.json()["timezone"] is None
