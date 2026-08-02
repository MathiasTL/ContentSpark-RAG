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
