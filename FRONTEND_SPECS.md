# Arquitectura Frontend: ContentSpark UI

## 1. Stack Tecnológico
* **Framework:** Next.js (App Router).
* **Lenguaje:** TypeScript.
* **Estilos:** Tailwind CSS.
* **Conexión Backend:** Fetch API nativa hacia `http://localhost:8000/api/chat`.

## 2. Tipografía
* **Fuente Principal:** `Inter` (importada vía `next/font/google` en `layout.tsx`). Es la alternativa estándar de la industria a la tipografía *San Francisco* de Apple.
* **Pesos:** Light (300) para textos largos, Regular (400) para UI, y Semibold (600) para títulos.

## 3. Guía de Estilos UI/UX (Estética Apple / Liquid Glass)
El diseño debe imitar la interfaz fluida de iOS y macOS usando la técnica de Glassmorphism.

* **Fondo General (Background):** Un gradiente suave, moderno e inmersivo (ej. tonos púrpuras, azules y rosados pasteles muy sutiles, estilo macOS Monterey/Sonoma).
* **Contenedor Principal (Glassmorphism):**
    * Fondo semi-transparente: `bg-white/10` o `bg-white/20`.
    * Desenfoque (Blur): `backdrop-blur-xl`.
    * Bordes: Finos y semi-transparentes `border border-white/20`.
    * Sombras: Suaves y difuminadas `shadow-2xl`.
    * Esquinas: Ultra redondeadas `rounded-3xl`.
* **Burbujas de Chat (Estilo iMessage/iOS):**
    * **Usuario (Derecha):** Color sólido o gradiente sutil (ej. azul vibrante estilo iMessage `bg-blue-500 text-white`). Esquinas redondeadas excepto la inferior derecha (`rounded-2xl rounded-br-none`).
    * **Bot/ContentSpark (Izquierda):** Efecto Liquid Glass (`bg-white/30 backdrop-blur-md text-gray-800 border border-white/40`). Esquinas redondeadas excepto la inferior izquierda (`rounded-2xl rounded-bl-none`).
* **Input Area:** Integrado sin bordes bruscos, con un botón de envío que resalte y soporte "Enter" para enviar.

## 4. Comportamiento (Lógica de React)
* Debe ser un Client Component (`"use client"`).
* Debe mantener un estado `messages` (Array de objetos `{ role: 'user' | 'ai', content: string }`).
* Debe manejar un estado `isLoading` para mostrar un indicador visual cuando el backend (FastAPI) esté procesando.
* Auto-scroll hacia el último mensaje al recibir respuesta.