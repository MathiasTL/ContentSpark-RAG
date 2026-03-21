import os
from pathlib import Path
from langchain_community.document_loaders import PyPDFLoader

# Importamos el servicio de Qdrant para guardar los documentos procesados
from app.services.qdrant_services import qdrant_search_service

def ingest_all_pdfs():
    """
    Lee todos los archivos PDF de la carpeta 'data', los procesa y los ingesta en Qdrant para ser fragmentados y guardados.
    """
    
    #Define path to the data folder, where the PDFs are stored
    data_folder = Path("data")
    
    #Check if the data folder exists
    if not data_folder.exists() or not data_folder.is_dir():
        print("⚠️ ERROR: No se encontró la carpeta 'data' o no es un directorio.")
        return
    
    #Iterate over all PDF files in the data folder
    pdf_files = list(data_folder.glob("*.pdf"))
    
    if len(pdf_files) == 0:
        print("⚠️ No se encontraron archivos PDF en la carpeta 'data'.")
        return
    
    print(f"📂 Encontrados {len(pdf_files)} archivos PDF. Procesando e ingestiéndolos en Qdrant...")
    
    # Process each PDF file
    for pdf_path in pdf_files:
        print(f"📄 Procesando archivo: {pdf_path.name}")
        
        try:
            # Load the PDF using PyPDFLoader
            loader = PyPDFLoader(str(pdf_path))
            pages = loader.load()
            
            # Each document is a page of the PDF. We can concatenate them into a single text or process them individually.
            # For simplicity, we will concatenate all pages into a single text.
            full_text = "\n".join([page.page_content for page in pages])
        
            # Ingest the full text into Qdrant with metadata indicating the source file
            metadata = {"source": pdf_path.name}
            
            # Save the result of the add_document function, which includes the number of chunks created, to log the ingestion process
            result = qdrant_search_service.add_document(full_text, metadata)
            print(f"✅ Archivo '{pdf_path.name}' ingestado correctamente en Qdrant. Chunks creados: {result['chunks_created']}")
            
        except Exception as e:
            print(f"❌ Error al procesar el archivo {pdf_path.name}: {e}")
            
    print("📥 Proceso de ingestión de PDFs completado.")
    
if __name__ == "__main__":
    ingest_all_pdfs()