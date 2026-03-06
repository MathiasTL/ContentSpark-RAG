from langchain_core.messages import SystemMessage, HumanMessage
from app.services.llm_services import llm_service
from app.services.qdrant_services import qdrant_search_service

class RAGService:
    async def generate_response(self, user_message: str) -> str:
        """
        Función principal del servicio RAG que recibe un mensaje del usuario, busca información relevante en Qdrant y genera una respuesta usando el LLM.
        """
        # 1. Recuperar la información (La Memoria)
        print(f"🔍 Buscando contexto en Qdrant para: '{user_message}'...")
        docs = qdrant_search_service.search_similar(user_message, top_k=2)
        
        # Unimos los textos recuperados en un solo bloque legible para el LLM
        context_text = "\n\n".join([
            f"[Fuente: {doc.metadata.get('source', 'Desconocida')}]\n{doc.page_content}" 
            for doc in docs
        ])
        
        # 2. Construir el prompt para el LLM combinando el mensaje del usuario con los documentos relevantes encontrados
        system_prompt = f"""Eres ContentSpark, un asistente Senior experto en creación de contenido para TikTok, Shorts y Reels.
        Tu objetivo es responder a las preguntas del creador de contenido basándote ÚNICAMENTE en la siguiente información de contexto extraída de tu base de datos de conocimientos.
        Si la respuesta no está claramente en el contexto, no inventes cosas. Sugiere que no tienes esa información exacta, pero dale un buen consejo general de contenido.CONTEXTO RECUPERADO DE LA BASE DE DATOS:{context_text}"""
        
        # 3. Llamar al LLM (El Cerebro)
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_message)
        ]
        
        print("🧠 Procesando respuesta con Llama 3...")
        response = await llm_service.llm.ainvoke(messages)
        
        return response.content
    
#Instancia del servicio RAG para ser utilizada en los endpoints de la API
rag_service = RAGService()