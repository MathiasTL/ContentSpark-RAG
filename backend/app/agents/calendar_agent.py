# Fase 3/4: Agente generador de calendarios de contenido con LangGraph
# Flujo: receive_params -> analyze_profile -> query_rag ->
#        generate_ideas -> optimize_distribution -> format_calendar
#
# Unit 3: los 4 nodos deterministas, sin LLM/DB/Qdrant (receive_params,
# analyze_profile, optimize_distribution, format_calendar) y sus 3 helpers
# puros compartidos.
# Unit 4 (this file, added here): `query_rag` (un único query a Qdrant, con
# degradación a contexto vacío), `generate_ideas` (el único llamado a Groq,
# con escalera de fallback de 3 niveles — repair retry + relleno con
# plantillas), y el ensamblado final del `StateGraph` como `calendar_app`.
from __future__ import annotations

import calendar
from collections import Counter, deque
from datetime import date, timedelta
from typing import Literal

import groq
from langchain_core.exceptions import OutputParserException
from langchain_core.messages import HumanMessage
from langgraph.graph import END, StateGraph
from pydantic import BaseModel, Field, ValidationError

from app.agents.shared_state import CalendarState
from app.services.llm_services import llm_service
from app.services.qdrant_services import qdrant_search_service

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

# Plataforma por defecto usada por el tier 3 (relleno con plantillas) de
# generate_ideas, cuando no hay señal del LLM para elegirla. Las claves
# pertenecen al FormatLiteral cerrado, los valores al PlatformLiteral cerrado
# (design.md §6/§7).
DEFAULT_PLATFORM_BY_FORMAT: dict[str, str] = {
    "short_video": "tiktok",
    "carousel": "instagram",
    "story": "instagram",
    "long_video": "youtube",
    "post": "linkedin",
}

FormatLiteral = Literal["short_video", "carousel", "story", "long_video", "post"]
PlatformLiteral = Literal["tiktok", "instagram", "youtube", "linkedin", "x"]


class GeneratedIdea(BaseModel):
    """Una idea de contenido individual, salida estructurada del LLM."""

    title: str = Field(min_length=1, max_length=255)
    format: FormatLiteral
    platform: PlatformLiteral
    hook: str
    description: str


class GeneratedIdeasList(BaseModel):
    """Envoltorio de lista requerido por with_structured_output — Groq en
    modo json_mode necesita un objeto JSON raíz, no un array suelto."""

    ideas: list[GeneratedIdea]


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


def query_rag(state: CalendarState) -> dict:
    """Nodo: un único query a Qdrant, grounded en el niche/sub_niche del
    perfil (Decision 2 — no un query por entrada). Cualquier fallo
    (conexión, timeout, resultado vacío) degrada a rag_context="" sin
    lanzar excepción — a diferencia de CRAG (rag_service.py), este nodo NO
    hace fallback a búsqueda web."""
    profile = state["profile"]
    query = f"{profile['niche']} {profile['sub_niche'] or ''}"
    try:
        results = qdrant_search_service.search_similar(query, top_k=4)
    except Exception as e:
        print(f"   [calendar_agent] query_rag: Qdrant fallo, degradando a contexto vacio: {e}")
        return {"rag_context": ""}

    if not results:
        return {"rag_context": ""}

    rag_context = "\n\n".join(doc.page_content for doc in results)
    return {"rag_context": rag_context}


def _build_ideas_prompt(
    profile: dict, frequency: int, formats: dict[str, int], rag_context: str
) -> str:
    """Construye el prompt de generate_ideas. Debe contener la palabra
    literal 'JSON' y describir la forma esperada explícitamente: en modo
    json_mode Groq no recibe el schema de la tool, solo texto plano."""
    format_lines = "\n".join(
        f"- {count} idea(s) de formato '{fmt}'" for fmt, count in formats.items()
    )
    target_count = sum(formats.values())
    context_block = rag_context or "No hay contexto adicional disponible; usa tu conocimiento general sobre creación de contenido."

    return f"""Eres un estratega de contenido experto. Genera ideas de contenido para un creador con este perfil:

- Nicho: {profile.get('niche') or 'sin especificar'}
- Sub-nicho: {profile.get('sub_niche') or 'sin especificar'}
- Objetivo principal: {profile.get('primary_goal') or 'sin especificar'}
- Tono: {profile.get('tone') or 'sin especificar'}
- Audiencia objetivo: {profile.get('target_audience') or 'sin especificar'}

Contexto de la base de conocimiento:
{context_block}

Debes generar exactamente {target_count} ideas en total, distribuidas así:
{format_lines}

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, con esta forma exacta:
{{"ideas": [{{"title": "...", "format": "...", "platform": "...", "hook": "...", "description": "..."}}, ...]}}

Donde "format" debe ser uno de: short_video, carousel, story, long_video, post.
Y "platform" debe ser uno de: tiktok, instagram, youtube, linkedin, x."""


def _template_idea(fmt: str, profile: dict, index: int) -> dict:
    """Idea 100% determinista, sin LLM — tier 3 de la escalera de fallback
    de generate_ideas. Nunca lanza excepción."""
    return {
        "title": f"Idea de {fmt} #{index} para {profile.get('niche') or 'tu nicho'}",
        "format": fmt,
        "platform": DEFAULT_PLATFORM_BY_FORMAT[fmt],
        "hook": "Hook pendiente de personalizar",
        "description": f"Contenido sobre {profile.get('primary_goal') or 'tu objetivo'}.",
    }


async def generate_ideas(state: CalendarState) -> dict:
    """Nodo: el único llamado a Groq del grafo, con escalera de fallback de
    3 niveles (design.md §6, revisado por el spike de Phase 0):

    1. Happy path: with_structured_output(GeneratedIdeasList, method="json_mode").
    2. Fallo de schema/tool-call -> un único reintento con prompt de reparación.
       Catch de OutputParserException, pydantic ValidationError y
       groq.APIStatusError (base de groq.BadRequestError) — LangChain NO
       envuelve el error de Groq, propaga groq.APIStatusError crudo.
    3. Reintento también falla, o devuelve menos ideas que el objetivo ->
       relleno determinista con plantillas (_template_idea), sin LLM.
    4. Si sobran ideas, se truncan preservando el orden.

    Este nodo NUNCA lanza excepción bajo ninguno de estos 4 casos."""
    profile = state["profile"]
    frequency = state["frequency"]
    formats = state["formats"]
    rag_context = state["rag_context"]
    target_count = sum(formats.values())

    prompt = _build_ideas_prompt(profile, frequency, formats, rag_context)
    structured_llm = llm_service.llm.with_structured_output(
        GeneratedIdeasList, method="json_mode"
    )

    ideas: list[dict] = []
    try:
        result: GeneratedIdeasList = await structured_llm.ainvoke(
            [HumanMessage(content=prompt)]
        )
        ideas = [idea.model_dump() for idea in result.ideas]
    except (OutputParserException, ValidationError, groq.APIError) as e:
        # `groq.APIError` es la clase base: cubre tanto `APIStatusError`
        # (el `tool_use_failed` medido en el spike) como `APIConnectionError`/
        # `APITimeoutError`. Un fallo de transporte tiene que degradar a
        # plantillas igual que un fallo de schema, nunca escalar a un 500.
        # Tier 2: reintento único con prompt de reparación. No es una
        # garantía de recuperación (spike de Phase 0: no-determinista) — es
        # best-effort, tier 3 cubre el caso en que también falla.
        print(
            f"   [calendar_agent] generate_ideas: fallo de schema/tool-call "
            f"({type(e).__name__}), reintentando con prompt de reparacion: {e}"
        )
        repair_prompt = f"""{prompt}

Tu respuesta anterior no fue JSON válido o no cumplió el schema esperado. Error: {e}

Recuerda: responde ÚNICAMENTE con JSON válido, con exactamente {target_count} ideas en total, respetando la distribución de formatos indicada arriba."""
        try:
            result = await structured_llm.ainvoke([HumanMessage(content=repair_prompt)])
            ideas = [idea.model_dump() for idea in result.ideas]
        except (OutputParserException, ValidationError, groq.APIError) as repair_error:
            print(
                f"   [calendar_agent] generate_ideas: reintento de reparacion "
                f"tambien fallo ({type(repair_error).__name__}): {repair_error}"
            )
            ideas = []

    if len(ideas) < target_count:
        # Tier 3: relleno determinista con plantillas. El spike de Phase 0
        # mostró que este tier se ejecuta de forma rutinaria, no rara vez —
        # por eso emite una línea de log distinta cada vez que se dispara.
        shortfall = target_count - len(ideas)
        print(
            f"   [calendar_agent] generate_ideas: TIER 3 (plantillas) activado — "
            f"rellenando {shortfall} de {target_count} ideas sin LLM"
        )
        remaining_by_format: Counter = Counter(formats)
        for idea in ideas:
            fmt = idea.get("format")
            if fmt in remaining_by_format:
                remaining_by_format[fmt] -= 1
        pending_formats = list(remaining_by_format.elements())
        # Si el LLM devolvió formatos fuera del mix objetivo, pending_formats
        # puede quedar corto — se completa con el primer formato objetivo.
        while len(pending_formats) < shortfall:
            pending_formats.append(next(iter(formats)))
        for index, fmt in enumerate(pending_formats[:shortfall], start=1):
            ideas.append(_template_idea(fmt, profile, index))

    if len(ideas) > target_count:
        # Tier 4: exceso -> truncar preservando el orden, no es un error.
        ideas = ideas[:target_count]

    return {"raw_ideas": ideas}


def _optimize_distribution_node(state: CalendarState) -> dict:
    """Envoltorio delgado (state) -> dict alrededor del algoritmo puro
    optimize_distribution. Marca is_optimized=True incondicionalmente, aun
    en el caso degradado (design.md §5d)."""
    ordered = optimize_distribution(state["raw_ideas"])
    return {"raw_ideas": ordered, "is_optimized": True}


def _format_calendar_node(state: CalendarState) -> dict:
    """Envoltorio delgado (state) -> dict alrededor del algoritmo puro
    format_calendar."""
    entries = format_calendar(state["raw_ideas"], state["start_date"], state["end_date"])
    return {"calendar_entries": entries}


# ==========================================
# StateGraph: receive_params -> analyze_profile -> query_rag ->
#             generate_ideas -> optimize_distribution -> format_calendar
# ==========================================
_workflow = StateGraph(CalendarState)
_workflow.add_node("receive_params", receive_params)
_workflow.add_node("analyze_profile", analyze_profile)
_workflow.add_node("query_rag", query_rag)
_workflow.add_node("generate_ideas", generate_ideas)
_workflow.add_node("optimize_distribution", _optimize_distribution_node)
_workflow.add_node("format_calendar", _format_calendar_node)

_workflow.set_entry_point("receive_params")
_workflow.add_edge("receive_params", "analyze_profile")
_workflow.add_edge("analyze_profile", "query_rag")
_workflow.add_edge("query_rag", "generate_ideas")
_workflow.add_edge("generate_ideas", "optimize_distribution")
_workflow.add_edge("optimize_distribution", "format_calendar")
_workflow.add_edge("format_calendar", END)

calendar_app = _workflow.compile()
