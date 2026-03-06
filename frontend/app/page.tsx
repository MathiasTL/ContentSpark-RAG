"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";

interface Message {
  role: "user" | "ai";
  content: string;
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 justify-start">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/40 backdrop-blur-md border border-white/40 text-sm font-semibold text-indigo-600 shrink-0">
        CS
      </div>
      <div className="bg-white/50 backdrop-blur-md border border-white/40 text-gray-800 rounded-2xl rounded-bl-sm px-4 py-3">
        <span className="flex gap-1 items-center h-5">
          <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" />
        </span>
      </div>
    </div>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      content:
        "¡Hola! Soy ContentSpark ✨ Tu asistente de IA para creadores de contenido. ¿En qué puedo ayudarte hoy?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || isLoading) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setIsLoading(true);

    try {
      const res = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data: { success: boolean; response: string } = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: data.response },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content: "Lo siento, hubo un error al conectar con el servidor. Por favor, inténtalo de nuevo.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <main className="min-h-screen w-full bg-gradient-to-br from-indigo-100 via-purple-50 to-blue-100 flex items-center justify-center p-4">
      {/* Glass chat container */}
      <div className="w-full max-w-2xl h-[85vh] flex flex-col bg-white/20 backdrop-blur-xl border border-white/30 shadow-2xl rounded-3xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/20 bg-white/10 backdrop-blur-md shrink-0">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 shadow-md">
            <span className="text-white text-sm font-semibold">CS</span>
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-800 leading-tight">ContentSpark</h1>
            <p className="text-xs text-gray-500 font-light">IA para Creadores de Contenido</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 shadow-sm shadow-green-300" />
            <span className="text-xs text-gray-500">En línea</span>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {messages.map((msg, i) =>
            msg.role === "user" ? (
              <div key={i} className="flex items-end gap-2 justify-end">
                <div className="max-w-[75%] bg-blue-500 text-white rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed shadow-md">
                  {msg.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex items-end gap-2 justify-start">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/40 backdrop-blur-md border border-white/40 text-sm font-semibold text-indigo-600 shrink-0">
                  CS
                </div>
                <div className="max-w-[75%] bg-white/50 backdrop-blur-md border border-white/40 text-gray-800 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm leading-relaxed shadow-sm">
                  {msg.content}
                </div>
              </div>
            )
          )}

          {isLoading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="shrink-0 px-4 py-4 border-t border-white/20 bg-white/10 backdrop-blur-md">
          <div className="flex items-end gap-3 bg-white/30 backdrop-blur-md border border-white/40 rounded-2xl px-4 py-2 shadow-inner">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu mensaje..."
              disabled={isLoading}
              className="flex-1 bg-transparent text-gray-800 placeholder-gray-400 text-sm outline-none resize-none overflow-hidden max-h-40 leading-relaxed py-1 disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              aria-label="Enviar mensaje"
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-md transition-all hover:scale-105 hover:shadow-indigo-300/50 hover:shadow-lg active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 translate-x-px">
                <path d="M3.478 2.405a.75.75 0 0 0-.926.94l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.405Z" />
              </svg>
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 mt-2 font-light">
            Presiona <kbd className="px-1 py-0.5 rounded bg-white/30 border border-white/40 text-gray-500 text-[11px]">Enter</kbd> para enviar
          </p>
        </div>

      </div>
    </main>
  );
}
