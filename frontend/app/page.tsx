"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { sendMessageToBackend } from "@/lib/api";
import ChatSidebar from "@/components/ChatSidebar";
import ChatHeader from "@/components/ChatHeader";
import Background from "@/components/Background";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  role: "user" | "ai";
  content: string;
}

const initialMessages: Message[] = [
  {
    role: "ai",
    content:
      "¡Hola! Soy ContentSpark ✨ Tu asistente de IA para creadores de contenido. ¿En qué puedo ayudarte hoy?",
  },
];

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
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const requestVersionRef = useRef(0);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  function resetChat() {
    requestVersionRef.current += 1;
    setMessages(initialMessages);
    setInput("");
    setIsLoading(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || isLoading) return;

    // 1. Save the current history before updating the state, to ensure we send the most up-to-date conversation to the backend.
    // This is crusial to ensure that the backend receives the full conversation history
    const currentHistory = [...messages];
    const requestVersion = requestVersionRef.current;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setIsLoading(true);

    try {
      // 3. Usamos nuestra capa de API profesional (Separation of Concerns)
      // Le pasamos el texto nuevo y el historial de memoria
      const data = await sendMessageToBackend(text, currentHistory);

      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      // 4. Mostramos la respuesta en la pantalla
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: data.response },
      ]);
    } catch {
      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content: "Lo siento, hubo un error al conectar con el servidor. Por favor, inténtalo de nuevo.",
        },
      ]);
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setIsLoading(false);
      }
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <main className="relative isolate min-h-screen w-full overflow-hidden flex items-center justify-center p-4">
      <Background />

      <div className="relative z-10 w-full max-w-6xl h-[85vh] flex flex-col gap-4 md:flex-row">
        <ChatSidebar onNewChat={resetChat} />

        <div className="flex min-w-0 flex-1 flex-col bg-white/20 backdrop-blur-xl border border-white/30 shadow-2xl rounded-3xl overflow-hidden">
          <ChatHeader />

          {/* Messages area */}
          <ScrollArea className="flex-1">
            <div className="px-4 py-6 space-y-4">
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
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          strong: ({ children }) => <strong className="font-semibold text-indigo-900">{children}</strong>,
                          b: ({ children }) => <b className="font-semibold text-indigo-900">{children}</b>,
                          ul: ({ children }) => <ul className="list-disc ml-4 mb-2 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal ml-4 mb-2 space-y-1">{children}</ol>,
                          li: ({ children }) => <li>{children}</li>,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                )
              )}

              {isLoading && <TypingIndicator />}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

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
      </div>
    </main>
  );
}
