"""Tests for the tightened profile Pydantic schemas — timezone validation."""
import pytest
from pydantic import ValidationError

from app.schemas.profile import ProfileCreate, ProfileUpdate

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
