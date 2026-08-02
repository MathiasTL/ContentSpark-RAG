"""Router del chat RAG con streaming y persistencia."""
from __future__ import annotations

from collections.abc import AsyncGenerator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.dependencies import get_current_user, get_db
from app.schemas.chat import ChatStreamRequest
from app.services.chat_service import chat_service
from app.services.rag_service import rag_service

router = APIRouter(prefix="/api", tags=["chat"])


async def _stream_and_persist(
    chat_id: str, user_message: str, history: list[dict[str, str]]
) -> AsyncGenerator[str, None]:
    """Wrapper del stream RAG que acumula y persiste la respuesta AI al final.

    Usa una sesion DB fresca porque la sesion del request ya fue cerrada
    cuando FastAPI retorna el StreamingResponse.
    """
    buffer: list[str] = []
    try:
        async for chunk in rag_service.generate_response_stream(user_message, history):
            buffer.append(chunk)
            yield chunk
    finally:
        full = "".join(buffer).strip()
        if full:
            async with AsyncSessionLocal() as session:
                try:
                    await chat_service.add_message(
                        session, chat_id=chat_id, role="ai", content=full
                    )
                    await session.commit()
                except Exception as exc:
                    await session.rollback()
                    print(f"   [chat] Error persistiendo mensaje AI: {exc}")


@router.post("/chat")
async def chat_with_bot(
    request: ChatStreamRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Endpoint de chat RAG con streaming.

    1. Valida ownership del chat.
    2. Carga historial desde DB.
    3. Persiste el mensaje del usuario.
    4. Si el chat no tiene titulo, lo genera y lo guarda.
    5. Streamea la respuesta del LLM, persistiendo el resultado al cierre.
    """
    chat = await chat_service.get_chat(db, user_id, request.chat_id)
    history = await chat_service.load_history(db, request.chat_id)

    await chat_service.add_message(
        db, chat_id=request.chat_id, role="user", content=request.message
    )

    if not chat.title:
        title = await chat_service.generate_title(request.message)
        await chat_service.update_chat(db, user_id, request.chat_id, title=title)

    return StreamingResponse(
        _stream_and_persist(request.chat_id, request.message, history),
        media_type="text/event-stream",
    )
