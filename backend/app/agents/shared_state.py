# TypedDicts compartidos entre agentes LangGraph
from typing import Any, TypedDict


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
    profile: dict
    frequency: int
    period: str
    formats: dict
    rag_context: str
    calendar_entries: list[dict]
    is_optimized: bool
