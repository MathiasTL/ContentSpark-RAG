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
    MessageItem,
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


@router.get("", response_model=list[ChatListItem])
async def list_chats(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ChatListItem]:
    chats = await chat_service.list_chats(db, user_id)
    return [_to_list_item(c) for c in chats]


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


def _to_message_item(message) -> MessageItem:
    return MessageItem(
        id=str(message.id),
        role=message.role,
        content=message.content,
        sources=message.sources,
        created_at=message.created_at,
    )


@router.get("/{chat_id}", response_model=ChatDetail)
async def get_chat(
    chat_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatDetail:
    chat = await chat_service.get_chat_with_messages(db, user_id, chat_id)
    return ChatDetail(
        id=str(chat.id),
        title=chat.title,
        is_archived=chat.is_archived,
        created_at=chat.created_at,
        updated_at=chat.updated_at,
        messages=[_to_message_item(m) for m in chat.messages],
    )


@router.patch("/{chat_id}", response_model=ChatListItem)
async def patch_chat(
    chat_id: str,
    payload: ChatUpdateRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatListItem:
    chat = await chat_service.update_chat(
        db,
        user_id,
        chat_id,
        title=payload.title,
        is_archived=payload.is_archived,
    )
    return _to_list_item(chat)


@router.delete("/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat(
    chat_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await chat_service.delete_chat(db, user_id, chat_id)
