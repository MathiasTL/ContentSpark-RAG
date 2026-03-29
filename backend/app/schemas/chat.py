# Fase 1: Esquemas Pydantic para chats y mensajes
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ChatCreate(BaseModel):
    title: Optional[str] = None


class ChatResponse(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime


class MessageCreate(BaseModel):
    chat_id: str
    content: str
    history: Optional[List[dict]] = []


class MessageResponse(BaseModel):
    id: str
    chat_id: str
    role: str  # "user" | "ai"
    content: str
    sources: Optional[List[dict]] = None
    created_at: datetime
