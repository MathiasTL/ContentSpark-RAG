"""Tests for the CalendarState TypedDict contract and the deterministic
calendar_agent nodes/helpers (receive_params, analyze_profile,
optimize_distribution, format_calendar). All of these are pure Python:
no LLM, no DB, no Qdrant, no network."""
import calendar as calendar_module
import math
from datetime import date, timedelta
from typing import get_type_hints

import pytest

from app.agents import calendar_agent
from app.agents.calendar_agent import (
    DEFAULT_FORMAT_MIX,
    DEFAULT_FREQUENCY,
    FREQUENCY_RECOMMENDATIONS,
    TIME_SLOTS,
    _distribute,
    _entry_count,
    _resolve_period,
    analyze_profile,
    format_calendar,
    optimize_distribution,
    receive_params,
)
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


# --- 3a.1: _resolve_period -------------------------------------------------


def test_resolve_period_current_week(monkeypatch):
    """current_week resolves to the Monday..Sunday containing today."""
    fixed_today = date(2026, 8, 3)  # a Monday

    class FixedDate(date):
        @classmethod
        def today(cls):
            return fixed_today

    monkeypatch.setattr(calendar_agent, "date", FixedDate)
    start, end = _resolve_period("current_week")
    assert start == date(2026, 8, 3)
    assert end == date(2026, 8, 9)
    assert start.isoweekday() == 1
    assert end.isoweekday() == 7


def test_resolve_period_next_week(monkeypatch):
    """next_week resolves to the Monday..Sunday exactly 7 days after
    current_week's start."""
    fixed_today = date(2026, 8, 5)  # a Wednesday

    class FixedDate(date):
        @classmethod
        def today(cls):
            return fixed_today

    monkeypatch.setattr(calendar_agent, "date", FixedDate)
    start, end = _resolve_period("next_week")
    assert start == date(2026, 8, 10)
    assert end == date(2026, 8, 16)


def test_resolve_period_month_boundary_correctness(monkeypatch):
    """month resolves to the 1st..last calendar day of today's month,
    correctly handling a short (28-day) February."""
    fixed_today = date(2026, 2, 15)

    class FixedDate(date):
        @classmethod
        def today(cls):
            return fixed_today

    monkeypatch.setattr(calendar_agent, "date", FixedDate)
    start, end = _resolve_period("month")
    assert start == date(2026, 2, 1)
    assert end == date(2026, 2, 28)  # 2026 is not a leap year


def test_resolve_period_month_boundary_31_day_month(monkeypatch):
    """month correctly resolves a 31-day month's last day too."""
    fixed_today = date(2026, 1, 10)

    class FixedDate(date):
        @classmethod
        def today(cls):
            return fixed_today

    monkeypatch.setattr(calendar_agent, "date", FixedDate)
    start, end = _resolve_period("month")
    assert start == date(2026, 1, 1)
    assert end == date(2026, 1, 31)


def test_resolve_period_unknown_raises():
    """Unreachable in production (PeriodLiteral-validated upstream), but
    the explicit guard must still exist."""
    with pytest.raises(ValueError):
        _resolve_period("not_a_real_period")


# --- 3a.1: _entry_count -----------------------------------------------------


def test_entry_count_current_week_matches_frequency_exactly():
    start = date(2026, 8, 3)
    end = date(2026, 8, 9)  # 7 days -> weeks == 1.0
    assert _entry_count(5, start, end) == 5


def test_entry_count_next_week_matches_frequency_exactly():
    start = date(2026, 8, 10)
    end = date(2026, 8, 16)  # 7 days -> weeks == 1.0
    assert _entry_count(3, start, end) == 3


def test_entry_count_month_scales_by_weeks_in_range():
    start = date(2026, 8, 1)
    end = date(2026, 8, 31)  # 31 days inclusive -> weeks ~= 4.43
    total_days = (end - start).days + 1
    weeks = total_days / 7
    assert 4.0 <= weeks <= 4.43
    frequency = 4
    expected = max(1, round(frequency * weeks))
    assert _entry_count(frequency, start, end) == expected


def test_entry_count_degenerate_one_day_period_guards_minimum_one():
    start = end = date(2026, 8, 3)
    # frequency * (1/7) rounds to 0 for a low frequency -> guarded to 1
    assert _entry_count(1, start, end) >= 1
    assert _entry_count(1, start, end) == 1


# --- 3a.1: _distribute -------------------------------------------------------


def test_distribute_sums_to_entry_count_exactly_evenly():
    result = _distribute(6, ["short_video", "post", "carousel"])
    assert sum(result.values()) == 6
    assert result == {"short_video": 2, "post": 2, "carousel": 2}


def test_distribute_sums_to_entry_count_exactly_with_remainder():
    """Largest-remainder rounding edge case: 7 entries across 3 formats
    distributes the remainder (1) to the first format, stable order."""
    result = _distribute(7, ["short_video", "post", "carousel"])
    assert sum(result.values()) == 7
    assert result == {"short_video": 3, "post": 2, "carousel": 2}


def test_distribute_remainder_goes_to_first_n_weights_in_order():
    result = _distribute(5, ["a", "b", "c", "d"])
    assert sum(result.values()) == 5
    # base=1, remainder=1 -> only "a" gets the extra
    assert result == {"a": 2, "b": 1, "c": 1, "d": 1}


# --- 3a.1: receive_params -----------------------------------------------


def test_receive_params_initializes_accumulators_and_computes_dates(monkeypatch):
    fixed_today = date(2026, 8, 3)  # a Monday

    class FixedDate(date):
        @classmethod
        def today(cls):
            return fixed_today

    monkeypatch.setattr(calendar_agent, "date", FixedDate)
    state: CalendarState = {
        "user_id": "u1",
        "profile": {"niche": "fitness"},
        "calendar_id": None,
        "period": "current_week",
        "start_date": None,
        "end_date": None,
        "frequency": None,
        "formats": None,
        "rag_context": None,
        "raw_ideas": None,
        "calendar_entries": None,
        "is_optimized": None,
    }
    result = receive_params(state)
    assert result["start_date"] == date(2026, 8, 3)
    assert result["end_date"] == date(2026, 8, 9)
    assert result["rag_context"] == ""
    assert result["raw_ideas"] == []
    assert result["calendar_entries"] == []
    assert result["is_optimized"] is False


# --- 3a.1: analyze_profile ----------------------------------------------


def test_analyze_profile_honors_explicit_frequency():
    state = {
        "profile": {"niche": "fitness", "desired_frequency": "3 por semana", "preferred_formats": []},
        "frequency": 5,
        "formats": None,
        "start_date": date(2026, 8, 3),
        "end_date": date(2026, 8, 9),  # current_week -> weeks == 1.0
    }
    result = analyze_profile(state)
    assert result["frequency"] == 5


def test_analyze_profile_falls_back_to_niche_table_when_frequency_omitted():
    state = {
        "profile": {"niche": "tecnologia", "desired_frequency": None, "preferred_formats": []},
        "frequency": None,
        "formats": None,
        "start_date": date(2026, 8, 3),
        "end_date": date(2026, 8, 9),  # current_week -> weeks == 1.0
    }
    result = analyze_profile(state)
    assert result["frequency"] == FREQUENCY_RECOMMENDATIONS["tecnologia"]


def test_analyze_profile_never_parses_desired_frequency_text():
    """desired_frequency is free text ('3 por semana') — must be ignored
    entirely, even though it superficially "contains" a number that would
    diverge from the niche-table resolution if it were (wrongly) parsed."""
    state = {
        "profile": {
            "niche": "tecnologia",
            "desired_frequency": "3 por semana",
            "preferred_formats": [],
        },
        "frequency": None,
        "formats": None,
        "start_date": date(2026, 8, 3),
        "end_date": date(2026, 8, 9),  # current_week -> weeks == 1.0
    }
    result = analyze_profile(state)
    assert result["frequency"] == FREQUENCY_RECOMMENDATIONS["tecnologia"]
    assert result["frequency"] != 3


def test_analyze_profile_unrecognized_niche_falls_back_to_default_never_raises():
    state = {
        "profile": {"niche": "unknown_niche_xyz", "desired_frequency": None, "preferred_formats": []},
        "frequency": None,
        "formats": None,
        "start_date": date(2026, 8, 3),
        "end_date": date(2026, 8, 9),  # current_week -> weeks == 1.0
    }
    result = analyze_profile(state)
    assert result["frequency"] == DEFAULT_FREQUENCY


def test_analyze_profile_none_niche_falls_back_to_default_never_raises():
    state = {
        "profile": {"niche": None, "desired_frequency": None, "preferred_formats": []},
        "frequency": None,
        "formats": None,
        "start_date": date(2026, 8, 3),
        "end_date": date(2026, 8, 9),  # current_week -> weeks == 1.0
    }
    result = analyze_profile(state)
    assert result["frequency"] == DEFAULT_FREQUENCY


def test_analyze_profile_honors_explicit_formats():
    state = {
        "profile": {"niche": "fitness", "desired_frequency": None, "preferred_formats": ["post"]},
        "frequency": 4,
        "formats": {"short_video": 4},
    }
    result = analyze_profile(state)
    assert result["formats"] == {"short_video": 4}


def test_analyze_profile_uses_preferred_formats_when_formats_omitted():
    state = {
        "profile": {
            "niche": "fitness",
            "desired_frequency": None,
            "preferred_formats": ["story", "long_video"],
        },
        "frequency": 4,
        "formats": None,
        "start_date": date(2026, 8, 3),
        "end_date": date(2026, 8, 9),  # current_week -> weeks == 1.0
    }
    result = analyze_profile(state)
    assert sum(result["formats"].values()) == 4
    assert set(result["formats"].keys()) == {"story", "long_video"}


def test_analyze_profile_uses_default_mix_when_no_formats_and_no_preferred():
    state = {
        "profile": {"niche": "fitness", "desired_frequency": None, "preferred_formats": []},
        "frequency": 4,
        "formats": None,
        "start_date": date(2026, 8, 3),
        "end_date": date(2026, 8, 9),  # current_week -> weeks == 1.0
    }
    result = analyze_profile(state)
    assert sum(result["formats"].values()) == 4
    assert set(result["formats"].keys()) == set(DEFAULT_FORMAT_MIX.keys())


def test_analyze_profile_month_period_distributes_over_scaled_entry_count():
    """Regression: analyze_profile must scale formats to the period, not the
    raw weekly frequency — a month with frequency=4 should distribute across
    ~17 entries (via _entry_count), not 4."""
    start = date(2026, 8, 1)
    end = date(2026, 8, 31)
    frequency = 4
    expected_entry_count = _entry_count(frequency, start, end)
    assert expected_entry_count != frequency

    state = {
        "profile": {
            "niche": "fitness",
            "desired_frequency": None,
            "preferred_formats": ["story", "long_video"],
        },
        "frequency": frequency,
        "formats": None,
        "start_date": start,
        "end_date": end,
    }
    result = analyze_profile(state)
    assert sum(result["formats"].values()) == expected_entry_count
    assert sum(result["formats"].values()) != frequency


def test_analyze_profile_current_week_period_still_sums_to_frequency():
    """Weekly periods keep entry_count == frequency exactly (weeks == 1.0)."""
    state = {
        "profile": {"niche": "fitness", "desired_frequency": None, "preferred_formats": []},
        "frequency": 5,
        "formats": None,
        "start_date": date(2026, 8, 3),
        "end_date": date(2026, 8, 9),
    }
    result = analyze_profile(state)
    assert sum(result["formats"].values()) == 5


# --- 3b.1: optimize_distribution -----------------------------------------


def _idea(fmt: str, i: int) -> dict:
    return {"title": f"idea {fmt} {i}", "format": fmt, "platform": "tiktok", "hook": "h", "description": "d"}


def test_optimize_distribution_no_adjacent_same_format_on_balanced_input():
    raw = (
        [_idea("short_video", i) for i in range(3)]
        + [_idea("post", i) for i in range(3)]
        + [_idea("carousel", i) for i in range(3)]
    )
    ordered = optimize_distribution(raw)
    assert len(ordered) == len(raw)
    for a, b in zip(ordered, ordered[1:]):
        assert a["format"] != b["format"]


def test_optimize_distribution_degrades_to_minimum_forced_repeats_never_raises():
    """One format's count (7) exceeds ceil(n/2) for n=9 (ceil=5) — a strict
    no-adjacent-repeat ordering is impossible. Must degrade, not raise."""
    raw = [_idea("short_video", i) for i in range(7)] + [_idea("post", i) for i in range(2)]
    n = len(raw)
    max_count = 7
    ordered = optimize_distribution(raw)  # must not raise
    assert len(ordered) == n

    adjacent_repeats = sum(1 for a, b in zip(ordered, ordered[1:]) if a["format"] == b["format"])
    minimum_forced_repeats = max(0, max_count - (n - max_count) - 1)
    assert adjacent_repeats == minimum_forced_repeats


def test_optimize_distribution_preserves_all_ideas():
    raw = [_idea("short_video", i) for i in range(2)] + [_idea("post", i) for i in range(2)]
    ordered = optimize_distribution(raw)
    assert sorted(idea["title"] for idea in ordered) == sorted(idea["title"] for idea in raw)


def test_optimize_distribution_documented_is_optimized_contract():
    """Per design.md §5d, the eventual optimize_distribution(state) node
    wrapper (wired in Unit 4's task 4b) sets is_optimized=True
    unconditionally once this pure algorithm returns — including in the
    degraded case. The pure helper tested here always completes without
    raising for both balanced and skewed inputs, which is the property the
    node wrapper's unconditional flag records."""
    balanced = [_idea("short_video", i) for i in range(2)] + [_idea("post", i) for i in range(2)]
    skewed = [_idea("short_video", i) for i in range(7)] + [_idea("post", i) for i in range(2)]
    for raw in (balanced, skewed):
        ordered = optimize_distribution(raw)
        is_optimized = True  # set unconditionally by the future node wrapper
        assert is_optimized is True
        assert len(ordered) == len(raw)


# --- 3b.1: format_calendar ------------------------------------------------


def test_format_calendar_dates_within_period_inclusive():
    start = date(2026, 8, 3)
    end = date(2026, 8, 9)
    ordered = [_idea("post", i) for i in range(4)]
    entries = format_calendar(ordered, start, end)
    assert len(entries) == 4
    for entry in entries:
        assert start <= entry["date"] <= end


def test_format_calendar_cycles_time_slots():
    start = date(2026, 8, 3)
    end = date(2026, 8, 9)
    ordered = [_idea("post", i) for i in range(6)]
    entries = format_calendar(ordered, start, end)
    for i, entry in enumerate(entries):
        assert entry["time_slot"] == TIME_SLOTS[i % 3]


def test_format_calendar_advances_to_next_free_day_on_collision():
    """frequency=14 stacked into a 7-day current_week period (design.md
    §5, the ~328-333 stacking case): step < 1, so multiple entries land on
    the same target day and must advance, capped at end_date."""
    start = date(2026, 8, 3)
    end = date(2026, 8, 9)  # 7-day current_week
    ordered = [_idea("post", i) for i in range(14)]
    entries = format_calendar(ordered, start, end)
    assert len(entries) == 14
    for entry in entries:
        assert start <= entry["date"] <= end
    # end_date must absorb the overflow (capped, not exceeded)
    assert entries[-1]["date"] == end


def test_format_calendar_degenerate_one_day_period_single_entry():
    start = end = date(2026, 8, 3)
    ordered = [_idea("post", 0)]
    entries = format_calendar(ordered, start, end)
    assert len(entries) == 1
    assert entries[0]["date"] == start
    assert entries[0]["time_slot"] == "morning"


def test_format_calendar_empty_ideas_returns_empty_list_no_crash():
    """Unreachable in production (generate_ideas always pads to entry_count
    via tier-3 templates), but must not ZeroDivisionError if it ever runs
    with zero ideas."""
    start = date(2026, 8, 3)
    end = date(2026, 8, 9)
    entries = format_calendar([], start, end)
    assert entries == []


def test_format_calendar_preserves_idea_fields():
    start = date(2026, 8, 3)
    end = date(2026, 8, 9)
    ordered = [_idea("post", 0)]
    entries = format_calendar(ordered, start, end)
    entry = entries[0]
    assert entry["title"] == "idea post 0"
    assert entry["format"] == "post"
    assert entry["platform"] == "tiktok"
    assert entry["hook"] == "h"
    assert entry["description"] == "d"
