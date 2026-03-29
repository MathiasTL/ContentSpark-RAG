# TypedDicts compartidos entre agentes LangGraph
from typing import TypedDict, List, Optional, Any


class RAGState(TypedDict):
    """Estado del agente CRAG."""
    question: str
    history: List[dict]
    rewritten_query: str
    documents: List[Any]
    needs_web_search: bool
    web_results: List[Any]
    response: str


class OnboardingState(TypedDict):
    """Estado del agente de onboarding."""
    user_id: str
    current_step: str
    messages: List[dict]
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
    calendar_entries: List[dict]
    is_optimized: bool
