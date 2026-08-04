"""Tests for the tightened calendar Pydantic schemas."""
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.schemas.calendar import (
    CalendarDetailResponse,
    CalendarGenerateRequest,
    CalendarResponse,
    CalendarStatusError,
    EntryResponse,
    EntryUpdate,
)


class TestCalendarGenerateRequest:
    def test_accepts_period_alone(self):
        request = CalendarGenerateRequest(period="current_week")
        assert request.period == "current_week"
        assert request.frequency is None
        assert request.formats is None
        assert request.calendar_id is None

    def test_rejects_invalid_period(self):
        with pytest.raises(ValidationError):
            CalendarGenerateRequest(period="yesterday")

    def test_rejects_format_outside_closed_set(self):
        with pytest.raises(ValidationError):
            CalendarGenerateRequest(period="month", formats={"tweet_thread": 2})

    def test_accepts_optional_calendar_id(self):
        request = CalendarGenerateRequest(
            period="month",
            calendar_id="33333333-3333-3333-3333-333333333333",
        )
        assert request.calendar_id == "33333333-3333-3333-3333-333333333333"


class TestEntryUpdate:
    def test_accepts_partial_subset_of_fields(self):
        update = EntryUpdate(title="New title")
        assert update.title == "New title"
        assert update.status is None
        assert update.format is None

    def test_rejects_out_of_set_status(self):
        with pytest.raises(ValidationError):
            EntryUpdate(status="archived")


class TestResponseSerialization:
    def test_entry_response_from_attributes(self):
        entry = SimpleNamespace(
            id="44444444-4444-4444-4444-444444444444",
            calendar_id="33333333-3333-3333-3333-333333333333",
            date="2026-08-03",
            time_slot="morning",
            title="Hook de fitness",
            format="short_video",
            platform="tiktok",
            hook="No hagas esto en el gym",
            description="Video corto sobre errores comunes",
            status="idea",
            google_calendar_event_id=None,
        )
        response = EntryResponse.model_validate(entry)
        assert response.id == "44444444-4444-4444-4444-444444444444"
        assert response.format == "short_video"

    def test_calendar_response_from_attributes(self):
        calendar = SimpleNamespace(
            id="33333333-3333-3333-3333-333333333333",
            name="Semana actual",
            start_date="2026-08-03",
            end_date="2026-08-09",
            frequency=4,
            status="draft",
        )
        response = CalendarResponse.model_validate(calendar)
        assert response.status == "draft"

    def test_calendar_detail_response_includes_entries(self):
        entry = SimpleNamespace(
            id="44444444-4444-4444-4444-444444444444",
            calendar_id="33333333-3333-3333-3333-333333333333",
            date="2026-08-03",
            time_slot="morning",
            title="Hook de fitness",
            format="short_video",
            platform="tiktok",
            hook="No hagas esto en el gym",
            description="Video corto sobre errores comunes",
            status="idea",
            google_calendar_event_id=None,
        )
        calendar = SimpleNamespace(
            id="33333333-3333-3333-3333-333333333333",
            name="Semana actual",
            start_date="2026-08-03",
            end_date="2026-08-09",
            frequency=4,
            status="draft",
            entries=[entry],
        )
        response = CalendarDetailResponse.model_validate(calendar)
        assert len(response.entries) == 1
        assert response.entries[0].title == "Hook de fitness"


class TestCalendarStatusError:
    def test_serializes_detail_and_missing_fields(self):
        error = CalendarStatusError(
            detail="Profile incomplete",
            missing_fields=["niche", "primary_goal"],
        )
        dumped = error.model_dump()
        assert dumped == {
            "detail": "Profile incomplete",
            "missing_fields": ["niche", "primary_goal"],
        }
