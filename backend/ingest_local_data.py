import os
import json
import time
from pathlib import Path
from langchain_community.document_loaders import PyPDFLoader

# Importamos el servicio de Qdrant para guardar los documentos procesados
from app.services.qdrant_services import qdrant_search_service

TRACKING_FILE = "ingest_tracking.json"

def load_tracking():
    if os.path.exists(TRACKING_FILE):
        with open(TRACKING_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def save_tracking(tracking_data):
    with open(TRACKING_FILE, "w", encoding="utf-8") as f:
        json.dump(tracking_data, f, indent=4)

def ingest_all_pdfs():
    """
    Lee todos los archivos PDF de la carpeta 'data', los procesa y los ingesta en Qdrant para ser fragmentados y guardados.
    """
    
    #Define path to the data folder, where the PDFs are stored
    data_folder = Path("data")
    
    #Check if the data folder exists
    if not data_folder.exists() or not data_folder.is_dir():
        print("⚠️ ERROR: No se encontró la carpeta 'data'.")
        return
    
    #Iterate over all PDF files in the data folder
    pdf_files = list(data_folder.glob("*.pdf"))
    
    if len(pdf_files) == 0:
        print("⚠️ No se encontraron archivos PDF en la carpeta 'data'.")
        return
    
    ingest_tracking = load_tracking()
    newsly_pdfs = 0
    
    print(f"📚 Escaneando {len(pdf_files)} PDFs en la carpeta...\n")
    
    # Process each PDF file
    for pdf_path in pdf_files:
        filename = pdf_path.name
        
        if filename in ingest_tracking:
            print(f"⏭️  El archivo '{filename}' ya fue procesado. Saltando...")
            continue
        
        print(f"📄 Procesando nuevo pdf: {filename}")
        
        # Intentaremos hasta 3 veces si nos topamos con el límite de cuota
        max_retries = 3
        for attempt in range(max_retries):
            try:
                loader = PyPDFLoader(str(pdf_path))
                pages = loader.load()
                full_text = "\n".join([page.page_content for page in pages])
            
                metadata = {
                    "source": filename,
                    "type": "pdf_curado"
                }
                
                # Pasamos los argumentos de forma segura (con sus nombres)
                result = qdrant_search_service.add_document(text=full_text, metadata=metadata)
                
                ingest_tracking.append(filename)
                save_tracking(ingest_tracking)
                newsly_pdfs += 1
                
                print(f"✅ Archivo '{filename}' ingestado correctamente. Chunks creados: {result['chunks_created']}\n")
                
                # Para evitar acumular peticiones muy rápido, pausamos 5 segundos entre cada PDF exitoso
                time.sleep(5) 
                break # Rompe el ciclo de reintentos porque tuvo éxito
                
            except Exception as e:
                error_str = str(e)
                # Detectamos si es el error de cuota de Gemini
                if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                    print(f"⏳ Límite de Gemini alcanzado. Enfriando motores por 65 segundos... (Intento {attempt + 1}/{max_retries})")
                    time.sleep(65) # Esperamos más de 1 minuto para que la cuota se reinicie
                else:
                    # Si es otro error (ej. PDF corrupto), lo imprimimos y saltamos al siguiente archivo
                    print(f"❌ Error crítico al procesar '{filename}': {error_str}\n")
                    break
            
    if newsly_pdfs == 0:
        print("🎉 Todos los documentos de la carpeta ya estaban en la base de datos.")
    else:
        print(f"🎉 ¡Ingesta finalizada! Se inyectaron {newsly_pdfs} documentos nuevos.")
    
if __name__ == "__main__":
    ingest_all_pdfs()