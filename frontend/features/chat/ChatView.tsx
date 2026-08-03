"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { AnimatePresence, motion } from "framer-motion";
import { Paperclip, Send, UserCircle2 } from "lucide-react";

import { getSourcesFromBackend } from "@/shared/lib/api-client";
import type { Source } from "@/shared/lib/api-client";
import { useChatSessionsStore } from "./store/chatSessionsStore";
import {
  useChatSession,
  useIsPendingNewChat,
} from "./hooks/useChatSession";
import ChatHeader from "./components/ChatHeader";
import SourcesModal from "./components/SourcesModal";
import { ScrollArea } from "@/shared/components/ui/scroll-area";

interface ChatViewProps {
  chatId?: string;
}

const SUGGESTED_PROMPTS = [
  "Dame hooks virales",
  "Estrategia de contenido para esta semana",
  "Ideas de contenido trending",
];

// Referencia estable: si se define inline en cada render, ReactMarkdown
// re-diffea todos los mensajes ya renderizados en cada token de streaming.
const MARKDOWN_COMPONENTS: Components = {
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
};

function WelcomeMessage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/20 bg-surface-container-lowest/30 p-3 shadow-lg backdrop-blur-2xl">
        <Image src="/only_logo.png" alt="ContentSpark" width={52} height={52} priority />
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
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-surface-container-lowest/20 p-1.5 shadow-lg backdrop-blur-2xl">
        <Image src="/only_logo.png" alt="AI" width={28} height={28} />
      </div>
      <div className="rounded-3xl rounded-tl-none border border-white/10 bg-surface-container-lowest/40 px-6 py-4 backdrop-blur-2xl">
        <span className="flex h-5 items-center gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-on-surface-variant [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-on-surface-variant [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-on-surface-variant" />
        </span>
      </div>
    </div>
  );
}

export default function ChatView({ chatId }: ChatViewProps) {
  const router = useRouter();
  const setActiveChat = useChatSessionsStore((s) => s.setActiveChat);
  const loadChat = useChatSessionsStore((s) => s.loadChat);
  const sendMessage = useChatSessionsStore((s) => s.sendMessage);
  const session = useChatSession(chatId);
  const pendingNewChat = useIsPendingNewChat();

  const [input, setInput] = useState("");
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [isSourcesLoading, setIsSourcesLoading] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const messages = session?.messages ?? [];
  const isLoading = session?.isLoading ?? false;
  const isStreaming = session?.isStreaming ?? false;
  const hasStartedStreaming = session?.hasStartedStreaming ?? false;
  const error = session?.error ?? null;

  useEffect(() => {
    setActiveChat(chatId ?? null);
  }, [chatId, setActiveChat]);

  useEffect(() => {
    if (!chatId) return;
    if (session) return;
    void loadChat(chatId).catch((err) => {
      if (err?.status === 404) {
        router.replace("/chat");
      }
    });
  }, [chatId, session, loadChat, router]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [session?.messages, isStreaming]);

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

    const pdfSources = result.sources.filter((s) => {
      const type = s.type.toLowerCase();
      const title = s.title.toLowerCase();
      return type.includes("pdf") || title.endsWith(".pdf");
    });
    setSources(pdfSources);
    setIsSourcesLoading(false);
  }

  async function handleSend(text: string) {
    if (!text || isStreaming || pendingNewChat) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const { chatId: resultChatId } = await sendMessage(chatId ?? null, text);
      if (!chatId) {
        router.replace(`/chat/${resultChatId}`);
      }
    } catch (err) {
      console.error("[ChatView] sendMessage falló:", err);
    }
  }

  function sendCurrentInput() {
    handleSend(input.trim());
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendCurrentInput();
    }
  }

  const showWelcome = messages.length === 0 && !isLoading && !pendingNewChat;

  return (
    <div className="flex h-dvh w-full">
      <section className="relative flex h-dvh min-w-0 flex-1 flex-col overflow-hidden bg-surface/60 backdrop-blur-sm">
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/10 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-secondary/10 blur-[120px]" />

        <ChatHeader onOpenSources={openSourcesModal} />

        <ScrollArea className="relative z-10 min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]>div]:!flex [&_[data-radix-scroll-area-viewport]>div]:!min-h-full [&_[data-radix-scroll-area-viewport]>div]:!flex-col">
          <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col space-y-8 px-12 pt-20 pb-6">
            {isLoading && (
              <div className="space-y-6">
                {[0, 1].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-3xl bg-surface-container-lowest/10" />
                ))}
              </div>
            )}

            <AnimatePresence mode="popLayout">
              {showWelcome && (
                <motion.div
                  key="welcome"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -40 }}
                  transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
                  className="flex flex-1 items-center justify-center"
                >
                  <WelcomeMessage />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {messages.map((msg, i) =>
                msg.role === "user" ? (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.08, ease: [0.4, 0, 0.2, 1] }}
                    className="ml-auto flex max-w-3xl flex-row-reverse gap-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-primary-container shadow-lg">
                      <UserCircle2 className="h-7 w-7 text-white/80" strokeWidth={1.25} />
                    </div>
                    <div className="liquid-gradient rounded-3xl rounded-tr-none border border-white/10 p-6 leading-relaxed text-white shadow-xl shadow-primary/10 backdrop-blur-2xl">
                      <p className="font-light">{msg.content}</p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                    className="flex max-w-3xl gap-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-surface-container-lowest/20 p-1.5 shadow-lg backdrop-blur-2xl">
                      <Image src="/only_logo.png" alt="AI" width={28} height={28} />
                    </div>
                    <div className="rounded-3xl rounded-tl-none border border-white/10 bg-surface-container-lowest/40 p-6 leading-relaxed text-on-surface shadow-sm backdrop-blur-2xl">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </motion.div>
                ),
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isStreaming && !hasStartedStreaming && (
                <motion.div
                  key="typing"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                >
                  <TypingIndicator />
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="relative z-10 mx-auto w-full max-w-4xl shrink-0 space-y-6 px-12 pb-24 lg:pb-8">
          {error && (
            <div className="rounded-2xl border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <AnimatePresence>
            {messages.length === 0 && !pendingNewChat && (
              <motion.div
                key="suggested-prompts"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                className="flex flex-wrap justify-center gap-3"
              >
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleSend(prompt)}
                    disabled={isStreaming || pendingNewChat}
                    className="rounded-full border border-white/10 bg-surface-container-lowest/20 px-5 py-2.5 text-xs font-semibold text-on-surface-variant backdrop-blur-2xl transition-all hover:scale-105 hover:bg-surface-container-lowest/40 disabled:opacity-40"
                  >
                    {prompt}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="group relative">
            <div className="absolute inset-0 rounded-full bg-primary/5 opacity-0 blur-2xl transition-opacity group-focus-within:opacity-100" />
            <div className="relative flex items-end gap-2 rounded-full border border-white/10 bg-surface-container-lowest/30 p-2 pl-8 shadow-2xl backdrop-blur-2xl">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pregunta a ContentSpark lo que necesites..."
                disabled={isStreaming || pendingNewChat}
                className="max-h-40 flex-1 resize-none overflow-hidden border-none bg-transparent py-3 font-light leading-relaxed text-on-surface placeholder:text-on-surface-variant/50 focus:ring-0 focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                disabled
                title="Próximamente"
                aria-label="Adjuntar archivo"
                className="flex h-10 w-10 shrink-0 items-center justify-center text-on-surface-variant transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-on-surface-variant"
              >
                <Paperclip size={20} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={sendCurrentInput}
                disabled={isStreaming || pendingNewChat || !input.trim()}
                aria-label="Enviar mensaje"
                className="liquid-gradient flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-lg shadow-primary/30 transition-transform hover:scale-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
              >
                {isStreaming || pendingNewChat ? (
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
