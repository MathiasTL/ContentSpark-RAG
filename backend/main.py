from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine
from app.routers import auth, chat, chats, ingest

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Cierra el engine al apagar. Las migraciones se manejan con Alembic."""
    yield
    await engine.dispose()
    print("Conexion a PostgreSQL cerrada")


app = FastAPI(
    title="ContentSpark API",
    description="API para la plataforma SaaS ContentSpark — RAG + agentes para creadores de contenido",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://contentspark.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(chats.router)
app.include_router(ingest.router)


@app.get("/")
async def root():
    """Health check."""
    return {"status": "ok", "service": "ContentSpark API", "version": "0.2.0"}
