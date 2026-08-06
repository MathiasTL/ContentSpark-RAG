"""Tests for the CalendarState TypedDict contract and the calendar_agent
nodes/helpers: the 4 deterministic nodes (receive_params, analyze_profile,
optimize_distribution, format_calendar), `query_rag`, and `generate_ideas`
(LLM/Qdrant fully mocked — zero network calls anywhere in this file)."""
from datetime import UTC, date, datetime
from itertools import pairwise
from typing import get_type_hints
from unittest.mock import AsyncMock

import groq
import httpx
import pytest
from pydantic import ValidationError

from app.agents import calendar_agent
from app.agents.calendar_agent import (
    DEFAULT_FORMAT_MIX,
    DEFAULT_FREQUENCY,
    DEFAULT_PLATFORM_BY_FORMAT,
    FREQUENCY_RECOMMENDATIONS,
    TIME_SLOTS,
    GeneratedIdea,
    GeneratedIdeasList,
    _distribute,
    _entry_count,
    _period_bounds,
    _resolve_period,
    _template_idea,
    _today_in,
    analyze_profile,
    calendar_app,
    format_calendar,
    generate_ideas,
    optimize_distribution,
    query_rag,
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


# --- 1.1: _period_bounds / _today_in / _resolve_period ----------------------


def test_period_bounds_current_week():
    """current_week resolves to the Monday..Sunday containing today."""
    today = date(2026, 8, 3)  # a Monday
    start, end = _period_bounds("current_week", today)
    assert start == date(2026, 8, 3)
    assert end == date(2026, 8, 9)
    assert start.isoweekday() == 1
    assert end.isoweekday() == 7


def test_period_bounds_next_week():
    """next_week resolves to the Monday..Sunday exactly 7 days after
    current_week's start."""
    today = date(2026, 8, 5)  # a Wednesday
    start, end = _period_bounds("next_week", today)
    assert start == date(2026, 8, 10)
    assert end == date(2026, 8, 16)


def test_period_bounds_month_short_february():
    """month resolves to the 1st..last calendar day of today's month,
    correctly handling a short (28-day) February."""
    today = date(2026, 2, 15)
    start, end = _period_bounds("month", today)
    assert start == date(2026, 2, 1)
    assert end == date(2026, 2, 28)  # 2026 is not a leap year


def test_period_bounds_month_31_day():
    """month correctly resolves a 31-day month's last day too."""
    today = date(2026, 1, 10)
    start, end = _period_bounds("month", today)
    assert start == date(2026, 1, 1)
    assert end == date(2026, 1, 31)


def test_resolve_period_unknown_raises():
    """Unreachable in production (PeriodLiteral-validated upstream), but
    the explicit guard must still exist."""
    with pytest.raises(ValueError):
        _resolve_period("not_a_real_period", None)


def test_today_in_none_is_utc():
    instant = datetime(2026, 8, 3, 1, 0, tzinfo=UTC)
    assert _today_in(None, now=instant) == date(2026, 8, 3)


def test_today_in_applies_zone_offset():
    """Same instant, Buenos Aires is 3h behind UTC — Monday 01:00 UTC is
    still Sunday there."""
    instant = datetime(2026, 8, 3, 1, 0, tzinfo=UTC)
    assert _today_in("America/Argentina/Buenos_Aires", now=instant) == date(2026, 8, 2)


def test_today_in_invalid_zone_falls_back_to_utc():
    instant = datetime(2026, 8, 3, 1, 0, tzinfo=UTC)
    assert _today_in("Mars/Olympus_Mons", now=instant) == _today_in(None, now=instant)


def test_resolve_period_week_differs_across_utc_boundary():
    """Exit criterion 4: the same instant resolves to two different weeks
    depending on the creator's timezone. Monday 01:00 UTC is Sunday 22:00
    in Buenos Aires, so Buenos Aires is still in the *previous* week."""
    instant = datetime(2026, 8, 3, 1, 0, tzinfo=UTC)
    bsas = _resolve_period("current_week", "America/Argentina/Buenos_Aires", now=instant)
    utc = _resolve_period("current_week", None, now=instant)
    assert bsas == (date(2026, 7, 27), date(2026, 8, 2))
    assert utc == (date(2026, 8, 3), date(2026, 8, 9))
    assert bsas != utc


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


def test_distribute_dedupes_duplicate_weights_sum_stays_exact():
    """Regression: duplicate entries in `weights` (reachable via
    profile.preferred_formats — no uniqueness constraint anywhere in the
    stack) used to collapse in the `{f: base for f in weights}` dict
    comprehension while `n = len(weights)` still counted the duplicate,
    breaking the sum(result.values()) == entry_count invariant
    (10 in, 7 out). Deduping `weights` up front keeps the invariant true
    for ANY input, per the docstring's promise."""
    result = _distribute(10, ["post", "post", "carousel"])
    assert sum(result.values()) == 10
    assert set(result.keys()) == {"post", "carousel"}


def test_distribute_dedupe_preserves_first_seen_order_for_remainder():
    """Dedup must preserve first-seen order so the largest-remainder split
    stays deterministic/stable, same as the non-duplicate case."""
    result = _distribute(7, ["post", "carousel", "post"])
    assert sum(result.values()) == 7
    # base=3, remainder=1 -> only "post" (first-seen) gets the extra
    assert result == {"post": 4, "carousel": 3}


# --- 3a.1: receive_params -----------------------------------------------


def test_receive_params_initializes_accumulators_and_computes_dates():
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
    expected_start, expected_end = _period_bounds("current_week", _today_in(None))
    assert result["start_date"] == expected_start
    assert result["end_date"] == expected_end
    assert result["rag_context"] == ""
    assert result["raw_ideas"] == []
    assert result["calendar_entries"] == []
    assert result["is_optimized"] is False


def test_receive_params_uses_profile_timezone():
    """Relational assertion (not a literal date) so it cannot flake at a
    real-world date boundary."""
    state: CalendarState = {
        "user_id": "u1",
        "profile": {"timezone": "Pacific/Kiritimati"},
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
    expected = _period_bounds("current_week", _today_in("Pacific/Kiritimati"))
    assert (result["start_date"], result["end_date"]) == expected


def test_receive_params_missing_timezone_key_resolves_utc():
    """A pre-existing 7-key profile (no `timezone` key at all) resolves in
    UTC, same as an explicit `None`."""
    state: CalendarState = {
        "user_id": "u1",
        "profile": {
            "niche": "fitness",
            "sub_niche": None,
            "primary_goal": "crecer",
            "tone": "cercano",
            "target_audience": "adultos",
            "desired_frequency": None,
            "preferred_formats": [],
        },
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
    expected = _period_bounds("current_week", _today_in(None))
    assert (result["start_date"], result["end_date"]) == expected


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
    for a, b in pairwise(ordered):
        assert a["format"] != b["format"]


def test_optimize_distribution_degrades_to_minimum_forced_repeats_never_raises():
    """One format's count (7) exceeds ceil(n/2) for n=9 (ceil=5) — a strict
    no-adjacent-repeat ordering is impossible. Must degrade, not raise."""
    raw = [_idea("short_video", i) for i in range(7)] + [_idea("post", i) for i in range(2)]
    n = len(raw)
    max_count = 7
    ordered = optimize_distribution(raw)  # must not raise
    assert len(ordered) == n

    adjacent_repeats = sum(1 for a, b in pairwise(ordered) if a["format"] == b["format"])
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


def test_format_calendar_14_in_7_days_spreads_evenly_no_single_day_overload():
    """Regression: the old round(i*step) + used_dates collision loop
    stopped advancing at end_date, dumping the entire remainder there
    (1 entry/day for 6 days, then 8 entries on the last day). The
    index-proportional placement (floor(i * total_days / n)) must instead
    stack EVENLY: with n=14 over total_days=7, every day gets exactly
    ceil(14/7) == 2 entries, none more."""
    from collections import Counter

    start = date(2026, 8, 3)
    end = date(2026, 8, 9)  # 7-day period
    ordered = [_idea("post", i) for i in range(14)]
    entries = format_calendar(ordered, start, end)

    per_day = Counter(entry["date"] for entry in entries)
    max_per_day = max(per_day.values())
    assert max_per_day <= 2  # ceil(14 / 7)
    assert len(per_day) == 7  # every day in the range gets entries
    assert all(count == 2 for count in per_day.values())


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


# --- 4a.1: query_rag ---------------------------------------------------


class _FakeDoc:
    def __init__(self, content: str):
        self.page_content = content


def _profile(**overrides) -> dict:
    base = {
        "niche": "fitness",
        "sub_niche": "crossfit",
        "primary_goal": "crecer audiencia",
        "tone": "motivacional",
        "target_audience": "adultos 25-40",
        "desired_frequency": None,
        "preferred_formats": [],
    }
    base.update(overrides)
    return base


def test_query_rag_calls_search_similar_once_with_grounded_query(monkeypatch):
    captured = {}

    def fake_search_similar(query, top_k=2):
        captured["query"] = query
        captured["top_k"] = top_k
        captured["calls"] = captured.get("calls", 0) + 1
        return [_FakeDoc("contenido relevante sobre fitness")]

    monkeypatch.setattr(
        calendar_agent.qdrant_search_service, "search_similar", fake_search_similar
    )
    state = {"profile": _profile()}
    result = query_rag(state)

    assert captured["query"] == "fitness crossfit"
    assert captured["top_k"] == 4
    assert captured["calls"] == 1
    assert result["rag_context"] != ""


def test_query_rag_grounds_query_with_empty_sub_niche(monkeypatch):
    captured = {}

    def fake_search_similar(query, top_k=2):
        captured["query"] = query
        return []

    monkeypatch.setattr(
        calendar_agent.qdrant_search_service, "search_similar", fake_search_similar
    )
    state = {"profile": _profile(sub_niche=None)}
    query_rag(state)
    assert captured["query"] == "fitness "


def test_query_rag_degrades_to_empty_context_on_search_failure(monkeypatch):
    def raising_search_similar(query, top_k=2):
        raise ConnectionError("Qdrant unreachable")

    monkeypatch.setattr(
        calendar_agent.qdrant_search_service, "search_similar", raising_search_similar
    )
    state = {"profile": _profile()}
    result = query_rag(state)  # must not raise
    assert result["rag_context"] == ""


def test_query_rag_empty_results_yields_empty_context(monkeypatch):
    monkeypatch.setattr(
        calendar_agent.qdrant_search_service,
        "search_similar",
        lambda query, top_k=2: [],
    )
    state = {"profile": _profile()}
    result = query_rag(state)
    assert result["rag_context"] == ""


# --- 4a.1: generate_ideas — happy path -----------------------------------


class _FakeStructuredLLM:
    def __init__(self, ainvoke_mock: AsyncMock):
        self.ainvoke = ainvoke_mock


def _generate_ideas_state(formats: dict[str, int] | None = None) -> dict:
    return {
        "profile": _profile(),
        "frequency": 4,
        "formats": formats or {"short_video": 2, "post": 1, "carousel": 1},
        "rag_context": "contexto relevante",
    }


def _conformant_idea(fmt: str, i: int) -> GeneratedIdea:
    return GeneratedIdea(
        title=f"Idea {fmt} {i}",
        format=fmt,
        platform="tiktok",
        hook=f"hook {i}",
        description=f"desc {i}",
    )


@pytest.mark.asyncio
async def test_generate_ideas_happy_path_returns_llm_ideas_unmodified(monkeypatch):
    state = _generate_ideas_state()
    target_count = sum(state["formats"].values())
    fmt_cycle = list(state["formats"].keys())
    conformant_ideas = [
        _conformant_idea(fmt_cycle[i % len(fmt_cycle)], i) for i in range(target_count)
    ]
    fake_result = GeneratedIdeasList(ideas=conformant_ideas)
    ainvoke_mock = AsyncMock(return_value=fake_result)

    def fake_with_structured_output(schema, method=None):
        return _FakeStructuredLLM(ainvoke_mock)

    monkeypatch.setattr(
        calendar_agent.llm_service.llm,
        "with_structured_output",
        fake_with_structured_output,
    )

    result = await generate_ideas(state)

    assert result["raw_ideas"] == [idea.model_dump() for idea in conformant_ideas]
    ainvoke_mock.assert_awaited_once()


# --- 4b.1: generate_ideas — repair/template fallback ladder --------------


def _schema_error() -> ValidationError:
    try:
        GeneratedIdea(title="", format="not_a_format", platform="x", hook="h", description="d")
    except ValidationError as e:
        return e
    raise AssertionError("expected ValidationError")


@pytest.mark.asyncio
async def test_generate_ideas_schema_failure_then_repair_success(monkeypatch):
    state = _generate_ideas_state()
    target_count = sum(state["formats"].values())
    fmt_cycle = list(state["formats"].keys())
    repaired_ideas = [
        _conformant_idea(fmt_cycle[i % len(fmt_cycle)], i) for i in range(target_count)
    ]
    ainvoke_mock = AsyncMock(
        side_effect=[_schema_error(), GeneratedIdeasList(ideas=repaired_ideas)]
    )

    def fake_with_structured_output(schema, method=None):
        return _FakeStructuredLLM(ainvoke_mock)

    monkeypatch.setattr(
        calendar_agent.llm_service.llm,
        "with_structured_output",
        fake_with_structured_output,
    )

    result = await generate_ideas(state)

    assert len(result["raw_ideas"]) == target_count
    assert result["raw_ideas"] == [idea.model_dump() for idea in repaired_ideas]
    assert ainvoke_mock.await_count == 2


@pytest.mark.asyncio
async def test_generate_ideas_repair_also_fails_pads_with_templates(monkeypatch):
    state = _generate_ideas_state()
    target_count = sum(state["formats"].values())
    ainvoke_mock = AsyncMock(side_effect=[_schema_error(), _schema_error()])

    def fake_with_structured_output(schema, method=None):
        return _FakeStructuredLLM(ainvoke_mock)

    monkeypatch.setattr(
        calendar_agent.llm_service.llm,
        "with_structured_output",
        fake_with_structured_output,
    )

    result = await generate_ideas(state)  # must not raise

    assert len(result["raw_ideas"]) == target_count
    for idea in result["raw_ideas"]:
        assert idea["format"] in state["formats"]
        assert idea["platform"] == DEFAULT_PLATFORM_BY_FORMAT[idea["format"]]


@pytest.mark.asyncio
async def test_generate_ideas_repair_returns_fewer_than_target_pads_shortfall(monkeypatch):
    state = _generate_ideas_state()
    target_count = sum(state["formats"].values())
    partial_ideas = [_conformant_idea("short_video", 0)]  # 1 idea, target is 4
    ainvoke_mock = AsyncMock(
        side_effect=[_schema_error(), GeneratedIdeasList(ideas=partial_ideas)]
    )

    def fake_with_structured_output(schema, method=None):
        return _FakeStructuredLLM(ainvoke_mock)

    monkeypatch.setattr(
        calendar_agent.llm_service.llm,
        "with_structured_output",
        fake_with_structured_output,
    )

    result = await generate_ideas(state)

    assert len(result["raw_ideas"]) == target_count


@pytest.mark.asyncio
async def test_generate_ideas_groq_api_status_error_triggers_repair_tier(monkeypatch):
    """Per the Phase 0 spike: LangChain does not wrap Groq's provider error —
    groq.APIStatusError (base of groq.BadRequestError, tool_use_failed)
    propagates raw and must be caught, not just OutputParserException/
    ValidationError."""
    state = _generate_ideas_state()
    target_count = sum(state["formats"].values())
    fmt_cycle = list(state["formats"].keys())
    repaired_ideas = [
        _conformant_idea(fmt_cycle[i % len(fmt_cycle)], i) for i in range(target_count)
    ]
    fake_response = httpx.Response(
        status_code=400,
        request=httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions"),
        json={"error": {"code": "tool_use_failed"}},
    )
    groq_error = groq.APIStatusError(
        "tool_use_failed",
        response=fake_response,
        body={"error": {"code": "tool_use_failed"}},
    )
    ainvoke_mock = AsyncMock(
        side_effect=[groq_error, GeneratedIdeasList(ideas=repaired_ideas)]
    )

    def fake_with_structured_output(schema, method=None):
        return _FakeStructuredLLM(ainvoke_mock)

    monkeypatch.setattr(
        calendar_agent.llm_service.llm,
        "with_structured_output",
        fake_with_structured_output,
    )

    result = await generate_ideas(state)  # must not raise

    assert len(result["raw_ideas"]) == target_count
    assert ainvoke_mock.await_count == 2


@pytest.mark.asyncio
async def test_generate_ideas_groq_connection_error_degrades_to_templates(monkeypatch):
    """A transport failure is not an APIStatusError — it is an
    APIConnectionError. It must still degrade to tier-3 template padding
    rather than escalating to a 500, per generate_ideas' never-raises
    exit criterion."""
    state = _generate_ideas_state()
    target_count = sum(state["formats"].values())
    connection_error = groq.APIConnectionError(
        request=httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions")
    )
    ainvoke_mock = AsyncMock(side_effect=connection_error)

    def fake_with_structured_output(schema, method=None):
        return _FakeStructuredLLM(ainvoke_mock)

    monkeypatch.setattr(
        calendar_agent.llm_service.llm,
        "with_structured_output",
        fake_with_structured_output,
    )

    result = await generate_ideas(state)  # must not raise

    assert len(result["raw_ideas"]) == target_count
    assert all(idea["hook"] for idea in result["raw_ideas"])


@pytest.mark.asyncio
async def test_generate_ideas_over_count_truncates_preserving_order(monkeypatch):
    state = _generate_ideas_state()
    target_count = sum(state["formats"].values())
    fmt_cycle = list(state["formats"].keys())
    excess_ideas = [
        _conformant_idea(fmt_cycle[i % len(fmt_cycle)], i) for i in range(target_count + 3)
    ]
    fake_result = GeneratedIdeasList(ideas=excess_ideas)
    ainvoke_mock = AsyncMock(return_value=fake_result)

    def fake_with_structured_output(schema, method=None):
        return _FakeStructuredLLM(ainvoke_mock)

    monkeypatch.setattr(
        calendar_agent.llm_service.llm,
        "with_structured_output",
        fake_with_structured_output,
    )

    result = await generate_ideas(state)

    assert len(result["raw_ideas"]) == target_count
    assert result["raw_ideas"] == [idea.model_dump() for idea in excess_ideas[:target_count]]


def test_template_idea_uses_default_platform_and_profile_fields():
    profile = _profile()
    idea = _template_idea("short_video", profile, 1)
    assert idea["format"] == "short_video"
    assert idea["platform"] == DEFAULT_PLATFORM_BY_FORMAT["short_video"]
    assert profile["niche"] in idea["title"]
    assert profile["primary_goal"] in idea["description"]


def test_template_idea_never_raises_on_missing_profile_fields():
    profile = {"niche": None, "primary_goal": None}
    idea = _template_idea("post", profile, 1)
    assert idea["format"] == "post"
    assert "tu nicho" in idea["title"]
    assert "tu objetivo" in idea["description"]


# --- 4b.1: StateGraph assembly -------------------------------------------


@pytest.mark.asyncio
async def test_calendar_app_runs_all_six_nodes_end_to_end(monkeypatch):
    """Fully mocked LLM/Qdrant — asserts calendar_app produces a complete,
    optimized CalendarState in one ainvoke call."""
    monkeypatch.setattr(
        calendar_agent.qdrant_search_service,
        "search_similar",
        lambda query, top_k=2: [_FakeDoc("contexto de conocimiento")],
    )

    formats = {"short_video": 2, "post": 2}
    target_count = sum(formats.values())
    fmt_cycle = list(formats.keys())
    conformant_ideas = [
        _conformant_idea(fmt_cycle[i % len(fmt_cycle)], i) for i in range(target_count)
    ]
    ainvoke_mock = AsyncMock(return_value=GeneratedIdeasList(ideas=conformant_ideas))

    def fake_with_structured_output(schema, method=None):
        return _FakeStructuredLLM(ainvoke_mock)

    monkeypatch.setattr(
        calendar_agent.llm_service.llm,
        "with_structured_output",
        fake_with_structured_output,
    )

    initial_state = {
        "user_id": "u1",
        "profile": _profile(),
        "calendar_id": None,
        "period": "current_week",
        "start_date": None,
        "end_date": None,
        "frequency": 4,
        "formats": formats,
        "rag_context": "",
        "raw_ideas": [],
        "calendar_entries": [],
        "is_optimized": False,
    }

    final_state = await calendar_app.ainvoke(initial_state)

    assert final_state["is_optimized"] is True
    assert len(final_state["calendar_entries"]) == target_count
