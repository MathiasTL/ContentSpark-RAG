"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Paperclip, Send, UserCircle2 } from "lucide-react";
import { getSourcesFromBackend, streamMessageFromBackend } from "@/shared/lib/api-client";
import ChatHeader from "./components/ChatHeader";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import SourcesModal from "./components/SourcesModal";
import type { Source } from "@/shared/lib/api-client";

interface Message {
  role: "user" | "ai";
  content: string;
}

const initialMessages: Message[] = [
  {
    role: "ai",
    content: "", // placeholder — WelcomeMessage renders independently
  },
];

const SUGGESTED_PROMPTS = [
  "Dame hooks virales",
  "Estrategia de contenido para esta semana",
  "Ideas de contenido trending",
];

function WelcomeMessage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/20 bg-white/30 p-3 shadow-lg backdrop-blur-2xl">
        <Image
          src="/only_logo.png"
          alt="ContentSpark"
          width={52}
          height={52}
          priority
        />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-on-surface">
          Desata tu creatividad con ContentSpark
        </h2>
        <p className="mx-auto max-w-md text-sm font-light leading-relaxed text-on-surface-variant">
          Consulta tu base de conocimiento. ContentSpark busca en sus documentos
          ingestados y genera respuestas contextualizadas.
        </p>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex max-w-3xl gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/20 p-1.5 shadow-lg backdrop-blur-2xl">
        <Image src="/only_logo.png" alt="AI" width={28} height={28} />
      </div>
      <div className="rounded-3xl rounded-tl-none border border-white/10 bg-white/40 px-6 py-4 backdrop-blur-2xl">
        <span className="flex h-5 items-center gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-on-surface-variant [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-on-surface-variant [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-on-surface-variant" />
        </span>
      </div>
    </div>
  );
}

export default function ChatView() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasStartedStreaming, setHasStartedStreaming] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [welcomeFading, setWelcomeFading] = useState(false);
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [isSourcesLoading, setIsSourcesLoading] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const requestVersionRef = useRef(0);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Fade out welcome when the user sends their first message
  useEffect(() => {
    if (messages.length > 1 && showWelcome && !welcomeFading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWelcomeFading(true);
      const timer = setTimeout(() => setShowWelcome(false), 450);
      return () => clearTimeout(timer);
    }
  }, [messages.length, showWelcome, welcomeFading]);

  function resetChat() {
    requestVersionRef.current += 1;
    setMessages(initialMessages);
    setInput("");
    setIsLoading(false);
    setHasStartedStreaming(false);
    setShowWelcome(true);
    setWelcomeFading(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  // Reset when AppSidebar's "New Chat" navigates here with ?new=1
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      resetChat();
      router.replace(pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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

  // Conversation messages: skip index 0 (the welcome placeholder in state)
  const conversationMessages = messages.slice(1);

  return (
    <div className="flex h-dvh w-full">
      <section className="relative flex h-dvh min-w-0 flex-1 flex-col overflow-hidden bg-surface/60 backdrop-blur-sm">
        {/* Decorative blurs */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/10 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-secondary/10 blur-[120px]" />

        <ChatHeader onOpenSources={openSourcesModal} onNewChat={resetChat} />

        <ScrollArea className="relative z-10 min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]>div]:!flex [&_[data-radix-scroll-area-viewport]>div]:!min-h-full [&_[data-radix-scroll-area-viewport]>div]:!flex-col [&_[data-radix-scroll-area-viewport]>div]:!justify-end">
          <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-end space-y-8 px-12 pt-12 pb-6">
            {showWelcome && (
              <div
                className={`transition-all duration-500 ease-in-out ${
                  welcomeFading
                    ? "pointer-events-none -translate-y-2 scale-[0.98] opacity-0"
                    : "translate-y-0 scale-100 opacity-100"
                }`}
              >
                <WelcomeMessage />
              </div>
            )}

            {conversationMessages.map((msg, i) =>
              msg.role === "user" ? (
                <div key={i} className="ml-auto flex max-w-3xl flex-row-reverse gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-primary-container shadow-lg">
                    <UserCircle2 className="h-7 w-7 text-white/80" strokeWidth={1.25} />
                  </div>
                  <div className="liquid-gradient rounded-3xl rounded-tr-none border border-white/10 p-6 leading-relaxed text-white shadow-xl shadow-primary/10 backdrop-blur-2xl">
                    <p className="font-light">{msg.content}</p>
                  </div>
                </div>
              ) : (
                <div key={i} className="flex max-w-3xl gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/20 p-1.5 shadow-lg backdrop-blur-2xl">
                    <Image src="/only_logo.png" alt="AI" width={28} height={28} />
                  </div>
                  <div className="rounded-3xl rounded-tl-none border border-white/10 bg-white/40 p-6 leading-relaxed text-on-surface shadow-sm backdrop-blur-2xl">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => (
                          <p className="mb-2 font-light leading-relaxed last:mb-0">{children}</p>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-semibold text-on-surface">{children}</strong>
                        ),
                        ul: ({ children }) => (
                          <ul className="mt-3 list-disc space-y-2 pl-5 font-light text-on-surface-variant">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="mt-3 list-decimal space-y-2 pl-5 font-light text-on-surface-variant">
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => <li>{children}</li>,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              )
            )}

            {isLoading && !hasStartedStreaming && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="relative z-10 mx-auto w-full max-w-4xl shrink-0 space-y-6 px-12 pb-8">
          {conversationMessages.length === 0 && (
            <div className="flex flex-wrap justify-center gap-3">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSend(prompt)}
                  disabled={isLoading}
                  className="rounded-full border border-white/10 bg-white/20 px-5 py-2.5 text-xs font-semibold text-on-surface-variant backdrop-blur-2xl transition-all hover:scale-105 hover:bg-white/40 disabled:opacity-40"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          <div className="group relative">
            <div className="absolute inset-0 rounded-full bg-primary/5 opacity-0 blur-2xl transition-opacity group-focus-within:opacity-100" />
            <div className="relative flex items-end gap-2 rounded-full border border-white/10 bg-white/30 p-2 pl-8 shadow-2xl backdrop-blur-2xl">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pregunta a ContentSpark lo que necesites..."
                disabled={isLoading}
                className="max-h-40 flex-1 resize-none overflow-hidden border-none bg-transparent py-3 font-light leading-relaxed text-on-surface placeholder:text-on-surface-variant/50 focus:ring-0 focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                aria-label="Adjuntar archivo"
                className="flex h-10 w-10 shrink-0 items-center justify-center text-on-surface-variant transition-colors hover:text-primary"
              >
                <Paperclip size={20} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                aria-label="Enviar mensaje"
                className="liquid-gradient flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-lg shadow-primary/30 transition-transform hover:scale-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
              >
                {isLoading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <Send size={18} strokeWidth={2} />
                )}
              </button>
            </div>
          </div>

          <p className="text-center text-[10px] uppercase tracking-widest text-on-surface-variant/50">
            Powered by ContentSpark AI
          </p>
        </div>
      </section>

      <SourcesModal
        isOpen={isSourcesOpen}
        isLoading={isSourcesLoading}
        sources={sources}
        error={sourcesError}
        onClose={() => setIsSourcesOpen(false)}
      />
    </div>
  );
}
