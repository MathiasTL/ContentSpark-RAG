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


def _to_list_item(chat) -> ChatListItem:
    return ChatListItem(
        id=str(chat.id),
        title=chat.title,
        is_archived=chat.is_archived,
        created_at=chat.created_at,
        updated_at=chat.updated_at,
    )


@router.post(
    "",
    response_model=ChatListItem,
    status_code=status.HTTP_201_CREATED,
)
async def create_chat(
    payload: ChatCreateRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatListItem:
    chat = await chat_service.create_chat(db, user_id, title=payload.title)
    return _to_list_item(chat)
