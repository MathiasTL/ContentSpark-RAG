from typing import AsyncGenerator, TypedDict, List
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langchain_core.documents import Document
from langchain_community.tools import DuckDuckGoSearchResults
from langgraph.graph import StateGraph, END

from app.services.llm_services import llm_service
from app.services.qdrant_services import qdrant_search_service

# ==========================================
# 1. CONFIGURACIÓN Y CONSTANTES
# ==========================================
MAX_HISTORY_TURNS = 6
TOP_K_DOCUMENTS = 4
SCORE_THRESHOLD = 0.35

# ==========================================
# 2. ESTADO DEL GRAFO
# ==========================================
class GraphState(TypedDict):
    question: str
    original_question: str
    documents: List[Document]
    web_search: bool
    history: List

# ==========================================
# 3. UTILIDADES DE HISTORIAL
# ==========================================
def trim_history(history: list) -> list:
    """Mantiene solo los últimos N turnos de conversación para evitar overflow de tokens."""
    if not history or len(history) <= MAX_HISTORY_TURNS:
        return history or []
    return history[-MAX_HISTORY_TURNS:]

def get_message_content(msg) -> tuple:
    """Extrae role y content de un mensaje, soportando dicts y objetos Pydantic."""
    role = getattr(msg, 'role', None) or (msg['role'] if isinstance(msg, dict) else None)
    content = getattr(msg, 'content', None) or (msg['content'] if isinstance(msg, dict) else None)
    return role, content

async def rewrite_query(question: str, history: list) -> str:
    """
    Reescribe preguntas ambiguas usando el contexto del historial.
    Convierte "¿y cómo aplico eso en Reels?" en una pregunta autocontenida
    como "¿Cómo aplicar la técnica de hooks de curiosidad en Instagram Reels?"
    para que Qdrant pueda encontrar fragmentos relevantes.
    """
    if not history:
        return question

    # Solo usamos los últimos 4 mensajes para el rewrite (suficiente contexto, bajo costo)
    recent = history[-4:]

    history_text = "\n".join([
        f"{'Usuario' if role == 'user' else 'AI'}: {content}"
        for m in recent
        for role, content in [get_message_content(m)]
        if role and content
    ])

    rewrite_prompt = f"""Dado este historial de conversación, reescribe la última pregunta para que sea completamente autocontenida y clara. Reemplaza pronombres ambiguos como "eso", "lo anterior", "esa técnica", etc. con los términos concretos del historial.

Si la pregunta ya es clara y autocontenida, devuélvela tal cual.

Historial:
{history_text}

Última pregunta: {question}

Responde ÚNICAMENTE con la pregunta reescrita, sin explicaciones ni texto adicional."""

    try:
        response = await llm_service.llm.ainvoke([HumanMessage(content=rewrite_prompt)])
        rewritten = response.content.strip()
        
        # Validación básica: si el rewrite es vacío o demasiado largo, usamos el original
        if not rewritten or len(rewritten) > len(question) * 3:
            return question
            
        print(f"   Query original: '{question}'")
        print(f"   Query reescrito: '{rewritten}'")
        return rewritten
        
    except Exception as e:
        print(f"   Error en query rewriting, usando query original: {e}")
        return question

# ==========================================
# 4. UTILIDADES DE PROMPT
# ==========================================
def build_context_text(documents: List[Document]) -> str:
    if not documents:
        return "No se encontró información relevante en la base de conocimiento."
    
    return "\n\n".join([
        f"[Fuente: {doc.metadata.get('source', 'Desconocida')}]\n{doc.page_content}"
        for doc in documents
    ])

def build_system_prompt(context_text: str) -> str:
    return f"""Eres ContentSpark, un asistente Senior experto en creación de contenido digital para plataformas como TikTok, Instagram Reels, YouTube Shorts y redes sociales en general.

INSTRUCCIONES DE COMPORTAMIENTO:
1. Responde basándote PRINCIPALMENTE en el contexto recuperado de la base de conocimiento.
2. Si el contexto no contiene información suficiente, indícalo claramente y ofrece consejos generales basados en tu conocimiento.
3. Si la premisa del usuario es incorrecta según el contexto, corrígelo de forma educada y constructiva.
4. Cita la fuente cuando sea relevante (ej: "Según [nombre del PDF]...").

INSTRUCCIONES DE FORMATO:
- Usa formato Markdown: **negritas** para conceptos clave, listas numeradas o viñetas cuando sea apropiado.
- Sé conciso pero completo. Prioriza información accionable sobre teoría.
- Cuando des ejemplos de hooks, scripts o copies, formátealos claramente separados del texto explicativo.

CONTEXTO RECUPERADO DE LA BASE DE CONOCIMIENTO:
{context_text}
"""

def build_messages(question: str, documents: List[Document], history: list) -> list:
    context_text = build_context_text(documents)
    system_prompt = build_system_prompt(context_text)
    messages = [SystemMessage(content=system_prompt)]

    if history:
        for msg in history:
            role, content = get_message_content(msg)
            if role == "user" and content:
                messages.append(HumanMessage(content=content))
            elif role == "ai" and content:
                messages.append(AIMessage(content=content))

    messages.append(HumanMessage(content=question))
    return messages

# ==========================================
# 5. NODOS DEL GRAFO
# ==========================================
def retrieve(state: GraphState):
    """
    Recupera documentos de Qdrant usando el query (ya reescrito si fue necesario).
    Usa similarity_search_with_score para poder filtrar por relevancia.
    """
    print(f"   [GRAFO] Recuperando documentos de Qdrant...")
    question = state['question']
    
    # Usamos similarity_search_with_score para filtrar por calidad
    raw_results = qdrant_search_service.vector_store.similarity_search_with_score(
        question, k=TOP_K_DOCUMENTS
    )
    
    # Filtramos por score threshold (en Qdrant con cosine, mayor = mejor)
    filtered_docs = []
    for doc, score in raw_results:
        print(f"   -> Score: {score:.3f} | Fuente: {doc.metadata.get('source', '?')}")
        if score >= SCORE_THRESHOLD:
            filtered_docs.append(doc)
        else:
            print(f"      Descartado (score < {SCORE_THRESHOLD})")
    
    web_search = len(filtered_docs) == 0
    
    if web_search:
        print("   -> Ningún documento superó el threshold. Activando Web Search.")
    else:
        print(f"   -> {len(filtered_docs)} documentos relevantes encontrados.")
    
    return {
        "documents": filtered_docs,
        "question": question,
        "web_search": web_search
    }

def web_search_node(state: GraphState):
    """Búsqueda web como fallback cuando no hay documentos relevantes en Qdrant."""
    print("   [GRAFO] Realizando búsqueda en internet (DuckDuckGo)...")
    question = state["question"]
    documents = state["documents"]
    
    try:
        search = DuckDuckGoSearchResults()
        docs_string = search.invoke({"query": question})
        
        web_results = Document(
            page_content=docs_string,
            metadata={"source": "Búsqueda Web (DuckDuckGo)"}
        )
        documents.append(web_results)
    except Exception as e:
        print(f"   Error en búsqueda web: {e}")
    
    return {"documents": documents, "question": question}

def decide_to_generate(state: GraphState):
    """Decide si buscar en la web o pasar directo a generar."""
    if state["web_search"]:
        print("   [DECISIÓN] Faltan datos. Derivando a Búsqueda Web.")
        return "web_search"
    else:
        print("   [DECISIÓN] Datos suficientes. Generando respuesta.")
        return END

# ==========================================
# 6. COMPILACIÓN DEL GRAFO
# ==========================================
workflow = StateGraph(GraphState)

workflow.add_node("retrieve", retrieve)
workflow.add_node("web_search", web_search_node)

workflow.set_entry_point("retrieve")

workflow.add_conditional_edges(
    "retrieve",
    decide_to_generate,
    {
        "web_search": "web_search",
        END: END,
    }
)
workflow.add_edge("web_search", END)

crag_app = workflow.compile()

# ==========================================
# 7. SERVICIO API (STREAMING)
# ==========================================
class RAGService:
    async def generate_response_stream(self, user_message: str, history: list = None) -> AsyncGenerator[str, None]:
        """
        Pipeline RAG mejorado:
        1. Recorta historial a los últimos N turnos (ventana deslizante).
        2. Reescribe el query usando contexto conversacional (query rewriting).
        3. Ejecuta el grafo CRAG con el query mejorado (retrieve + score filter + web fallback).
        4. Construye prompt con contexto recuperado + historial recortado.
        5. Streamea la respuesta del LLM al frontend.
        """
        print(f"\n{'='*50}")
        print(f"NUEVA PETICIÓN: {user_message[:80]}...")
        print(f"{'='*50}")
        
        # 1. RECORTAR HISTORIAL
        trimmed_history = trim_history(history)
        print(f"   Historial: {len(history or [])} mensajes -> {len(trimmed_history)} (recortado)")
        
        # 2. QUERY REWRITING (antes del grafo, porque es async)
        rewritten_query = await rewrite_query(user_message, trimmed_history)
        
        # 3. EJECUTAR GRAFO CRAG
        inputs = {
            "question": rewritten_query,
            "original_question": user_message,
            "documents": [],
            "web_search": False,
            "history": trimmed_history
        }
        
        final_state = crag_app.invoke(inputs)
        
        # 4. CONSTRUIR PROMPT (con la pregunta ORIGINAL para naturalidad en la respuesta)
        messages = build_messages(
            user_message,  # Usamos la pregunta original, no la reescrita
            final_state["documents"],
            trimmed_history
        )
        
        print("   Generando respuesta final con Llama 3 (Streaming)...")
        
        # 5. STREAMING
        async for chunk in llm_service.llm.astream(messages):
            if hasattr(chunk, "content"):
                yield chunk.content
            elif isinstance(chunk, str):
                yield chunk

rag_service = RAGService()