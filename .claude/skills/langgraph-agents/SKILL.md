---
name: langgraph-agents
description: >
  Skill para crear y modificar agentes LangGraph en ContentSpark. Usar cuando se trabaje
  con el agente de onboarding (recopilación de perfil del creador), el agente de calendario
  (generación de planes de contenido), o el pipeline CRAG (búsqueda RAG con fallback web).
  Contiene patrones de StateGraph, nodos conversacionales, nodos generadores, y reglas de
  streaming async para FastAPI.
---

# LangGraph Agent Development Skill

## Contexto
ContentSpark usa LangGraph para dos tipos de agentes: onboarding del creador y generación de calendarios de contenido, además del pipeline CRAG para búsqueda RAG.

## Estructura base de un agente

```python
from typing import TypedDict, List, Optional
from langgraph.graph import StateGraph, END
from langchain_core.messages import SystemMessage, HumanMessage
from app.services.llm_services import llm_service

# 1. Definir el estado
class AgentState(TypedDict):
    # Datos que viajan por todo el grafo
    user_id: str
    messages: List[dict]
    current_step: str
    collected_data: dict
    is_complete: bool

# 2. Definir nodos (funciones)
def step_one(state: AgentState) -> dict:
    """Cada nodo recibe el estado y retorna updates."""
    print("   [AGENTE] Nodo: step_one")
    # Lógica del paso
    return {"current_step": "step_two", "collected_data": {...}}

def step_two(state: AgentState) -> dict:
    print("   [AGENTE] Nodo: step_two")
    return {"current_step": "done", "is_complete": True}

# 3. Definir routing condicional
def decide_next(state: AgentState) -> str:
    if state["is_complete"]:
        return END
    return state["current_step"]

# 4. Compilar el grafo
workflow = StateGraph(AgentState)
workflow.add_node("step_one", step_one)
workflow.add_node("step_two", step_two)
workflow.set_entry_point("step_one")
workflow.add_conditional_edges("step_one", decide_next)
workflow.add_edge("step_two", END)

agent = workflow.compile()
```

## Patrón para agentes conversacionales (onboarding)

El agente de onboarding necesita intercalar con el usuario: pregunta → respuesta → validación → siguiente pregunta.

```python
class OnboardingState(TypedDict):
    user_id: str
    user_message: str          # Último mensaje del usuario
    current_field: str         # Campo que estamos recopilando
    profile_data: dict         # Datos ya recopilados
    response: str              # Respuesta del agente al usuario
    is_complete: bool

FIELDS_ORDER = [
    "display_name", "socials", "niche", "sub_niche",
    "primary_goal", "frequency", "formats", "tone", "audience"
]

def ask_question(state: OnboardingState) -> dict:
    """Genera la pregunta para el campo actual."""
    print(f"   [ONBOARDING] Preguntando sobre: {state['current_field']}")
    field = state["current_field"]
    profile = state["profile_data"]
    
    prompt = f"""Eres el asistente de onboarding de ContentSpark.
    Ya recopilaste: {profile}
    Ahora necesitas preguntar sobre: {field}
    Genera una pregunta natural, amigable y breve."""
    
    response = llm_service.llm.invoke([
        SystemMessage(content=prompt)
    ])
    
    return {"response": response.content}

def validate_answer(state: OnboardingState) -> dict:
    """Valida la respuesta del usuario para el campo actual."""
    print(f"   [ONBOARDING] Validando respuesta para: {state['current_field']}")
    field = state["current_field"]
    answer = state["user_message"]
    
    prompt = f"""Valida si esta respuesta es adecuada para el campo '{field}':
    Respuesta: {answer}
    
    Responde en JSON: {{"valid": true/false, "extracted_value": "...", "clarification": "..."}}"""
    
    # Procesar validación...
    return {"profile_data": {**state["profile_data"], field: extracted_value}}

def advance_field(state: OnboardingState) -> str:
    """Determina el siguiente campo o si terminamos."""
    current_idx = FIELDS_ORDER.index(state["current_field"])
    if current_idx + 1 >= len(FIELDS_ORDER):
        return "generate_summary"
    return "ask_question"
```

## Patrón para agentes generadores (calendario)

El agente de calendario no es conversacional — recibe parámetros y genera output.

```python
class CalendarState(TypedDict):
    user_id: str
    profile: dict              # Perfil del creador (de la DB)
    frequency: int             # Posts por semana
    period_start: str          # Fecha inicio
    period_end: str            # Fecha fin
    format_distribution: dict  # {"short_video": 3, "carousel": 2}
    rag_context: str           # Contexto recuperado de Qdrant
    entries: list              # Entries generadas
    is_optimized: bool

async def load_profile(state: CalendarState) -> dict:
    """Carga el perfil del creador desde la DB via SQLAlchemy."""
    print(f"   [CALENDARIO] Cargando perfil para user: {state['user_id']}")
    # Query con AsyncSession de SQLAlchemy
    # async with get_session() as session:
    #     result = await session.execute(select(CreatorProfile).where(...))
    return {"profile": profile_data}

async def query_rag(state: CalendarState) -> dict:
    """Consulta la base RAG para obtener frameworks relevantes."""
    print(f"   [CALENDARIO] Consultando RAG para nicho: {state['profile']['niche']}")
    niche = state["profile"]["niche"]
    results = qdrant_search_service.vector_store.similarity_search(
        f"estrategia de contenido para {niche} formatos y frecuencia",
        k=4
    )
    context = "\n".join([r.page_content for r in results])
    return {"rag_context": context}

async def generate_entries(state: CalendarState) -> dict:
    """Genera las entries del calendario."""
    print(f"   [CALENDARIO] Generando {state['frequency']} entries/semana")
    prompt = f"""Genera un calendario de contenido para un creador de {state['profile']['niche']}.
    
    Perfil: {state['profile']}
    Frecuencia: {state['frequency']} posts/semana
    Período: {state['period_start']} a {state['period_end']}
    Distribución: {state['format_distribution']}
    
    Contexto de la base de conocimiento:
    {state['rag_context']}
    
    Genera un JSON array con entries..."""
    
    # Generar con LLM
    return {"entries": parsed_entries}

async def optimize_distribution(state: CalendarState) -> dict:
    """Optimiza: no repetir formatos consecutivos, variar temas."""
    print("   [CALENDARIO] Optimizando distribución")
    entries = state["entries"]
    # Lógica de optimización
    return {"entries": optimized_entries, "is_optimized": True}
```

## Reglas para agentes en ContentSpark

1. SIEMPRE usar `ainvoke` o `astream` (async) para no bloquear FastAPI.
2. Cada nodo debe tener un print de debug: `print(f"   [AGENTE] Nodo: {nombre}")`.
3. El estado debe incluir `user_id` para filtrar datos por usuario.
4. Los prompts del agente deben ser en español.
5. Usar el LLM de Groq (Llama 3.1 8B) para generación, no Gemini.
6. Para streaming al frontend, usar el patrón `async generator`:
   ```python
   async def stream_response(state):
       async for chunk in llm_service.llm.astream(messages):
           if hasattr(chunk, "content"):
               yield chunk.content
   ```
7. Los agentes no acceden directamente a la DB — usan servicios que manejan SQLAlchemy `AsyncSession`.
8. Manejar errores con try/catch en cada nodo — un fallo en un nodo no debe crashear el grafo completo.
9. Para persistir datos (perfil, calendario), pasar la sesión de SQLAlchemy al servicio correspondiente, no al agente directamente.
