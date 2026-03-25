from typing import AsyncGenerator, TypedDict, List
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langchain_core.documents import Document
from langchain_community.tools import DuckDuckGoSearchResults
from langchain_core.prompts import PromptTemplate
from langgraph.graph import StateGraph, END
from pydantic import BaseModel, Field

from app.services.llm_services import llm_service
from app.services.qdrant_services import qdrant_search_service

# ==========================================
# 1. ESTADO DEL GRAFO Y UTILIDADES
# ==========================================
class GraphState(TypedDict):
    question: str
    documents: List[Document]
    web_search: bool
    history: List

def build_context_text(documents: List[Document]) -> str:
    return "\n\n".join([
        f"[Fuente: {doc.metadata.get('source', 'Desconocida')}]\n{doc.page_content}"
        for doc in documents
    ])

def build_system_prompt(context_text: str) -> str:
    # AQUÍ ARREGLAMOS LAS NEGRITAS CON UNA REGLA ESTRICTA DE MARKDOWN
    return f"""Eres ContentSpark, un asistente Senior experto en creación de contenido.
    Tu objetivo es responder a las preguntas basándote ÚNICAMENTE en la siguiente información de la base de datos.

    REGLA CRÍTICA DE FORMATO: DEBES estructurar tu respuesta usando formato Markdown. Utiliza **negritas** (**) obligatoriamente para resaltar los conceptos clave, y mantén las listas numeradas o viñetas perfectamente formateadas.

    REGLA CRÍTICA DE PRECISIÓN: Si la premisa del usuario es incorrecta o difiere del contexto, corrígelo educadamente. Si la respuesta no está en el contexto, da un consejo general.

    CONTEXTO RECUPERADO:
    {context_text}
    """

def build_messages(question: str, documents: List[Document], history: list) -> List:
    context_text = build_context_text(documents)
    system_prompt = build_system_prompt(context_text)

    messages = [SystemMessage(content=system_prompt)]

    if history:
        for msg in history:
            # Soporte dual: si viene como dict o como objeto Pydantic
            role = getattr(msg, 'role', None) or (msg['role'] if isinstance(msg, dict) else None)
            content = getattr(msg, 'content', None) or (msg['content'] if isinstance(msg, dict) else None)
            
            if role == "user":
                messages.append(HumanMessage(content=content))
            elif role == "ai":
                messages.append(AIMessage(content=content))

    messages.append(HumanMessage(content=question))
    return messages

# ==========================================
# 2. NODOS DEL GRAFO (AGENTES DE BÚSQUEDA)
# ==========================================
def retrieve(state: GraphState):
    print(f"🔍 [GRAFO] Recuperando documentos de Qdrant...")
    question = state['question']
    documents = qdrant_search_service.search_similar(question, top_k=2)
    return {"documents": documents, "question": question}

def grade_documents(state: GraphState):
    print("🧠 [GRAFO] Evaluando relevancia de documentos...")
    question = state["question"]
    documents = state["documents"]
    
    print(f"   -> Qdrant recuperó {len(documents)} documentos para evaluar.")

    prompt = PromptTemplate(
        template="""Eres un evaluador estricto.
        Documento: {context}
        Pregunta: {question}
        ¿El documento contiene información útil para responder la pregunta? Responde ÚNICAMENTE con la palabra 'yes' o 'no'.""",
        input_variables=["context", "question"],
    )

    filtered_docs = []
    
    for d in documents:
        grade = "no"
        try:
            # Enviamos a evaluar
            response = llm_service.llm.invoke(
                prompt.format_prompt(question=question, context=d.page_content).to_messages()
            )
            raw_grade = (response.content or "").strip().lower()
            
            # IMPRIMIMOS LO QUE PIENSA EL LLM PARA DEBUGEAR
            print(f"   -> El LLM Evaluador respondió: '{raw_grade}'")
            
            # FIX: Soportamos tanto inglés como español (con y sin tilde)
            if "yes" in raw_grade or "si" in raw_grade or "sí" in raw_grade:
                grade = "yes"
                
        except Exception as e:
            # FIX: Si Groq falla, ahora lo veremos en la consola
            print(f"   ⚠️ ERROR LLAMANDO A GROQ (Evaluador): {e}")

        if grade == "yes":
            print("   ✅ Doc Relevante aceptado.")
            filtered_docs.append(d)
        else:
            print("   ❌ Doc descartado por irrelevante.")

    # Si no quedó ningún documento relevante, activamos la búsqueda web
    web_search = len(filtered_docs) == 0
    
    if web_search:
        print("   -> ⚠️ Ningún documento pasó el filtro. Activando Web Search.")
        
    return {"documents": filtered_docs, "question": question, "web_search": web_search}

def web_search(state: GraphState):
    print("🌐 [GRAFO] Realizando búsqueda en internet (DuckDuckGo)...")
    question = state["question"]
    documents = state["documents"]
    
    search = DuckDuckGoSearchResults()
    docs_string = search.invoke({"query": question})
    
    web_results = Document(
        page_content=docs_string, 
        metadata={"source": "Búsqueda Web en Vivo (DuckDuckGo)"}
    )
    documents.append(web_results)
    
    return {"documents": documents, "question": question}

def decide_to_generate(state: GraphState):
    """El Árbitro que decide si buscar en la web o terminar el grafo."""
    if state["web_search"]:
        print("⚖️ [DECISIÓN] Faltan datos. Derivando a Búsqueda Web.")
        return "web_search"
    else:
        print("⚖️ [DECISIÓN] Datos suficientes. Fin de la búsqueda.")
        return END

# ==========================================
# 3. COMPILACIÓN DEL GRAFO (SOLO RECUPERACIÓN)
# ==========================================
workflow = StateGraph(GraphState)

workflow.add_node("retrieve", retrieve)
workflow.add_node("grade_documents", grade_documents)
workflow.add_node("web_search", web_search)

workflow.set_entry_point("retrieve")
workflow.add_edge("retrieve", "grade_documents")

# Lógica condicional hacia la web o hacia el final del grafo
workflow.add_conditional_edges(
    "grade_documents",
    decide_to_generate,
    {
        "web_search": "web_search",
        END: END,
    }
)
workflow.add_edge("web_search", END)

crag_app = workflow.compile()

# ==========================================
# 4. SERVICIO API (STREAMING)
# ==========================================
class RAGService:
    async def generate_response_stream(self, user_message: str, history: list = None) -> AsyncGenerator[str, None]:
        """
        1. Usa el Grafo (CRAG) para buscar y evaluar la info.
        2. Usa Llama 3 (.astream) para generar y streamear la respuesta al Frontend.
        """
        print(f"\n--- NUEVA PETICIÓN ---")
        
        # 1. DEJAMOS QUE LANGGRAPH HAGA EL TRABAJO PESADO DE BUSCAR
        inputs = {
            "question": user_message,
            "documents": [],
            "web_search": False,
            "history": history or []
        }
        
        # Ejecutamos el grafo (esto no genera texto, solo recupera y evalúa los documentos)
        final_state = crag_app.invoke(inputs)
        
        # 2. CONSTRUIMOS EL PROMPT CON LOS DATOS PERFECTOS
        messages = build_messages(final_state["question"], final_state["documents"], final_state["history"])
        
        print("✍️ Generando respuesta final con Llama 3 (Streaming)...")
        
        # 3. STREAMING NATIVO DE LANGCHAIN PARA EL FRONTEND
        async for chunk in llm_service.llm.astream(messages):
            if hasattr(chunk, "content"):
                yield chunk.content
            elif isinstance(chunk, str):
                yield chunk

rag_service = RAGService()