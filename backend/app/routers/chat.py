# Fase 1: Router de chat RAG con streaming
# Migra el endpoint POST /api/chat de main.py
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional

from app.services.rag_service import rag_service

router = APIRouter(prefix="/api", tags=["chat"])


class MessageDict(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[MessageDict]] = []
    chat_id: Optional[str] = None  # Fase 1: para persistencia en DB


@router.post("/chat")
async def chat_with_bot(request: ChatRequest):
    """Endpoint de chat RAG con streaming."""
    try:
        return StreamingResponse(
            rag_service.generate_response_stream(request.message, request.history),
            media_type="text/event-stream",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
