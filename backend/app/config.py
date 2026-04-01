# Configuración centralizada con Pydantic BaseSettings
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # LLM y Embeddings
    groq_api_key: str = ""
    google_api_key: str = ""

    # Vector DB
    qdrant_url: str = ""
    qdrant_api_key: str = ""

    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    # Base de datos
    database_url: str = ""

    # Integraciones
    n8n_webhook_url: str = ""

    @property
    def async_database_url(self) -> str:
        """Convierte la URL de PostgreSQL a formato asyncpg."""
        url = self.database_url
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
