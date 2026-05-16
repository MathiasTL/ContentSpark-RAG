"""Servicio de chats: CRUD + persistencia de mensajes + generacion de titulo."""
from __future__ import annotations

import uuid
from typing import Any, Optional

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.chat import Chat, Message
from app.services.llm_services import llm_service


MAX_TITLE_CHARS = 60
TITLE_FALLBACK_CHARS = 50


def _to_uuid(value: str, label: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status_code=400, detail=f"{label} no es un UUID valido")


class ChatService:
    async def create_chat(
        self, db: AsyncSession, user_id: str, title: Optional[str] = None
    ) -> Chat:
        chat = Chat(user_id=_to_uuid(user_id, "user_id"), title=title)
        db.add(chat)
        await db.flush()
        await db.refresh(chat)
        return chat

    async def list_chats(self, db: AsyncSession, user_id: str) -> list[Chat]:
        stmt = (
            select(Chat)
            .where(Chat.user_id == _to_uuid(user_id, "user_id"))
            .order_by(Chat.updated_at.desc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_chat(
        self, db: AsyncSession, user_id: str, chat_id: str
    ) -> Chat:
        stmt = select(Chat).where(
            Chat.id == _to_uuid(chat_id, "chat_id"),
            Chat.user_id == _to_uuid(user_id, "user_id"),
        )
        result = await db.execute(stmt)
        chat = result.scalar_one_or_none()
        if chat is None:
            raise HTTPException(status_code=404, detail="Chat no encontrado")
        return chat

    async def get_chat_with_messages(
        self, db: AsyncSession, user_id: str, chat_id: str
    ) -> Chat:
        stmt = (
            select(Chat)
            .where(
                Chat.id == _to_uuid(chat_id, "chat_id"),
                Chat.user_id == _to_uuid(user_id, "user_id"),
            )
            .options(selectinload(Chat.messages))
        )
        result = await db.execute(stmt)
        chat = result.scalar_one_or_none()
        if chat is None:
            raise HTTPException(status_code=404, detail="Chat no encontrado")
        return chat

    async def update_chat(
        self,
        db: AsyncSession,
        user_id: str,
        chat_id: str,
        title: Optional[str] = None,
        is_archived: Optional[bool] = None,
    ) -> Chat:
        if title is None and is_archived is None:
            raise HTTPException(
                status_code=400,
                detail="Debe enviar al menos un campo: title o is_archived",
            )
        chat = await self.get_chat(db, user_id, chat_id)
        if title is not None:
            chat.title = title
        if is_archived is not None:
            chat.is_archived = is_archived
        await db.flush()
        await db.refresh(chat)
        return chat

    async def delete_chat(
        self, db: AsyncSession, user_id: str, chat_id: str
    ) -> None:
        chat = await self.get_chat(db, user_id, chat_id)
        await db.delete(chat)
        await db.flush()

    async def add_message(
        self,
        db: AsyncSession,
        chat_id: str,
        role: str,
        content: str,
        sources: Optional[list[dict[str, Any]]] = None,
    ) -> Message:
        if role not in {"user", "ai"}:
            raise HTTPException(status_code=400, detail="role debe ser 'user' o 'ai'")
        message = Message(
            chat_id=_to_uuid(chat_id, "chat_id"),
            role=role,
            content=content,
            sources=sources,
        )
        db.add(message)
        await db.flush()
        await db.refresh(message)
        return message

    async def load_history(
        self, db: AsyncSession, chat_id: str
    ) -> list[dict[str, str]]:
        """Devuelve mensajes en formato consumible por rag_service."""
        stmt = (
            select(Message)
            .where(Message.chat_id == _to_uuid(chat_id, "chat_id"))
            .order_by(Message.created_at.asc())
        )
        result = await db.execute(stmt)
        return [
            {"role": m.role, "content": m.content}
            for m in result.scalars().all()
        ]

    async def generate_title(self, first_message: str) -> str:
        """Genera un titulo corto (3-6 palabras) desde el primer mensaje."""
        cleaned = first_message.strip()
        if not cleaned:
            return "Nuevo chat"
        prompt = (
            "Genera un titulo corto en espanol (maximo 6 palabras, sin comillas, "
            "sin punto final) que resuma esta pregunta de un usuario para usar como "
            "titulo de un chat. Responde SOLO con el titulo.\n\n"
            f"Pregunta: {cleaned}"
        )
        try:
            from langchain_core.messages import HumanMessage

            response = await llm_service.llm.ainvoke([HumanMessage(content=prompt)])
            title = (response.content or "").strip().strip('"').strip("'")
            if title and len(title) <= MAX_TITLE_CHARS:
                return title
        except Exception as exc:
            print(f"   [chat_service] Error generando titulo: {exc}")
        # Fallback: primeros N caracteres del mensaje
        return cleaned[:TITLE_FALLBACK_CHARS].rstrip()


chat_service = ChatService()
