from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.routers import chat, ingest

load_dotenv()

app = FastAPI(
    title="ContentSpark API",
    description="API para la plataforma SaaS ContentSpark — RAG + agentes para creadores de contenido",
    version="0.2.0",
)

# Configuración CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://contentspark.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers activos
app.include_router(chat.router)
app.include_router(ingest.router)

# Routers futuros (se activarán por fase)
# from app.routers import auth, profile, calendar, webhooks
# app.include_router(auth.router)
# app.include_router(profile.router)
# app.include_router(calendar.router)
# app.include_router(webhooks.router)


@app.get("/")
async def root():
    """Health check."""
    return {"status": "ok", "service": "ContentSpark API", "version": "0.2.0"}
