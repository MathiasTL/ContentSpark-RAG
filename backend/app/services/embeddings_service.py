import os
from dotenv import load_dotenv
from langchain_google_genai import GoogleGenerativeAIEmbeddings

load_dotenv()

class EmbeddingsService:
    def __init__(self):
        """
        Inicializa la conexión con Google Gemini para la generación de vectores.
        Usamos el modelo 'text-embedding-004' que es el estándar actual y más eficiente de Google.
        """
        
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY no está configurada en las variables de entorno.")
        
        self.embeddings = GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-001",
            api_key=api_key
        )
    
    async def generate_test_embedding(self, text: str) -> list[float]:
        """
        Función de prueba para generar un vector de embedding a partir de un texto.
        Esto nos ayudará a verificar que la conexión con Google Gemini funciona correctamente.
        """
        
        #aembed_query es una función asíncrona que genera el vector de embedding para el texto dado que no bloquea el servidor mientras espera la respuesta de Google Gemini
        vector = await self.embeddings.aembed_query(text)
        return vector
    
#Instancia del servicio de embeddings para ser utilizada en los endpoints de la API
embeddings_service = EmbeddingsService()