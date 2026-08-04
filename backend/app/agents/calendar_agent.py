# Fase 3: Agente generador de calendarios de contenido con LangGraph
# Flujo: receive_params -> analyze_profile -> query_rag ->
#        generate_ideas -> optimize_distribution -> format_calendar
#
# Unit 3 (this file, so far): the 4 deterministic, LLM/DB/Qdrant-free nodes
# (receive_params, analyze_profile, optimize_distribution, format_calendar)
# and their 3 shared pure helpers. `query_rag`/`generate_ideas` land in
# Unit 4; the StateGraph itself is wired in task 4b once all 6 nodes exist.
from __future__ import annotations

import calendar
from collections import Counter, deque
from datetime import date, timedelta

from app.agents.shared_state import CalendarState

# Debe reflejar exactamente frontend/shared/constants/index.ts:26 —
# FREQUENCY_RECOMMENDATIONS (posts recomendados por semana, por nicho).
FREQUENCY_RECOMMENDATIONS: dict[str, int] = {
    "tecnologia": 5,
    "fitness": 6,
    "finanzas": 4,
    "educacion": 3,
    "lifestyle": 6,
    "negocios": 4,
}

# Fallback cuando el request no trae frequency y el nicho del perfil no
# tiene entrada en FREQUENCY_RECOMMENDATIONS (o es None).
DEFAULT_FREQUENCY = 4

# Mezcla de formatos por defecto cuando el request no trae formats y el
# perfil no tiene preferred_formats. Las claves pertenecen al FormatLiteral
# cerrado (design.md §6/§7).
DEFAULT_FORMAT_MIX: dict[str, int] = {
    "short_video": 2,
    "post": 1,
    "carousel": 1,
}

TIME_SLOTS = ["morning", "afternoon", "evening"]


def _resolve_period(period: str) -> tuple[date, date]:
    """Resuelve un PeriodLiteral al rango [start, end] inclusive."""
    today = date.today()
    if period == "current_week":
        start = today - timedelta(days=today.isoweekday() - 1)  # lunes
        return start, start + timedelta(days=6)  # domingo
    if period == "next_week":
        start = today - timedelta(days=today.isoweekday() - 1) + timedelta(days=7)
        return start, start + timedelta(days=6)
    if period == "month":
        start = today.replace(day=1)
        _, last_day = calendar.monthrange(today.year, today.month)
        return start, today.replace(day=last_day)
    raise ValueError(f"unknown period: {period}")  # unreachable — Literal-validated upstream


def _entry_count(frequency: int, start_date: date, end_date: date) -> int:
    """Escala la frecuencia semanal al número de entradas del período."""
    total_days = (end_date - start_date).days + 1
    weeks = total_days / 7
    return max(1, round(frequency * weeks))


def _distribute(entry_count: int, weights: list[str]) -> dict[str, int]:
    """Reparto por resto mayor: sum(result.values()) == entry_count siempre."""
    n = len(weights)
    base, remainder = divmod(entry_count, n)
    counts = {f: base for f in weights}
    # Reparte el resto a los primeros `remainder` formatos (orden estable)
    for f in weights[:remainder]:
        counts[f] += 1
    return counts


def receive_params(state: CalendarState) -> dict:
    """Nodo puro: resuelve start_date/end_date e inicializa acumuladores."""
    start_date, end_date = _resolve_period(state["period"])
    return {
        "start_date": start_date,
        "end_date": end_date,
        "rag_context": "",
        "raw_ideas": [],
        "calendar_entries": [],
        "is_optimized": False,
    }


def analyze_profile(state: CalendarState) -> dict:
    """Nodo puro: resuelve frequency/formats. Nunca parsea desired_frequency
    (texto libre) y nunca lanza excepción ante un nicho desconocido."""
    profile = state["profile"]

    frequency = state.get("frequency")
    if not frequency:
        niche = profile.get("niche")
        frequency = FREQUENCY_RECOMMENDATIONS.get(niche, DEFAULT_FREQUENCY)

    formats = state.get("formats")
    if not formats:
        # Distribuir sobre el conteo escalado al período (no la frecuencia
        # semanal cruda) — para "month" no son lo mismo (~17 vs 4).
        entry_count = _entry_count(frequency, state["start_date"], state["end_date"])
        preferred = profile.get("preferred_formats") or []
        if preferred:
            formats = _distribute(entry_count, preferred)
        else:
            formats = _distribute(entry_count, list(DEFAULT_FORMAT_MIX.keys()))

    return {"frequency": frequency, "formats": formats}


def optimize_distribution(raw_ideas: list[dict]) -> list[dict]:
    """Reordena raw_ideas para que ningún par de entradas consecutivas
    comparta format. Degrada al mínimo de repeticiones forzadas (no lanza)
    cuando el desbalance de formatos hace imposible la restricción estricta.
    """
    buckets: dict[str, deque[dict]] = {}
    for idea in raw_ideas:
        buckets.setdefault(idea["format"], deque()).append(idea)
    counts = Counter({fmt: len(q) for fmt, q in buckets.items()})

    ordered: list[dict] = []
    last_format: str | None = None
    while counts:
        # Mayor conteo restante, excluyendo last_format si hay alternativa
        candidates = [f for f in counts if f != last_format] or list(counts)
        fmt = max(candidates, key=lambda f: counts[f])
        idea = buckets[fmt].popleft()
        ordered.append(idea)
        counts[fmt] -= 1
        if counts[fmt] == 0:
            del counts[fmt]
        last_format = fmt
    return ordered


def format_calendar(
    ordered_ideas: list[dict], start_date: date, end_date: date
) -> list[dict]:
    """Asigna date/time_slot a cada idea ya optimizada, dentro de
    [start_date, end_date] inclusive. Avanza al siguiente día libre en caso
    de colisión, topando en end_date."""
    n = len(ordered_ideas)
    if n == 0:
        # Inalcanzable en producción (generate_ideas siempre rellena hasta
        # entry_count con plantillas), pero no debe ser un crash si ocurriera.
        return []
    total_days = (end_date - start_date).days + 1
    step = total_days / n
    entries = []
    used_dates: set[date] = set()
    for i, idea in enumerate(ordered_ideas):
        target = start_date + timedelta(days=round(i * step))
        while target in used_dates and target < end_date:
            target += timedelta(days=1)
        used_dates.add(target)
        entries.append(
            {
                **idea,
                "date": target,
                "time_slot": TIME_SLOTS[i % 3],
            }
        )
    return entries
