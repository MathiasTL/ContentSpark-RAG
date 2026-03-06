import os
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

#To charge variables from .env file to system
load_dotenv()

class LLMService:
    def __init__(self):
        """
        Inicializa la conexión con Groq usando el modelo Llama 3.
        Elegimos llama3-8b-8192 porque es absurdamente rápido y excelente para 
        tareas creativas y estructuradas como los hooks.
        """
        api_key =os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("⚠️ ERROR: No se encontró GROQ_API_KEY en el archivo .env")
        
        self.llm = ChatGroq(
            api_key=api_key,
            model="llama-3.1-8b-instant",
            temperature=0.7,  # balance between creativity and coherence
        )
        
    async def generate_text_hook(self, topic: str) -> str:
        """
        Función asíncrona de prueba para verificar que el LLM razona correctamente.
        Aquí aplicamos un 'System Prompt' básico para darle el rol de experto.
        """
        messages = [
            SystemMessage(content="""Eres un Arquitecto de Contenido experto en retención de audiencia para TikTok, Instagram Reels y YouTube Shorts. 
            Tu objetivo es generar un único Hook (Gancho) altamente persuasivo y controversial o intrigante.
            NO des explicaciones, devuelve ÚNICAMENTE el texto del hook."""),
            HumanMessage(content=f"Genera un hook viral para un video sobre el siguiente tema: {topic}")
        ]
        
        # ainvoke = Asynkronous invoke, to not block the server while waiting the answer of LLM
        response = await self.llm.ainvoke(messages)
        return response.content
    
    # Here we can add more methods for different kinds of content generation, like generating video scripts, captions, etc.
    

#Service instance to be used in the API endpoints
llm_service = LLMService()