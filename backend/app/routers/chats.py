"""Router del CRUD de chats."""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.schemas.chat import (
    ChatCreateRequest,
    ChatDetail,
    ChatListItem,
    ChatUpdateRequest,
)
from app.services.chat_service import chat_service

router = APIRouter(prefix="/api/chats", tags=["chats"])
