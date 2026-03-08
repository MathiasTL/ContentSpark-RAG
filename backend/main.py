from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

# Import the services for LLM and embeddings
from app.services.llm_services import llm_service
from app.services.embeddings_service import embeddings_service
from app.services.qdrant_services import qdrant_search_service
from app.services.rag_service import rag_service

#Initialize the FastAPI app
app = FastAPI(
    title="ContentSpark API",
    description="Backend API for ContentSpark, a content generation and management platform.",
    version="1.0.0",
)

#Configuration for CORS to allow requests from the frontend application
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://contentspark.com", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#----DATA MODELS (PYDANTIC)
# Pydantic model for the request body when generating hooks
class HookRequest(BaseModel):
    topic: str
    
class EmbeddingRequest(BaseModel):
    text: str
    
class IngestRequest(BaseModel):
    text: str
    source: str
    
class SearchRequest(BaseModel):
    query: str
    
class ChatRequest(BaseModel):
    message: str
    
class MessageDict(BaseModel):
    role: str
    content: str
    
class ChatRequest(BaseModel):
    message: str
    # history es una lista opcional de mensajes anteriores. Si es el primer mensaje, vendrá vacía.
    history: Optional[List[MessageDict]] = []

@app.get("/")
async def root():
    return {
        "status": "online",
        "message": "Welcome to the ContentSpark RAG API!"
        }
    
@app.post("/api/test-llm")
async def test_llm(request: HookRequest):
    """
    Recibe un tema y devuelve un hook generado por Llama 3 (vía Groq).
    """
    try:
        print(f"🔍 Generando hook para el tema: {request.topic}")
        hook = await llm_service.generate_text_hook(request.topic)
        return {
            "success": True,
            "topic": request.topic,
            "hook": hook
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/test-embedding")
async def test_embedding(request: EmbeddingRequest):
    """
    Recibe un texto y devuelve el vector de embedding generado por Google Gemini.
    """
    try:
        print(f"🔍 Generando embedding para el texto: {request.text}")
        vector = await embeddings_service.generate_test_embedding(request.text)
        return {
            "success": True,
            "text": request.text,
            "vector_dimensions": len(vector), #Deberia ser 768 para text-embedding-004
            "sample_vector": vector[:5]  # Devuelve solo los primeros 5 valores del vector para evitar respuestas demasiado largas
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/api/ingest")
async def ingest_document(request: IngestRequest):
    """
    Recibe un texto, lo convierte en un vector de embedding y lo guarda en Qdrant.
    """
    try:
        metadata = {"source": request.source}
        qdrant_search_service.add_document(request.text, metadata)
        return {
            "success": True,
            "message": "Documento ingestado correctamente en Qdrant."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/api/search")
async def search_similar(request: SearchRequest):
    """
    Recibe una consulta, genera su vector de embedding y busca documentos similares en Qdrant.
    Devuelve los documentos más similares encontrados.
    """
    try:
        print(f"🔍 Buscando documentos similares para la consulta: {request.query}")
        results = qdrant_search_service.search_similar(request.query)
        formatted_results = [
            {
                "doc_id": res.id,
                "content": res.page_content,
                "metadata": res.metadata
            } for res in results
        ]
        return {
            "success": True,
            "query": request.query,
            "results": formatted_results  # Aquí puedes formatear los resultados como prefieras antes de devolverlos
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/api/chat")
async def chat_with_bot(request: ChatRequest):
    """Recibe un mensaje del usuario, busca información relevante en Qdrant y genera una respuesta usando el LLM.
    Este endpoint es la implementación completa del flujo RAG, donde el LLM actúa como el cerebro que procesa la información recuperada de la base de datos de conocimientos (Qdrant) para generar una respuesta informada y relevante.
    """
    try:
        response = await rag_service.generate_response(request.message, request.history)
        return {
            "success": True,
            "response": response
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))