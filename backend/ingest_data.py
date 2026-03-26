import os
import json
import time
import re
import hashlib
from pathlib import Path
from datetime import datetime
from typing import Optional
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.services.qdrant_services import qdrant_search_service

# ==========================================
# CONFIGURACIÓN
# ==========================================
TRACKING_FILE = "ingest_tracking.json"
DATA_FOLDER = Path("data")

# Chunking optimizado para contenido de creadores:
# - 500 chars ≈ 100-120 palabras (un concepto completo)
# - Overlap de 80 chars mantiene continuidad entre chunks
CHUNK_SIZE = 500
CHUNK_OVERLAP = 80

# Separadores semánticos: priorizamos cortes naturales del contenido
SEPARATORS = [
    "\n## ",       # Headers Markdown H2
    "\n### ",      # Headers Markdown H3
    "\n#### ",     # Headers Markdown H4
    "\n\n\n",      # Triple salto (separación fuerte)
    "\n\n",        # Doble salto (párrafos)
    "\n",          # Salto de línea
    ". ",          # Fin de oración
    " ",           # Palabras
    ""             # Caracteres (último recurso)
]

# ==========================================
# UTILIDADES
# ==========================================
def load_tracking() -> dict:
    """Carga el archivo de tracking con formato mejorado."""
    if os.path.exists(TRACKING_FILE):
        with open(TRACKING_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Migración: si es una lista (formato viejo), convertir a dict
            if isinstance(data, list):
                return {"ingested": {item: {"date": "unknown", "type": "pdf"} for item in data}}
            return data
    return {"ingested": {}}

def save_tracking(tracking_data: dict):
    with open(TRACKING_FILE, "w", encoding="utf-8") as f:
        json.dump(tracking_data, f, indent=4, ensure_ascii=False)

def detect_language(text: str) -> str:
    """Detección simple de idioma basada en palabras comunes."""
    spanish_words = {"de", "en", "que", "los", "las", "del", "una", "por", "para", "con", "como", "más", "este", "pero", "sus", "sobre", "también", "contenido", "crear", "estrategia"}
    english_words = {"the", "and", "for", "with", "that", "this", "from", "your", "are", "have", "will", "can", "about", "content", "create", "strategy"}
    
    words = set(re.findall(r'\b\w+\b', text.lower()))
    
    es_count = len(words & spanish_words)
    en_count = len(words & english_words)
    
    if es_count > en_count:
        return "es"
    elif en_count > es_count:
        return "en"
    return "mixed"

def detect_category(text: str, source: str = "") -> str:
    """Clasifica automáticamente el contenido en una categoría temática."""
    combined = (text[:2000] + " " + source).lower()
    
    categories = {
        "hooks_retencion": ["hook", "viral", "scroll", "retención", "retention", "attention", "gancho", "opening", "first seconds", "primeros segundos"],
        "estrategia_contenido": ["strategy", "estrategia", "pillar", "calendar", "calendario", "framework", "content plan", "editorial"],
        "plataformas_algoritmos": ["algorithm", "algoritmo", "tiktok", "reels", "shorts", "platform", "plataforma", "engagement rate", "watch time"],
        "monetizacion": ["monetiz", "revenue", "income", "brand deal", "sponsor", "creator economy", "económi", "dinero", "ganar"],
        "seo_ai_search": ["seo", "search", "ai overview", "ranking", "keyword", "google", "optimization", "optimización"],
        "storytelling_copywriting": ["storytelling", "copy", "writing", "narrativ", "script", "guion", "caption"],
    }
    
    scores = {}
    for cat, keywords in categories.items():
        scores[cat] = sum(1 for kw in keywords if kw in combined)
    
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "general"

def generate_content_hash(text: str) -> str:
    """Genera un hash del contenido para evitar duplicados."""
    return hashlib.md5(text[:5000].encode()).hexdigest()

def create_text_splitter() -> RecursiveCharacterTextSplitter:
    """Crea el splitter con configuración optimizada para contenido de creadores."""
    return RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        length_function=len,
        separators=SEPARATORS,
    )

def clean_web_text(text: str) -> str:
    """Limpia texto extraído de la web: remueve navegación, footers, ads."""
    # Remover múltiples líneas vacías
    text = re.sub(r'\n{4,}', '\n\n\n', text)
    # Remover líneas que son solo símbolos o muy cortas (menús, breadcrumbs)
    lines = text.split('\n')
    cleaned = []
    for line in lines:
        stripped = line.strip()
        # Saltar líneas vacías consecutivas ya manejadas, menús cortos, o líneas de solo símbolos
        if len(stripped) < 3 and stripped not in ('', ):
            continue
        if re.match(r'^[\|\-\>\•\→\←\►\●\★\☆\…]+$', stripped):
            continue
        # Saltar patrones comunes de navegación web
        if re.match(r'^(cookie|privacy|terms|subscribe|sign up|log in|menu|home|about|contact)\s*$', stripped.lower()):
            continue
        cleaned.append(line)
    
    return '\n'.join(cleaned).strip()

# ==========================================
# INGESTA DE PDFs (MEJORADA)
# ==========================================
def ingest_pdf(pdf_path: Path, category: Optional[str] = None) -> dict:
    """
    Ingesta un PDF individual con metadata enriquecida.
    Ahora preserva el número de página en el metadata de cada chunk.
    """
    filename = pdf_path.name
    loader = PyPDFLoader(str(pdf_path))
    pages = loader.load()
    
    if not pages:
        return {"success": False, "error": "PDF vacío o no se pudo leer"}
    
    # Detectar idioma y categoría del contenido completo
    full_text = "\n".join([p.page_content for p in pages])
    language = detect_language(full_text)
    auto_category = category or detect_category(full_text, filename)
    content_hash = generate_content_hash(full_text)
    
    splitter = create_text_splitter()
    total_chunks = 0
    
    # Procesar página por página para preservar metadata de página
    for page in pages:
        if not page.page_content.strip():
            continue
            
        chunks = splitter.split_text(page.page_content)
        
        metadatas = []
        for i, chunk in enumerate(chunks):
            metadatas.append({
                "source": filename,
                "type": "pdf",
                "category": auto_category,
                "language": language,
                "page": page.metadata.get("page", 0) + 1,  # PyPDF usa 0-indexed
                "chunk_index": i,
                "ingested_at": datetime.now().isoformat(),
                "content_hash": content_hash,
            })
        
        if chunks:
            qdrant_search_service.vector_store.add_texts(chunks, metadatas=metadatas)
            total_chunks += len(chunks)
    
    return {
        "success": True,
        "source": filename,
        "type": "pdf",
        "category": auto_category,
        "language": language,
        "chunks_created": total_chunks,
        "pages": len(pages),
    }

# ==========================================
# INGESTA DE URLs WEB (NUEVO)
# ==========================================
def ingest_url(url: str, category: Optional[str] = None, custom_title: Optional[str] = None) -> dict:
    """
    Descarga una página web, extrae el texto limpio y lo ingesta en Qdrant.
    Usa trafilatura para extracción de contenido principal (ignora menús, ads, footers).
    """
    try:
        import trafilatura
    except ImportError:
        return {"success": False, "error": "Instala trafilatura: pip install trafilatura"}
    
    print(f"   Descargando: {url}")
    
    # Descargar y extraer contenido principal
    downloaded = trafilatura.fetch_url(url)
    if not downloaded:
        return {"success": False, "error": f"No se pudo descargar: {url}"}
    
    text = trafilatura.extract(
        downloaded,
        include_comments=False,
        include_tables=True,
        favor_precision=True,
    )
    
    if not text or len(text.strip()) < 200:
        return {"success": False, "error": "Contenido extraído demasiado corto o vacío"}
    
    # Extraer título si no se proporcionó
    metadata_extracted = trafilatura.extract(downloaded, output_format="json")
    if metadata_extracted:
        import json as json_lib
        try:
            meta = json_lib.loads(metadata_extracted)
            title = custom_title or meta.get("title", url)
            author = meta.get("author", "Desconocido")
            date = meta.get("date", "Desconocida")
        except Exception:
            title = custom_title or url
            author = "Desconocido"
            date = "Desconocida"
    else:
        title = custom_title or url
        author = "Desconocido"
        date = "Desconocida"
    
    # Limpiar texto
    text = clean_web_text(text)
    
    # Detectar idioma y categoría
    language = detect_language(text)
    auto_category = category or detect_category(text, title)
    content_hash = generate_content_hash(text)
    
    # Crear un source_id legible para el tracking
    source_id = re.sub(r'[^\w\-]', '_', title[:60]).strip('_')
    
    # Fragmentar
    splitter = create_text_splitter()
    chunks = splitter.split_text(text)
    
    metadatas = [{
        "source": title,
        "source_url": url,
        "type": "web",
        "category": auto_category,
        "language": language,
        "author": author,
        "publish_date": date,
        "chunk_index": i,
        "ingested_at": datetime.now().isoformat(),
        "content_hash": content_hash,
    } for i, _ in enumerate(chunks)]
    
    qdrant_search_service.vector_store.add_texts(chunks, metadatas=metadatas)
    
    print(f"   '{title}' ingestado: {len(chunks)} chunks, idioma: {language}, categoría: {auto_category}")
    
    return {
        "success": True,
        "source": title,
        "source_id": source_id,
        "type": "web",
        "category": auto_category,
        "language": language,
        "chunks_created": len(chunks),
        "url": url,
    }

# ==========================================
# INGESTA DE TEXTO DIRECTO (MEJORADA)
# ==========================================
def ingest_text(text: str, source: str, category: Optional[str] = None, language: Optional[str] = None) -> dict:
    """
    Ingesta texto directamente (para contenido propio del creador, notas, etc).
    """
    if not text or len(text.strip()) < 50:
        return {"success": False, "error": "Texto demasiado corto (mínimo 50 caracteres)"}
    
    detected_lang = language or detect_language(text)
    auto_category = category or detect_category(text, source)
    content_hash = generate_content_hash(text)
    
    splitter = create_text_splitter()
    chunks = splitter.split_text(text)
    
    metadatas = [{
        "source": source,
        "type": "manual",
        "category": auto_category,
        "language": detected_lang,
        "chunk_index": i,
        "ingested_at": datetime.now().isoformat(),
        "content_hash": content_hash,
    } for i, _ in enumerate(chunks)]
    
    qdrant_search_service.vector_store.add_texts(chunks, metadatas=metadatas)
    
    return {
        "success": True,
        "source": source,
        "type": "manual",
        "category": auto_category,
        "language": detected_lang,
        "chunks_created": len(chunks),
    }

# ==========================================
# INGESTA MASIVA (TODOS LOS PDFs + URLs)
# ==========================================
def ingest_all_pdfs():
    """Lee todos los PDFs de la carpeta 'data' e ingesta los nuevos."""
    if not DATA_FOLDER.exists() or not DATA_FOLDER.is_dir():
        print("No se encontró la carpeta 'data'.")
        return
    
    pdf_files = list(DATA_FOLDER.glob("*.pdf"))
    if not pdf_files:
        print("No se encontraron archivos PDF en 'data'.")
        return
    
    tracking = load_tracking()
    new_count = 0
    
    print(f"Escaneando {len(pdf_files)} PDFs...\n")
    
    for pdf_path in pdf_files:
        filename = pdf_path.name
        
        if filename in tracking["ingested"]:
            print(f"   '{filename}' ya procesado. Saltando.")
            continue
        
        print(f"   Procesando: {filename}")
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                result = ingest_pdf(pdf_path)
                
                if result["success"]:
                    tracking["ingested"][filename] = {
                        "date": datetime.now().isoformat(),
                        "type": "pdf",
                        "category": result["category"],
                        "language": result["language"],
                        "chunks": result["chunks_created"],
                        "pages": result["pages"],
                    }
                    save_tracking(tracking)
                    new_count += 1
                    print(f"   '{filename}' ingestado: {result['chunks_created']} chunks, "
                          f"categoría: {result['category']}, idioma: {result['language']}\n")
                    time.sleep(3)
                    break
                else:
                    print(f"   Error: {result['error']}\n")
                    break
                    
            except Exception as e:
                error_str = str(e)
                if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                    print(f"   Límite de Gemini. Esperando 65s... (Intento {attempt + 1}/{max_retries})")
                    time.sleep(65)
                else:
                    print(f"   Error crítico: {error_str}\n")
                    break
    
    if new_count == 0:
        print("Todos los documentos ya estaban en la base de datos.")
    else:
        print(f"Ingesta finalizada: {new_count} documentos nuevos.")

def ingest_urls_from_file(filepath: str = "urls_to_ingest.json"):
    """
    Lee un archivo JSON con URLs para ingestar.
    Formato esperado:
    [
        {"url": "https://...", "category": "hooks_retencion", "title": "Opcional"},
        {"url": "https://...", "category": "estrategia_contenido"}
    ]
    """
    if not os.path.exists(filepath):
        print(f"Archivo '{filepath}' no encontrado.")
        print("Crea el archivo con formato: [{\"url\": \"...\", \"category\": \"...\"}]")
        return
    
    with open(filepath, "r", encoding="utf-8") as f:
        urls = json.load(f)
    
    tracking = load_tracking()
    new_count = 0
    
    print(f"Procesando {len(urls)} URLs...\n")
    
    for entry in urls:
        url = entry["url"]
        category = entry.get("category")
        title = entry.get("title")
        
        # Verificar si ya fue ingestada
        if url in tracking["ingested"]:
            print(f"   '{url}' ya procesada. Saltando.")
            continue
        
        max_retries = 2
        for attempt in range(max_retries):
            try:
                result = ingest_url(url, category=category, custom_title=title)
                
                if result["success"]:
                    tracking["ingested"][url] = {
                        "date": datetime.now().isoformat(),
                        "type": "web",
                        "category": result["category"],
                        "language": result["language"],
                        "chunks": result["chunks_created"],
                        "source": result["source"],
                    }
                    save_tracking(tracking)
                    new_count += 1
                    time.sleep(3)
                    break
                else:
                    print(f"   Error: {result['error']}")
                    break
                    
            except Exception as e:
                error_str = str(e)
                if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                    print(f"   Límite de API. Esperando 65s... (Intento {attempt + 1}/{max_retries})")
                    time.sleep(65)
                else:
                    print(f"   Error: {error_str}")
                    break
    
    print(f"\nIngesta de URLs finalizada: {new_count} nuevas fuentes.")

# ==========================================
# CLI
# ==========================================
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == "pdfs":
            ingest_all_pdfs()
        elif command == "urls":
            filepath = sys.argv[2] if len(sys.argv) > 2 else "urls_to_ingest.json"
            ingest_urls_from_file(filepath)
        elif command == "all":
            print("=== INGESTA DE PDFs ===\n")
            ingest_all_pdfs()
            print("\n=== INGESTA DE URLs ===\n")
            ingest_urls_from_file()
        elif command == "url" and len(sys.argv) > 2:
            # Ingestar una URL individual: python ingest_data.py url https://...
            url = sys.argv[2]
            cat = sys.argv[3] if len(sys.argv) > 3 else None
            result = ingest_url(url, category=cat)
            print(json.dumps(result, indent=2, ensure_ascii=False))
        elif command == "stats":
            tracking = load_tracking()
            total = len(tracking["ingested"])
            by_type = {}
            by_category = {}
            for key, info in tracking["ingested"].items():
                t = info.get("type", "unknown")
                c = info.get("category", "unknown")
                by_type[t] = by_type.get(t, 0) + 1
                by_category[c] = by_category.get(c, 0) + 1
            print(f"Total fuentes ingestadas: {total}")
            print(f"Por tipo: {json.dumps(by_type, indent=2)}")
            print(f"Por categoría: {json.dumps(by_category, indent=2)}")
        else:
            print("Uso:")
            print("  python ingest_data.py pdfs          - Ingestar PDFs de data/")
            print("  python ingest_data.py urls           - Ingestar URLs de urls_to_ingest.json")
            print("  python ingest_data.py all            - Ingestar todo")
            print("  python ingest_data.py url <URL>      - Ingestar una URL individual")
            print("  python ingest_data.py stats          - Ver estadísticas")
    else:
        # Sin argumentos: comportamiento original (solo PDFs)
        ingest_all_pdfs()
