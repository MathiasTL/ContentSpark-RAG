"""Tests for the CalendarState TypedDict contract."""
from datetime import date
from typing import get_type_hints

from app.agents.shared_state import CalendarState


def test_calendar_state_has_full_field_set():
    """CalendarState must expose every field required by the calendar graph."""
    hints = get_type_hints(CalendarState)

    expected_fields = {
        "user_id",
        "profile",
        "calendar_id",
        "period",
        "start_date",
        "end_date",
        "frequency",
        "formats",
        "rag_context",
        "raw_ideas",
        "calendar_entries",
        "is_optimized",
    }
    assert set(hints.keys()) == expected_fields


def test_calendar_state_field_types():
    """Spot-check the non-primitive field types resolve as designed."""
    hints = get_type_hints(CalendarState)

    assert hints["user_id"] is str
    assert hints["start_date"] is date
    assert hints["end_date"] is date
    assert hints["frequency"] is int
    assert hints["rag_context"] is str
    assert hints["is_optimized"] is bool


def test_calendar_state_accepts_dict_literal():
    """A plain dict literal with the full field set is a valid CalendarState value."""
    state: CalendarState = {
        "user_id": "11111111-1111-1111-1111-111111111111",
        "profile": {"niche": "fitness"},
        "calendar_id": None,
        "period": "current_week",
        "start_date": date(2026, 8, 3),
        "end_date": date(2026, 8, 9),
        "frequency": 4,
        "formats": {"short_video": 2, "post": 2},
        "rag_context": "",
        "raw_ideas": [],
        "calendar_entries": [],
        "is_optimized": False,
    }
    assert state["frequency"] == 4
    assert state["is_optimized"] is False
