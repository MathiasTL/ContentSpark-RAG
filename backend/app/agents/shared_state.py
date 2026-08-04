# TypedDicts compartidos entre agentes LangGraph
from datetime import date
from typing import Any, Literal, TypedDict


class RAGState(TypedDict):
    """Estado del agente CRAG."""
    question: str
    history: list[dict]
    rewritten_query: str
    documents: list[Any]
    needs_web_search: bool
    web_results: list[Any]
    response: str


class OnboardingState(TypedDict):
    """Estado del agente de onboarding."""
    user_id: str
    current_step: str
    messages: list[dict]
    profile_data: dict
    is_complete: bool


class CalendarState(TypedDict):
    """Estado del agente de calendario."""
    user_id: str
    profile: dict                      # narrowed subset, see design.md §3
    calendar_id: str | None            # existing draft being regenerated, else None
    period: Literal["current_week", "next_week", "month"]
    start_date: date                   # resolved from period
    end_date: date                     # resolved from period, inclusive
    frequency: int                     # RESOLVED (Decision 7 fallback already applied)
    formats: dict[str, int]            # RESOLVED format -> count map, sums to the
                                        # period-scaled entry count (== frequency
                                        # only for the weekly periods, see _entry_count)
    rag_context: str                   # "" on Qdrant failure/empty result, never None
    raw_ideas: list[dict]              # generate_ideas output, pre-optimization
    calendar_entries: list[dict]       # optimize_distribution/format_calendar output
    is_optimized: bool                 # True only after optimize_distribution runs
