import os
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams
from langchain_qdrant import QdrantVectorStore

#Import the embeddings service to use the same vector generation for indexing and querying
from .embeddings_service import embeddings_service

load_dotenv()

class QdrantSearchService:
    def __init__(self):
        """
        Inicializa la conexión con Qdrant Cloud y configura el vector store.
        Usamos el modelo de embedding 'gemini-embedding-001' de Google Gemini para generar los vectores.
        """
        url = os.getenv("QDRANT_URL")
        api_key = os.getenv("QDRANT_API_KEY")
        self.collection_name = "contentspark_knowledge"
        
        if not url or not api_key:
            raise ValueError("⚠️ ERROR: No se encontraron QDRANT_URL o QDRANT_API_KEY en el archivo .env")
        
        print(f"🔍 Conectando a Qdrant en {url}...")
        
        # Inicializamos el cliente de Qdrant con la URL y la API key
        self.client = QdrantClient(
            url=url,
            api_key=api_key
        )
        
        # 2. Verificar si la colección (tabla) existe. Si no, la creamos.
        # NOTA ARQUITECTÓNICA: Gemini te devolvió 3072 dimensiones. Ajustamos el 'size' a 3072 para que coincida exactamente.
        if not self.client.collection_exists(self.collection_name):
            print(f"Creando colección '{self.collection_name}' en Qdrant...")
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(size=3072, distance=Distance.COSINE),
            )
            
        # 3. Configuramos el vector store de Langchain para usar Qdrant
        self.vector_store = QdrantVectorStore(
            client=self.client,
            collection_name=self.collection_name,
            embedding=embeddings_service.embeddings  # Usamos el mismo servicio de embeddings para mantener la consistencia
        )
        
    def add_document(self, text: str, metadata: dict=None):
        """
        Convierte un texto en un vector de embedding y lo guarda en Qdrant.
        """
        self.vector_store.add_texts([text], metadatas=[metadata or {}])
        return True 
        
    def search_similar(self, query: str, top_k: int=2):
        """
        Realiza una búsqueda de similitud en Qdrant usando el vector del query.
        Devuelve los documentos más similares.
        """
        results = self.vector_store.similarity_search(query, k=top_k)
        return results
    
    # Aquí podemos agregar métodos para indexar nuevos documentos, realizar búsquedas, etc.

#Instancia del servicio de búsqueda para ser utilizada en los endpoints de la API
qdrant_search_service = QdrantSearchService()