"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getSourcesFromBackend, streamMessageFromBackend } from "@/lib/api";
import ChatSidebar from "@/components/ChatSidebar";
import ChatHeader from "@/components/ChatHeader";
import Background from "@/components/Background";
import { ScrollArea } from "@/components/ui/scroll-area";
import SourcesModal from "@/components/SourcesModal";
import type { Source } from "@/lib/api";

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

const SUGGESTED_PROMPTS = [
  "Dame hooks virales para mi próximo Reel",
  "Estrategia de contenido para esta semana",
  "Ideas de contenido trending",
];

function TypingIndicator() {
  return (
    <div className="flex items-end justify-start">
      <div className="bg-white/50 backdrop-blur-md border border-white/40 text-gray-800 rounded-2xl rounded-bl-none px-4 py-3">
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
  const [hasStartedStreaming, setHasStartedStreaming] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [isSourcesLoading, setIsSourcesLoading] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
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
    setHasStartedStreaming(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  async function openSourcesModal() {
    setIsSourcesOpen(true);
    setIsSourcesLoading(true);
    setSourcesError(null);

    const result = await getSourcesFromBackend();

    if (!result.success) {
      setSources([]);
      setSourcesError("No fue posible cargar las fuentes en este momento.");
      setIsSourcesLoading(false);
      return;
    }

    const pdfSources = result.sources.filter((source) => {
      const type = source.type.toLowerCase();
      const title = source.title.toLowerCase();
      return type.includes("pdf") || title.endsWith(".pdf");
    });

    setSources(pdfSources);
    setIsSourcesLoading(false);
  }

  async function handleSend(text: string) {
    if (!text || isLoading) return;

    const currentHistory = [...messages];
    const requestVersion = requestVersionRef.current;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setHasStartedStreaming(false);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setIsLoading(true);

    try {
      await streamMessageFromBackend(text, currentHistory, (chunk) => {
        if (requestVersion !== requestVersionRef.current) return;

        if (chunk.length > 0) setHasStartedStreaming(true);

        setMessages((prev) => {
          const next = [...prev];
          const lastIndex = next.length - 1;

          if (lastIndex >= 0 && next[lastIndex].role === "ai") {
            next[lastIndex] = {
              ...next[lastIndex],
              content: next[lastIndex].content + chunk,
            };
          } else {
            next.push({ role: "ai", content: chunk });
          }

          return next;
        });
      });
    } catch {
      if (requestVersion !== requestVersionRef.current) return;
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setIsLoading(false);
        setHasStartedStreaming(false);
      }
    }
  }

  async function sendMessage() {
    await handleSend(input.trim());
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

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {/* Header independiente con su propio glass */}
          <ChatHeader onOpenSources={openSourcesModal} />

          {/* Contenedor del chat */}
          <div className="flex flex-1 flex-col bg-white/20 backdrop-blur-xl border border-white/30 shadow-2xl rounded-3xl overflow-hidden min-h-0">

            {/* Área de mensajes */}
            <ScrollArea className="flex-1">
              <div className="px-4 py-6 space-y-4">
                {messages.map((msg, i) =>
                  msg.role === "user" ? (
                    <div key={i} className="flex items-end justify-end">
                      <div className="max-w-[75%] bg-blue-500 text-white rounded-2xl rounded-br-none px-4 py-2.5 text-sm leading-relaxed shadow-md">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="flex items-end justify-start">
                      <div className="max-w-[75%] bg-white/50 backdrop-blur-md border border-white/40 text-gray-800 rounded-2xl rounded-bl-none px-4 py-2.5 text-sm leading-relaxed shadow-sm">
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
                        {/* Citación de fuente — placeholder estático, se conectará al backend */}
                        {i > 0 && (
                          <p className="text-xs text-gray-400/60 mt-2 italic">Fuente: ContentSpark Knowledge Base</p>
                        )}
                      </div>
                    </div>
                  )
                )}

                {/* Suggested prompts — visibles solo cuando el chat está vacío */}
                {messages.length === 1 && !isLoading && (
                  <div className="flex flex-wrap gap-2 justify-center mt-2">
                    {SUGGESTED_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => handleSend(prompt)}
                        className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl px-4 py-2 text-sm text-gray-700 hover:bg-white/40 transition cursor-pointer"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}

                {isLoading && !hasStartedStreaming && <TypingIndicator />}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            {/* Input area */}
            <div className="shrink-0 px-4 py-4 border-t border-white/20 bg-white/10 backdrop-blur-md">
              <div
                className={`flex items-end gap-3 bg-white/30 backdrop-blur-md border rounded-2xl px-4 py-2 shadow-inner transition-colors duration-200 ${
                  isFocused ? "border-white/50" : "border-white/20"
                }`}
              >
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="Pregunta sobre tu contenido..."
                  disabled={isLoading}
                  className="flex-1 bg-transparent text-gray-800 placeholder-gray-400 text-sm outline-none resize-none overflow-hidden max-h-40 leading-relaxed py-1 disabled:opacity-50"
                />
                <button
                  onClick={sendMessage}
                  disabled={isLoading || !input.trim()}
                  aria-label="Enviar mensaje"
                  className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-md transition-all hover:scale-105 hover:shadow-indigo-300/50 hover:shadow-lg active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 shrink-0"
                >
                  {isLoading ? (
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 translate-x-px">
                      <path d="M3.478 2.405a.75.75 0 0 0-.926.94l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.405Z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-center text-xs text-gray-400 mt-2 font-light">
                Presiona <kbd className="px-1 py-0.5 rounded bg-white/30 border border-white/40 text-gray-500 text-[11px]">Enter</kbd> para enviar
              </p>
            </div>

          </div>
        </div>
      </div>

      <SourcesModal
        isOpen={isSourcesOpen}
        isLoading={isSourcesLoading}
        sources={sources}
        error={sourcesError}
        onClose={() => setIsSourcesOpen(false)}
      />
    </main>
  );
}
