"use client";

import { Link2 } from "lucide-react";
import ChatSidebarToggle from "./ChatSidebarToggle";
import ChatMobileDrawerToggle from "./ChatMobileDrawerToggle";

interface ChatHeaderProps {
  onOpenSources: () => void;
  /**
   * Resumen del perfil que esta personalizando las respuestas (nicho ·
   * plataforma · formato). `null` cuando el perfil todavia no cargo o no tiene
   * nicho: en ese caso no se muestra nada, porque afirmar una personalizacion
   * que no podemos comprobar es exactamente el problema que este resumen vino
   * a resolver.
   */
  personalization?: string | null;
}

export default function ChatHeader({ onOpenSources, personalization }: ChatHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 w-full shrink-0 items-center justify-between gap-4 border-b border-glass-edge-soft bg-surface/60 px-8 backdrop-blur-md">
      <ChatSidebarToggle />
      <ChatMobileDrawerToggle />

      {personalization && (
        <p
          className="hidden min-w-0 flex-1 truncate text-[0.75rem] font-medium uppercase tracking-[0.1em] text-on-surface-variant sm:block"
          title={`Respuestas personalizadas para ${personalization}`}
        >
          {personalization}
        </p>
      )}

      <button
        type="button"
        onClick={onOpenSources}
        className="flex items-center gap-2 rounded-full border border-glass-edge bg-surface-container-lowest/20 px-4 py-2 text-sm font-light text-on-surface backdrop-blur-md transition-colors duration-150 hover:bg-surface-container-lowest/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Link2 size={16} strokeWidth={1.5} />
        Fuentes
      </button>
    </header>
  );
}
