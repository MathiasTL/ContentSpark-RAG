# Multichat Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exponer un CRUD completo de chats por usuario, persistir cada mensaje en PostgreSQL con su `chat_id`, y auto-generar el titulo del chat desde el primer mensaje del usuario — todo manteniendo el streaming RAG actual intacto.

**Architecture:** Capa de servicio (`chat_service`) encapsula todas las operaciones contra `chats`/`messages` y la generacion de titulo via LLM. Los routers quedan delgados: validan ownership (siempre filtrando por `user_id` derivado de `get_current_user`) y delegan al servicio. El endpoint `POST /api/chat` se modifica para requerir `chat_id`, cargar historial desde DB, persistir el mensaje del usuario antes del stream, y persistir el mensaje del AI al cierre del generator usando una sesion DB fresca (porque la sesion del request se cierra cuando se retorna el `StreamingResponse`).

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async, Pydantic v2, Supabase (auth), Groq Llama 3.1 (titulo), pytest + httpx TestClient.

**Spec de referencia:** `SPRINT_MVP_AUTH.md` — seccion "2) Multichat / Backend".

---

## File Structure

**Backend — crear:**
- `backend/app/services/chat_service.py` — CRUD chats + persistencia mensajes + generacion de titulo. Singleton `chat_service`.
- `backend/app/routers/chats.py` — router del CRUD: `POST/GET/PATCH/DELETE /api/chats` y `GET /api/chats/{id}`.
- `backend/tests/test_chats.py` — tests del CRUD (ownership, 404, validaciones, happy paths).
- `backend/tests/test_chat_service.py` — tests unitarios de `chat_service` (titulo, fallback).

**Backend — modificar:**
- `backend/app/schemas/chat.py` — schemas refinados (`ChatCreateRequest`, `ChatListItem`, `ChatDetail`, `MessageItem`, `ChatUpdateRequest`, `ChatStreamRequest`).
- `backend/app/routers/chat.py` — `POST /api/chat` requiere `chat_id`, persiste user+ai, dispara titulo si falta.
- `backend/main.py` — incluir `chats.router`.
- `backend/tests/conftest.py` — fixture `seed_chat` para tests que ya tienen un chat valido en DB.
- `backend/tests/test_chat.py` — sobrescribir el placeholder con tests del streaming + persistencia.

**Backend — NO tocar:**
- Modelos (`app/models/chat.py`) — ya tienen `Chat` + `Message` + relaciones + cascade.
- Migraciones — la inicial ya creo `chats`, `messages` y sus indices (`ix_chats_user_id`, `ix_messages_chat_id`).
- `rag_service.py` — su contrato (`generate_response_stream(message, history)`) no cambia. El router le pasa el historial cargado desde DB en el mismo formato `[{"role": "user"|"ai", "content": "..."}]` que ya consume.

**Frontend:** Fuera de scope — pertenece al plan "Multichat frontend".

---

## Convenciones

- Toda query a `chats` o `messages` filtra por `user_id` (a traves del join con `Chat.user_id`). Nunca se confia en `chat_id` solo.
- Errores: 404 cuando el chat no existe o no pertenece al usuario (NO 403 — no queremos filtrar existencia ajena). 400 para payloads invalidos.
- IDs externos: el cliente envia y recibe strings UUID. La conversion a `uuid.UUID` ocurre en el servicio.
- DB sessions: el router usa la sesion inyectada por `get_db`. El stream de `/api/chat` abre una sesion fresca con `AsyncSessionLocal()` dentro del generator para la persistencia final del mensaje AI.

---

## Task 1: Schemas Pydantic

**Files:**
- Modify: `backend/app/schemas/chat.py`

- [ ] **Step 1: Reemplazar el contenido del archivo**

Sobrescribir `backend/app/schemas/chat.py` completo con:

```python
"""Schemas Pydantic para chats y mensajes."""
from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class MessageItem(BaseModel):
    """Mensaje individual dentro de un chat."""
    id: str
    role: str  # "user" | "ai"
    content: str
    sources: Optional[List[dict[str, Any]]] = None
    created_at: datetime


class ChatListItem(BaseModel):
    """Item de la lista de chats (sin mensajes)."""
    id: str
    title: Optional[str] = None
    is_archived: bool
    created_at: datetime
    updated_at: datetime


class ChatDetail(ChatListItem):
    """Chat con sus mensajes ordenados por created_at asc."""
    messages: List[MessageItem] = []


class ChatCreateRequest(BaseModel):
    """Crear chat vacio. Title opcional; suele dejarse vacio y autogenerarse."""
    title: Optional[str] = Field(default=None, max_length=255)


class ChatUpdateRequest(BaseModel):
    """Actualiza titulo y/o estado de archivo. Al menos uno debe venir."""
    title: Optional[str] = Field(default=None, max_length=255)
    is_archived: Optional[bool] = None


class ChatStreamRequest(BaseModel):
    """Body del endpoint POST /api/chat. chat_id es obligatorio."""
    chat_id: str
    message: str = Field(min_length=1)
```

- [ ] **Step 2: Smoke import**

Run: `cd backend && python -c "from app.schemas.chat import ChatCreateRequest, ChatUpdateRequest, ChatStreamRequest, ChatDetail, ChatListItem, MessageItem; print('ok')"`
Expected: imprime `ok` sin errores.

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas/chat.py
git commit -m "feat(chat): refine pydantic schemas for chat crud and streaming"
```

---

## Task 2: Servicio chat_service (CRUD + helpers)

**Files:**
- Create: `backend/app/services/chat_service.py`

- [ ] **Step 1: Crear archivo `chat_service.py`**

```python
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
```

- [ ] **Step 2: Smoke import**

Run: `cd backend && python -c "from app.services.chat_service import chat_service; print('ok')"`
Expected: imprime `ok`.

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/chat_service.py
git commit -m "feat(chat): add chat_service with crud, message persistence and title generation"
```

---

## Task 3: Test fixtures de chat

**Files:**
- Modify: `backend/tests/conftest.py`

- [ ] **Step 1: Anadir fixture `seed_chat`**

Al final de `backend/tests/conftest.py`, anadir:

```python


@pytest.fixture
def seed_chat_id() -> str:
    return "22222222-2222-2222-2222-222222222222"


@pytest.fixture
def patch_chat_service(monkeypatch):
    """Reemplaza los metodos de chat_service por AsyncMocks para tests de router."""
    from app.services import chat_service as cs_module

    fakes = SimpleNamespace(
        create_chat=AsyncMock(),
        list_chats=AsyncMock(return_value=[]),
        get_chat=AsyncMock(),
        get_chat_with_messages=AsyncMock(),
        update_chat=AsyncMock(),
        delete_chat=AsyncMock(),
        add_message=AsyncMock(),
        load_history=AsyncMock(return_value=[]),
        generate_title=AsyncMock(return_value="Titulo generado"),
    )
    for name in fakes.__dict__:
        monkeypatch.setattr(cs_module.chat_service, name, getattr(fakes, name))
    return fakes
```

- [ ] **Step 2: Verificar que conftest sigue importando**

Run: `cd backend && python -c "import tests.conftest; print('ok')"`
Expected: imprime `ok`.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/conftest.py
git commit -m "test(chat): add seed_chat_id and patch_chat_service fixtures"
```

---

## Task 4: Router de chats — incluirlo en main.py

**Files:**
- Create: `backend/app/routers/chats.py` (esqueleto)
- Modify: `backend/main.py`

- [ ] **Step 1: Crear `chats.py` con el esqueleto del router**

```python
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
```

- [ ] **Step 2: Incluir el router en `main.py`**

En `backend/main.py`, modificar la linea de imports:

```python
from app.routers import auth, chat, chats, ingest
```

Y anadir despues de `app.include_router(chat.router)`:

```python
app.include_router(chats.router)
```

- [ ] **Step 3: Verificar que la app levanta**

Run: `cd backend && python -c "from main import app; routes = [r.path for r in app.routes]; print([r for r in routes if '/api/chats' in r or '/api/chat' in r])"`
Expected: lista que incluye `/api/chat` (existente). El prefijo `/api/chats` aparecera vacio aun (sin endpoints todavia) pero el import no debe fallar.

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/chats.py backend/main.py
git commit -m "feat(chat): scaffold chats router and wire into main app"
```

---

## Task 5: Endpoint POST /api/chats (crear chat)

**Files:**
- Modify: `backend/app/routers/chats.py`
- Test: `backend/tests/test_chats.py`

- [ ] **Step 1: Escribir el test fallando**

Crear `backend/tests/test_chats.py`:

```python
"""Tests del CRUD de chats."""
from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import UUID


def _fake_chat(
    chat_id: str = "22222222-2222-2222-2222-222222222222",
    user_id: str = "11111111-1111-1111-1111-111111111111",
    title: str | None = None,
    is_archived: bool = False,
):
    now = datetime(2026, 5, 16, 12, 0, tzinfo=timezone.utc)
    return SimpleNamespace(
        id=UUID(chat_id),
        user_id=UUID(user_id),
        title=title,
        is_archived=is_archived,
        created_at=now,
        updated_at=now,
        messages=[],
    )


def test_create_chat_returns_201_and_payload(client, patch_chat_service):
    patch_chat_service.create_chat.return_value = _fake_chat(title=None)

    response = client.post(
        "/api/chats",
        headers={"Authorization": "Bearer valid"},
        json={},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["id"] == "22222222-2222-2222-2222-222222222222"
    assert body["title"] is None
    assert body["is_archived"] is False
    patch_chat_service.create_chat.assert_awaited_once()


def test_create_chat_without_token_returns_401(client):
    response = client.post("/api/chats", json={})
    assert response.status_code == 401
```

- [ ] **Step 2: Correr tests y verificar que fallan**

Run: `cd backend && pytest tests/test_chats.py -v`
Expected: FAIL — `404 Not Found` porque el endpoint aun no existe.

- [ ] **Step 3: Implementar endpoint**

En `backend/app/routers/chats.py`, anadir despues del `router = APIRouter(...)`:

```python
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
```

- [ ] **Step 4: Correr tests y verificar que pasan**

Run: `cd backend && pytest tests/test_chats.py -v`
Expected: PASS — ambos tests verdes.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/chats.py backend/tests/test_chats.py
git commit -m "feat(chat): add POST /api/chats endpoint to create chats"
```

---

## Task 6: Endpoint GET /api/chats (listar)

**Files:**
- Modify: `backend/app/routers/chats.py`
- Modify: `backend/tests/test_chats.py`

- [ ] **Step 1: Anadir test fallando**

Al final de `backend/tests/test_chats.py`, anadir:

```python
def test_list_chats_returns_ordered_list(client, patch_chat_service):
    chat_a = _fake_chat(chat_id="22222222-2222-2222-2222-222222222222", title="A")
    chat_b = _fake_chat(chat_id="33333333-3333-3333-3333-333333333333", title="B")
    patch_chat_service.list_chats.return_value = [chat_a, chat_b]

    response = client.get(
        "/api/chats", headers={"Authorization": "Bearer valid"}
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2
    assert body[0]["title"] == "A"
    assert body[1]["title"] == "B"
    patch_chat_service.list_chats.assert_awaited_once()


def test_list_chats_without_token_returns_401(client):
    response = client.get("/api/chats")
    assert response.status_code == 401
```

- [ ] **Step 2: Correr y verificar FAIL**

Run: `cd backend && pytest tests/test_chats.py::test_list_chats_returns_ordered_list -v`
Expected: FAIL — 404.

- [ ] **Step 3: Implementar endpoint**

Anadir al final de `backend/app/routers/chats.py`:

```python
@router.get("", response_model=list[ChatListItem])
async def list_chats(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ChatListItem]:
    chats = await chat_service.list_chats(db, user_id)
    return [_to_list_item(c) for c in chats]
```

- [ ] **Step 4: Correr y verificar PASS**

Run: `cd backend && pytest tests/test_chats.py -v`
Expected: PASS — los 4 tests pasan.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/chats.py backend/tests/test_chats.py
git commit -m "feat(chat): add GET /api/chats endpoint to list user chats"
```

---

## Task 7: Endpoint GET /api/chats/{id} (detalle con mensajes)

**Files:**
- Modify: `backend/app/routers/chats.py`
- Modify: `backend/tests/test_chats.py`

- [ ] **Step 1: Anadir test fallando**

Al final de `backend/tests/test_chats.py`:

```python
def test_get_chat_returns_messages(client, patch_chat_service):
    msg = SimpleNamespace(
        id=UUID("44444444-4444-4444-4444-444444444444"),
        chat_id=UUID("22222222-2222-2222-2222-222222222222"),
        role="user",
        content="Hola",
        sources=None,
        created_at=datetime(2026, 5, 16, 12, 0, tzinfo=timezone.utc),
    )
    chat = _fake_chat(title="Hola")
    chat.messages = [msg]
    patch_chat_service.get_chat_with_messages.return_value = chat

    response = client.get(
        "/api/chats/22222222-2222-2222-2222-222222222222",
        headers={"Authorization": "Bearer valid"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == "22222222-2222-2222-2222-222222222222"
    assert len(body["messages"]) == 1
    assert body["messages"][0]["role"] == "user"
    assert body["messages"][0]["content"] == "Hola"


def test_get_chat_not_found_returns_404(client, patch_chat_service):
    from fastapi import HTTPException

    patch_chat_service.get_chat_with_messages.side_effect = HTTPException(
        status_code=404, detail="Chat no encontrado"
    )
    response = client.get(
        "/api/chats/22222222-2222-2222-2222-222222222222",
        headers={"Authorization": "Bearer valid"},
    )
    assert response.status_code == 404
```

- [ ] **Step 2: Correr y verificar FAIL**

Run: `cd backend && pytest tests/test_chats.py::test_get_chat_returns_messages -v`
Expected: FAIL — 404 (endpoint inexistente).

- [ ] **Step 3: Implementar endpoint**

Primero, extender el import de schemas al inicio de `backend/app/routers/chats.py` para incluir `MessageItem`:

```python
from app.schemas.chat import (
    ChatCreateRequest,
    ChatDetail,
    ChatListItem,
    ChatUpdateRequest,
    MessageItem,
)
```

Luego anadir al final de `backend/app/routers/chats.py`:

```python
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
```

- [ ] **Step 4: Correr y verificar PASS**

Run: `cd backend && pytest tests/test_chats.py -v`
Expected: PASS — los 6 tests verdes.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/chats.py backend/tests/test_chats.py
git commit -m "feat(chat): add GET /api/chats/{id} endpoint with messages"
```

---

## Task 8: Endpoint PATCH /api/chats/{id} (rename/archive)

**Files:**
- Modify: `backend/app/routers/chats.py`
- Modify: `backend/tests/test_chats.py`

- [ ] **Step 1: Anadir tests fallando**

Al final de `backend/tests/test_chats.py`:

```python
def test_patch_chat_updates_title(client, patch_chat_service):
    updated = _fake_chat(title="Nuevo titulo")
    patch_chat_service.update_chat.return_value = updated

    response = client.patch(
        "/api/chats/22222222-2222-2222-2222-222222222222",
        headers={"Authorization": "Bearer valid"},
        json={"title": "Nuevo titulo"},
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Nuevo titulo"
    patch_chat_service.update_chat.assert_awaited_once()


def test_patch_chat_archives(client, patch_chat_service):
    updated = _fake_chat(title="X", is_archived=True)
    patch_chat_service.update_chat.return_value = updated

    response = client.patch(
        "/api/chats/22222222-2222-2222-2222-222222222222",
        headers={"Authorization": "Bearer valid"},
        json={"is_archived": True},
    )

    assert response.status_code == 200
    assert response.json()["is_archived"] is True


def test_patch_chat_empty_body_returns_422_or_400(client, patch_chat_service):
    from fastapi import HTTPException

    patch_chat_service.update_chat.side_effect = HTTPException(
        status_code=400, detail="Debe enviar al menos un campo"
    )
    response = client.patch(
        "/api/chats/22222222-2222-2222-2222-222222222222",
        headers={"Authorization": "Bearer valid"},
        json={},
    )
    assert response.status_code == 400
```

- [ ] **Step 2: Correr y verificar FAIL**

Run: `cd backend && pytest tests/test_chats.py::test_patch_chat_updates_title -v`
Expected: FAIL — 405 Method Not Allowed.

- [ ] **Step 3: Implementar endpoint**

Anadir al final de `backend/app/routers/chats.py`:

```python
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
```

- [ ] **Step 4: Correr y verificar PASS**

Run: `cd backend && pytest tests/test_chats.py -v`
Expected: PASS — los 9 tests verdes.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/chats.py backend/tests/test_chats.py
git commit -m "feat(chat): add PATCH /api/chats/{id} to rename and archive"
```

---

## Task 9: Endpoint DELETE /api/chats/{id}

**Files:**
- Modify: `backend/app/routers/chats.py`
- Modify: `backend/tests/test_chats.py`

- [ ] **Step 1: Anadir tests fallando**

Al final de `backend/tests/test_chats.py`:

```python
def test_delete_chat_returns_204(client, patch_chat_service):
    response = client.delete(
        "/api/chats/22222222-2222-2222-2222-222222222222",
        headers={"Authorization": "Bearer valid"},
    )

    assert response.status_code == 204
    patch_chat_service.delete_chat.assert_awaited_once()


def test_delete_chat_not_found_returns_404(client, patch_chat_service):
    from fastapi import HTTPException

    patch_chat_service.delete_chat.side_effect = HTTPException(
        status_code=404, detail="Chat no encontrado"
    )
    response = client.delete(
        "/api/chats/22222222-2222-2222-2222-222222222222",
        headers={"Authorization": "Bearer valid"},
    )
    assert response.status_code == 404
```

- [ ] **Step 2: Correr y verificar FAIL**

Run: `cd backend && pytest tests/test_chats.py::test_delete_chat_returns_204 -v`
Expected: FAIL — 405 Method Not Allowed.

- [ ] **Step 3: Implementar endpoint**

Anadir al final de `backend/app/routers/chats.py`:

```python
@router.delete("/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat(
    chat_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await chat_service.delete_chat(db, user_id, chat_id)
```

- [ ] **Step 4: Correr y verificar PASS**

Run: `cd backend && pytest tests/test_chats.py -v`
Expected: PASS — los 11 tests verdes.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/chats.py backend/tests/test_chats.py
git commit -m "feat(chat): add DELETE /api/chats/{id} endpoint"
```

---

## Task 10: Test unitario de generacion de titulo

**Files:**
- Create: `backend/tests/test_chat_service.py`

- [ ] **Step 1: Escribir tests fallando**

```python
"""Tests unitarios para chat_service.generate_title."""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services.chat_service import chat_service


@pytest.mark.asyncio
async def test_generate_title_uses_llm_response(monkeypatch):
    fake_llm = SimpleNamespace(
        ainvoke=AsyncMock(return_value=SimpleNamespace(content="Hooks para Reels"))
    )
    from app.services import chat_service as cs_module

    monkeypatch.setattr(cs_module.llm_service, "llm", fake_llm)

    title = await chat_service.generate_title(
        "Como hago un buen hook en Instagram Reels?"
    )
    assert title == "Hooks para Reels"
    fake_llm.ainvoke.assert_awaited_once()


@pytest.mark.asyncio
async def test_generate_title_falls_back_on_llm_error(monkeypatch):
    fake_llm = SimpleNamespace(ainvoke=AsyncMock(side_effect=Exception("boom")))
    from app.services import chat_service as cs_module

    monkeypatch.setattr(cs_module.llm_service, "llm", fake_llm)

    title = await chat_service.generate_title("Pregunta sobre TikTok algoritmo")
    assert title.startswith("Pregunta sobre TikTok algoritmo"[:50].rstrip()[:10])


@pytest.mark.asyncio
async def test_generate_title_falls_back_when_llm_returns_too_long(monkeypatch):
    fake_llm = SimpleNamespace(
        ainvoke=AsyncMock(
            return_value=SimpleNamespace(content="x" * 200)
        )
    )
    from app.services import chat_service as cs_module

    monkeypatch.setattr(cs_module.llm_service, "llm", fake_llm)

    title = await chat_service.generate_title("Mi pregunta corta")
    assert title == "Mi pregunta corta"


@pytest.mark.asyncio
async def test_generate_title_empty_message_returns_default():
    title = await chat_service.generate_title("   ")
    assert title == "Nuevo chat"
```

- [ ] **Step 2: Correr y verificar PASS**

Run: `cd backend && pytest tests/test_chat_service.py -v`
Expected: PASS — 4 tests verdes.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_chat_service.py
git commit -m "test(chat): cover chat_service.generate_title llm and fallback paths"
```

---

## Task 11: Modificar POST /api/chat para persistir y autogenerar titulo

**Files:**
- Modify: `backend/app/routers/chat.py`
- Modify: `backend/tests/test_chat.py`

- [ ] **Step 1: Escribir tests fallando**

Sobrescribir `backend/tests/test_chat.py` con:

```python
"""Tests del endpoint POST /api/chat (streaming + persistencia)."""
from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID


def _fake_chat(title=None):
    now = datetime(2026, 5, 16, 12, 0, tzinfo=timezone.utc)
    return SimpleNamespace(
        id=UUID("22222222-2222-2222-2222-222222222222"),
        user_id=UUID("11111111-1111-1111-1111-111111111111"),
        title=title,
        is_archived=False,
        created_at=now,
        updated_at=now,
    )


async def _fake_stream(message, history):
    yield "Hola "
    yield "mundo"


def test_chat_requires_chat_id(client):
    response = client.post(
        "/api/chat",
        headers={"Authorization": "Bearer valid"},
        json={"message": "hi"},
    )
    assert response.status_code == 422


def test_chat_requires_message(client):
    response = client.post(
        "/api/chat",
        headers={"Authorization": "Bearer valid"},
        json={"chat_id": "22222222-2222-2222-2222-222222222222"},
    )
    assert response.status_code == 422


def test_chat_returns_404_when_chat_not_owned(client, patch_chat_service):
    from fastapi import HTTPException

    patch_chat_service.get_chat.side_effect = HTTPException(
        status_code=404, detail="Chat no encontrado"
    )
    response = client.post(
        "/api/chat",
        headers={"Authorization": "Bearer valid"},
        json={
            "chat_id": "22222222-2222-2222-2222-222222222222",
            "message": "hola",
        },
    )
    assert response.status_code == 404


def test_chat_persists_and_streams(client, patch_chat_service):
    patch_chat_service.get_chat.return_value = _fake_chat(title="ya tiene titulo")
    patch_chat_service.load_history.return_value = []

    with patch(
        "app.routers.chat.rag_service.generate_response_stream",
        side_effect=_fake_stream,
    ), patch(
        "app.routers.chat.AsyncSessionLocal"
    ) as session_factory:
        fake_session = AsyncMock()
        fake_session.__aenter__.return_value = fake_session
        fake_session.__aexit__.return_value = None
        session_factory.return_value = fake_session

        response = client.post(
            "/api/chat",
            headers={"Authorization": "Bearer valid"},
            json={
                "chat_id": "22222222-2222-2222-2222-222222222222",
                "message": "Hola",
            },
        )

    assert response.status_code == 200
    assert response.text == "Hola mundo"
    # user message persisted en la sesion del request
    assert patch_chat_service.add_message.await_count >= 1
    first_call = patch_chat_service.add_message.await_args_list[0]
    assert first_call.kwargs.get("role") == "user" or first_call.args[2] == "user"


def test_chat_generates_title_when_missing(client, patch_chat_service):
    patch_chat_service.get_chat.return_value = _fake_chat(title=None)
    patch_chat_service.load_history.return_value = []
    patch_chat_service.generate_title.return_value = "Titulo IA"

    with patch(
        "app.routers.chat.rag_service.generate_response_stream",
        side_effect=_fake_stream,
    ), patch(
        "app.routers.chat.AsyncSessionLocal"
    ) as session_factory:
        fake_session = AsyncMock()
        fake_session.__aenter__.return_value = fake_session
        fake_session.__aexit__.return_value = None
        session_factory.return_value = fake_session

        response = client.post(
            "/api/chat",
            headers={"Authorization": "Bearer valid"},
            json={
                "chat_id": "22222222-2222-2222-2222-222222222222",
                "message": "Como hago un hook?",
            },
        )

    assert response.status_code == 200
    patch_chat_service.generate_title.assert_awaited_once_with(
        "Como hago un hook?"
    )
    patch_chat_service.update_chat.assert_awaited()
```

- [ ] **Step 2: Correr y verificar FAIL**

Run: `cd backend && pytest tests/test_chat.py -v`
Expected: FAIL — el endpoint actual no valida `chat_id`, no usa `chat_service`, no persiste.

- [ ] **Step 3: Reescribir `backend/app/routers/chat.py`**

```python
"""Router del chat RAG con streaming y persistencia."""
from __future__ import annotations

from typing import AsyncGenerator

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
```

- [ ] **Step 4: Correr y verificar PASS**

Run: `cd backend && pytest tests/test_chat.py -v`
Expected: PASS — los 5 tests verdes.

- [ ] **Step 5: Verificar regresion en el resto de la suite**

Run: `cd backend && pytest -v`
Expected: PASS — toda la suite (auth + chats + chat + chat_service) en verde.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/chat.py backend/tests/test_chat.py
git commit -m "feat(chat): persist user and ai messages and auto-generate title on first message"
```

---

## Task 12: Smoke test manual end-to-end

**Files:** (sin cambios de codigo)

- [ ] **Step 1: Levantar backend**

Run: `cd backend && uvicorn main:app --reload`
Expected: log `Uvicorn running on http://127.0.0.1:8000`.

- [ ] **Step 2: Obtener un access_token valido**

Desde el frontend (con auth ya funcionando), capturar el `access_token` de Supabase (DevTools → Network → headers `Authorization: Bearer ...`). Guardarlo en una variable local:

```bash
export TOKEN="<access_token>"
```

- [ ] **Step 3: Crear un chat**

Run:
```bash
curl -s -X POST http://localhost:8000/api/chats \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```
Expected: JSON con `id`, `title: null`, `is_archived: false`. Guardar `id`:
```bash
export CHAT_ID="<id devuelto>"
```

- [ ] **Step 4: Enviar primer mensaje (streaming)**

Run:
```bash
curl -N -X POST http://localhost:8000/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"chat_id\":\"$CHAT_ID\",\"message\":\"Dame un hook viral sobre productividad\"}"
```
Expected: chunks de texto streameados.

- [ ] **Step 5: Verificar que el titulo se autogenero y los mensajes se persistieron**

Run:
```bash
curl -s http://localhost:8000/api/chats/$CHAT_ID \
  -H "Authorization: Bearer $TOKEN" | jq .
```
Expected: `title` no nulo, `messages` con 2 entradas (`role: user` y `role: ai`).

- [ ] **Step 6: Renombrar**

Run:
```bash
curl -s -X PATCH http://localhost:8000/api/chats/$CHAT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Mi titulo personalizado"}' | jq .
```
Expected: `title: "Mi titulo personalizado"`.

- [ ] **Step 7: Listar**

Run:
```bash
curl -s http://localhost:8000/api/chats -H "Authorization: Bearer $TOKEN" | jq .
```
Expected: array con al menos el chat creado, titulo actualizado.

- [ ] **Step 8: Borrar**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE \
  http://localhost:8000/api/chats/$CHAT_ID \
  -H "Authorization: Bearer $TOKEN"
```
Expected: `204`.

- [ ] **Step 9: Confirmar borrado**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  http://localhost:8000/api/chats/$CHAT_ID \
  -H "Authorization: Bearer $TOKEN"
```
Expected: `404`.

- [ ] **Step 10: Actualizar el sprint checklist**

Editar `SPRINT_MVP_AUTH.md` y marcar como completados:

```markdown
#### Backend
- [x] CRUD de chats: crear, listar, obtener con mensajes, renombrar, borrar.
- [x] Persistir mensajes con `chat_id` en DB.
- [x] Generar titulo automatico del chat desde el primer mensaje.
```

- [ ] **Step 11: Commit**

```bash
git add SPRINT_MVP_AUTH.md
git commit -m "docs(sprint): mark multichat backend tasks as done"
```

---

## Criterios de aceptacion

- Tests automatizados:
  - `pytest backend/tests/` pasa en verde (auth + chats + chat + chat_service).
  - Cobertura nueva: `test_chats.py` (11 tests), `test_chat_service.py` (4 tests), `test_chat.py` (5 tests).
- API:
  - `POST /api/chats` crea chat con `title: null`.
  - `GET /api/chats` lista los chats del usuario ordenados por `updated_at desc`.
  - `GET /api/chats/{id}` devuelve chat + mensajes ordenados por `created_at asc`.
  - `PATCH /api/chats/{id}` permite renombrar y archivar.
  - `DELETE /api/chats/{id}` borra el chat (cascade elimina mensajes).
  - `POST /api/chat` requiere `chat_id`, persiste user message antes del stream y AI message al cerrar el stream.
  - Si el chat no tiene titulo al recibir el primer mensaje, se autogenera via LLM (fallback: primeros 50 chars).
- Seguridad:
  - Todo endpoint exige `Authorization: Bearer ...`.
  - `chat_id` ajeno al usuario → 404 (no 403).

## Fuera de scope

- Paginacion de chats / mensajes (yagni para MVP).
- Endpoint de busqueda de mensajes.
- Cambios en `rag_service` (su firma queda igual).
- Cualquier cambio del frontend (proximo plan: "Multichat frontend").
