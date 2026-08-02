"""Schemas Pydantic para chats y mensajes."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class MessageItem(BaseModel):
    """Mensaje individual dentro de un chat."""
    id: str
    role: str  # "user" | "ai"
    content: str
    sources: list[dict[str, Any]] | None = None
    created_at: datetime


class ChatListItem(BaseModel):
    """Item de la lista de chats (sin mensajes)."""
    id: str
    title: str | None = None
    is_archived: bool
    created_at: datetime
    updated_at: datetime


class ChatDetail(ChatListItem):
    """Chat con sus mensajes ordenados por created_at asc."""
    messages: list[MessageItem] = []


class ChatCreateRequest(BaseModel):
    """Crear chat vacio. Title opcional; suele dejarse vacio y autogenerarse."""
    title: str | None = Field(default=None, max_length=255)


class ChatUpdateRequest(BaseModel):
    """Actualiza titulo y/o estado de archivo. Al menos uno debe venir."""
    title: str | None = Field(default=None, max_length=255)
    is_archived: bool | None = None


class ChatStreamRequest(BaseModel):
    """Body del endpoint POST /api/chat. chat_id es obligatorio."""
    chat_id: str
    message: str = Field(min_length=1)
