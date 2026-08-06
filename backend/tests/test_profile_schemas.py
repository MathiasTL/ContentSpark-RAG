"""Tests for the tightened profile Pydantic schemas — timezone validation."""
import pytest
from pydantic import ValidationError

import app.schemas.profile as profile_schemas
from app.schemas.profile import ProfileCreate, ProfileUpdate, _validate_timezone

VALID_TZ = "America/Argentina/Buenos_Aires"

REQUIRED_PROFILE_CREATE_FIELDS = {
    "niche": "marketing",
    "primary_goal": "crecer",
    "tone": "cercano",
    "target_audience": "emprendedores",
}


class TestProfileCreateTimezone:
    def test_accepts_valid_iana_name(self):
        profile = ProfileCreate(**REQUIRED_PROFILE_CREATE_FIELDS, timezone=VALID_TZ)
        assert profile.timezone == VALID_TZ

    def test_accepts_none(self):
        profile = ProfileCreate(**REQUIRED_PROFILE_CREATE_FIELDS, timezone=None)
        assert profile.timezone is None

    def test_rejects_unknown_zone_name(self):
        with pytest.raises(ValidationError):
            ProfileCreate(**REQUIRED_PROFILE_CREATE_FIELDS, timezone="Mars/Olympus_Mons")

    def test_rejects_empty_string(self):
        with pytest.raises(ValidationError):
            ProfileCreate(**REQUIRED_PROFILE_CREATE_FIELDS, timezone="")


class TestProfileUpdateTimezone:
    def test_accepts_valid_iana_name(self):
        profile = ProfileUpdate(timezone=VALID_TZ)
        assert profile.timezone == VALID_TZ

    def test_accepts_none(self):
        profile = ProfileUpdate(timezone=None)
        assert profile.timezone is None

    def test_rejects_unknown_zone_name(self):
        with pytest.raises(ValidationError):
            ProfileUpdate(timezone="Mars/Olympus_Mons")

    def test_rejects_empty_string(self):
        with pytest.raises(ValidationError):
            ProfileUpdate(timezone="")


class TestValidateTimezoneDegradationBranch:
    """Covers the R3-degradation-branch-untested finding from the slice 1
    review (backend/app/schemas/profile.py:24): when the process has no
    tzdata at all, `_AVAILABLE_TIMEZONES` is an empty frozenset and the
    validator must accept any string unchanged rather than raising or
    silently becoming unreachable."""

    def test_accepts_any_value_unchanged_when_available_timezones_is_empty(
        self, monkeypatch
    ):
        monkeypatch.setattr(profile_schemas, "_AVAILABLE_TIMEZONES", frozenset())

        assert _validate_timezone("Mars/Olympus_Mons") == "Mars/Olympus_Mons"
        assert _validate_timezone(VALID_TZ) == VALID_TZ

    def test_still_accepts_none_when_available_timezones_is_empty(self, monkeypatch):
        monkeypatch.setattr(profile_schemas, "_AVAILABLE_TIMEZONES", frozenset())

        assert _validate_timezone(None) is None
