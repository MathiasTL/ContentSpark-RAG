"""Fixtures compartidos para tests del backend."""
from __future__ import annotations

import os
import sys
from types import ModuleType, SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

# Establecer variables de entorno dummy ANTES de importar los modulos de la app.
# Los servicios (LLM, Qdrant, Embeddings) validan al instanciarse;
# los tests mockean esas dependencias, por lo que las keys no se usan realmente.
os.environ.setdefault("DATABASE_URL", "postgresql://dummy:dummy@localhost/dummy")
os.environ.setdefault("GROQ_API_KEY", "dummy-groq-key")
os.environ.setdefault("GOOGLE_API_KEY", "dummy-google-key")
os.environ.setdefault("QDRANT_URL", "http://localhost:6333")
os.environ.setdefault("QDRANT_API_KEY", "dummy-qdrant-key")
os.environ.setdefault("SUPABASE_URL", "https://dummy.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "dummy-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "dummy-service-role-key")


def _stub_module(name: str, **attrs) -> ModuleType:
    """Crea un modulo stub con atributos mockeados."""
    mod = ModuleType(name)
    for attr, val in attrs.items():
        setattr(mod, attr, val)
    return mod


# Inyectar stubs en sys.modules para evitar que los servicios externos
# hagan conexiones reales al importarse (LLM, Embeddings, Qdrant).
if "app.services.llm_services" not in sys.modules:
    sys.modules["app.services.llm_services"] = _stub_module(
        "app.services.llm_services",
        LLMService=MagicMock,
        llm_service=MagicMock(),
    )
if "app.services.embeddings_service" not in sys.modules:
    sys.modules["app.services.embeddings_service"] = _stub_module(
        "app.services.embeddings_service",
        EmbeddingsService=MagicMock,
        embeddings_service=MagicMock(),
    )
if "app.services.qdrant_services" not in sys.modules:
    sys.modules["app.services.qdrant_services"] = _stub_module(
        "app.services.qdrant_services",
        QdrantSearchService=MagicMock,
        qdrant_search_service=MagicMock(),
    )

import pytest
from fastapi.testclient import TestClient

from app.dependencies import get_db
from main import app


@pytest.fixture
def mock_user_id() -> str:
    return "11111111-1111-1111-1111-111111111111"


@pytest.fixture
def mock_supabase_user(mock_user_id: str) -> SimpleNamespace:
    """Fake Supabase user object con la forma minima que usamos."""
    return SimpleNamespace(
        id=mock_user_id,
        email="creator@example.com",
        user_metadata={"name": "Maria", "avatar_url": "https://avatars/m.png"},
    )


@pytest.fixture
def mock_supabase_admin(mock_supabase_user: SimpleNamespace):
    """Cliente Supabase admin mockeado. Retorna mock_supabase_user en get_user."""
    admin = MagicMock()
    admin.auth.get_user.return_value = SimpleNamespace(user=mock_supabase_user)
    return admin


@pytest.fixture
def mock_db_session():
    """AsyncSession mockeada — execute() es AsyncMock."""
    session = AsyncMock()
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    return session


@pytest.fixture
def client(mock_supabase_admin, mock_db_session):
    """TestClient con dependencias de Supabase y DB sobreescritas."""
    app.dependency_overrides[get_db] = lambda: mock_db_session
    # get_supabase_admin esta cacheado con lru_cache; lo reemplazamos via override
    # de FastAPI para los tests que pasen por la dep, y monkeypatchamos el import
    # directo para el middleware:
    import app.middleware.auth as auth_module

    original = auth_module.get_supabase_admin
    auth_module.get_supabase_admin = lambda: mock_supabase_admin

    with TestClient(app) as test_client:
        yield test_client

    auth_module.get_supabase_admin = original
    app.dependency_overrides.clear()


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
