# Router de ingesta de documentos y búsqueda semántica
from fastapi import APIRouter, HTTPException
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional

from app.services.embeddings_service import embeddings_service
from app.services.qdrant_services import qdrant_search_service
from app.services.llm_services import llm_service

router = APIRouter(prefix="/api", tags=["ingesta"])


class HookRequest(BaseModel):
    topic: str


class EmbeddingRequest(BaseModel):
    text: str


class IngestTextRequest(BaseModel):
    text: str
    source: str
    category: Optional[str] = None
    language: Optional[str] = None


class IngestURLRequest(BaseModel):
    url: str
    category: Optional[str] = None
    title: Optional[str] = None


class IngestURLsRequest(BaseModel):
    urls: List[IngestURLRequest]


class SearchRequest(BaseModel):
    query: str


@router.post("/test-llm")
async def test_llm(request: HookRequest):
    """Prueba el servicio LLM generando un hook viral."""
    try:
        hook = await llm_service.generate_text_hook(request.topic)
        return {"success": True, "topic": request.topic, "hook": hook}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test-embedding")
async def test_embedding(request: EmbeddingRequest):
    """Prueba el servicio de embeddings."""
    try:
        vector = await embeddings_service.generate_test_embedding(request.text)
        return {
            "success": True,
            "text": request.text,
            "vector_dimensions": len(vector),
            "sample_vector": vector[:5],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ingest")
async def ingest_text(request: IngestTextRequest):
    """Ingesta texto directamente con metadata enriquecida."""
    try:
        from ingest_data import ingest_text as do_ingest_text
        result = do_ingest_text(
            text=request.text,
            source=request.source,
            category=request.category,
            language=request.language,
        )
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ingest-url")
async def ingest_url(request: IngestURLRequest):
    """Ingesta una URL web: descarga, extrae texto y vectoriza."""
    try:
        from ingest_data import ingest_url as do_ingest_url
        result = do_ingest_url(
            url=request.url,
            category=request.category,
            custom_title=request.title,
        )
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ingest-urls")
async def ingest_urls_batch(request: IngestURLsRequest):
    """Ingesta múltiples URLs en batch."""
    try:
        from ingest_data import ingest_url as do_ingest_url
        results = []
        for entry in request.urls:
            try:
                result = do_ingest_url(
                    url=entry.url,
                    category=entry.category,
                    custom_title=entry.title,
                )
                results.append(result)
            except Exception as e:
                results.append({
                    "success": False,
                    "url": entry.url,
                    "error": str(e),
                })

        successful = sum(1 for r in results if r.get("success"))
        return {
            "success": True,
            "total": len(request.urls),
            "successful": successful,
            "failed": len(request.urls) - successful,
            "results": results,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search")
async def search_similar(request: SearchRequest):
    """Busca documentos similares en Qdrant."""
    try:
        results = qdrant_search_service.search_similar(request.query)
        formatted_results = [
            {"content": res.page_content, "metadata": res.metadata}
            for res in results
        ]
        return {
            "success": True,
            "query": request.query,
            "results": formatted_results,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sources")
async def get_sources():
    """Lista los PDFs disponibles en data/ y las fuentes ya ingestadas."""
    try:
        data_folder = Path("data")
        sources = []

        # PDFs en la carpeta data
        if data_folder.exists() and data_folder.is_dir():
            for file in data_folder.glob("*.pdf"):
                clean_title = file.stem.replace("_", " ").replace("-", " ").title()
                sources.append({
                    "id": file.name,
                    "title": clean_title,
                    "type": "PDF",
                    "status": "Disponible",
                })

        # Fuentes ya ingestadas (del tracking)
        try:
            from ingest_data import load_tracking
            tracking = load_tracking()
            ingested_keys = set(tracking.get("ingested", {}).keys())

            for source in sources:
                if source["id"] in ingested_keys:
                    info = tracking["ingested"][source["id"]]
                    source["status"] = "Vectorizado"
                    source["category"] = info.get("category", "general")
                    source["language"] = info.get("language", "unknown")
                    source["chunks"] = info.get("chunks", 0)

            # Agregar fuentes web
            for key, info in tracking["ingested"].items():
                if info.get("type") == "web":
                    sources.append({
                        "id": key,
                        "title": info.get("source", key[:50]),
                        "type": "Web",
                        "status": "Vectorizado",
                        "category": info.get("category", "general"),
                        "language": info.get("language", "unknown"),
                        "chunks": info.get("chunks", 0),
                    })
        except Exception:
            pass

        return {"success": True, "sources": sources}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_stats():
    """Devuelve estadísticas de la base de conocimiento."""
    try:
        from ingest_data import load_tracking
        tracking = load_tracking()
        ingested = tracking.get("ingested", {})

        total = len(ingested)
        total_chunks = sum(info.get("chunks", 0) for info in ingested.values())

        by_type = {}
        by_category = {}
        by_language = {}

        for info in ingested.values():
            t = info.get("type", "unknown")
            c = info.get("category", "unknown")
            l = info.get("language", "unknown")
            by_type[t] = by_type.get(t, 0) + 1
            by_category[c] = by_category.get(c, 0) + 1
            by_language[l] = by_language.get(l, 0) + 1

        return {
            "success": True,
            "total_sources": total,
            "total_chunks": total_chunks,
            "by_type": by_type,
            "by_category": by_category,
            "by_language": by_language,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
