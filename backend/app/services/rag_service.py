from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from app.services.llm_services import llm_service
from app.services.qdrant_services import qdrant_search_service

class RAGService:
    async def generate_response(self, user_message: str, history: list = None) -> str:
        """
        Función principal del servicio RAG que recibe un mensaje del usuario, busca información relevante en Qdrant y genera una respuesta usando el LLM.
        """
        history = history or []  # Si no se proporciona historial, inicializamos una lista vacía
        
        # 1. Recuperar la información (La Memoria)
        print(f"🔍 Buscando contexto en Qdrant para: '{user_message}'...")
        docs = qdrant_search_service.search_similar(user_message, top_k=2)
        
        # Unimos los textos recuperados en un solo bloque legible para el LLM
        context_text = "\n\n".join([
            f"[Fuente: {doc.metadata.get('source', 'Desconocida')}]\n{doc.page_content}" 
            for doc in docs
        ])
        
        # 2. Construir el prompt para el LLM combinando el mensaje del usuario con los documentos relevantes encontrados
        system_prompt = f"""Eres ContentSpark, un asistente Senior experto en creación de contenido.Tu objetivo es responder a las preguntas basándote ÚNICAMENTE en la siguiente información de la base de datos.
        Si la respuesta no está en el contexto, da un consejo general de contenido.CONTEXTO RECUPERADO:
        {context_text}
        """
        
        # 1. Iniciamos la lista de mensajes con las instrucciones del sistema
        messages = [SystemMessage(content=system_prompt)]
        
        # 2. INYECTAMOS LA MEMORIA (Historial)
        if history:
            print(f"🧠 Cargando {len(history)} mensajes del historial...")
            for msg in history:
                # Ahora accedemos a los atributos del objeto con un punto (.)
                if msg.role == "user":
                    messages.append(HumanMessage(content=msg.content))
                elif msg.role == "ai":
                    messages.append(AIMessage(content=msg.content))
                    
        # 3. Agregamos el mensaje actual del usuario al final de la conversación
        messages.append(HumanMessage(content=user_message))
        
        print("🧠 Procesando respuesta con Llama 3...")
        response = await llm_service.llm.ainvoke(messages)
        
        return response.content
    
#Instancia del servicio RAG para ser utilizada en los endpoints de la API
rag_service = RAGService()