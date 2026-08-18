"use client";

import { useEffect, useRef } from "react";
import { FileText, Globe } from "lucide-react";

import { ScrollArea } from "@/shared/components/ui/scroll-area";
import Alert from "@/shared/components/ui/Alert";
import type { Source } from "@/shared/lib/api-client";

interface SourcesModalProps {
  isOpen: boolean;
  isLoading: boolean;
  sources: Source[];
  error: string | null;
  onClose: () => void;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export default function SourcesModal({
  isOpen,
  isLoading,
  sources,
  error,
  onClose,
}: SourcesModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    triggerRef.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    firstFocusable?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      triggerRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Fuentes ingestadas"
        className="w-full max-w-2xl rounded-3xl border border-glass-edge bg-surface-container-lowest/35 shadow-2xl backdrop-blur-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-glass-edge-soft bg-surface-container-lowest/20 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-on-surface">Tu base de conocimiento</h2>
            <p className="text-xs text-on-surface-variant">
              Documentos y páginas que alimentan tus respuestas
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-glass-edge bg-surface-container-lowest/45 px-3 py-1.5 text-xs font-medium text-on-surface transition-colors duration-150 hover:bg-surface-container-lowest/65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary cursor-pointer"
          >
            Cerrar
          </button>
        </div>

        <ScrollArea className="h-[380px]">
          <div className="p-5 space-y-3">
            {isLoading && (
              <div className="rounded-2xl border border-glass-edge bg-surface-container-lowest/30 px-4 py-3 text-sm text-on-surface-variant">
                Cargando fuentes...
              </div>
            )}

            {!isLoading && error && <Alert tone="danger">{error}</Alert>}

            {!isLoading && !error && sources.length === 0 && (
              <div className="rounded-2xl border border-glass-edge bg-surface-container-lowest/30 px-4 py-3 text-sm text-on-surface-variant">
                Todavía no hay fuentes en tu base de conocimiento.
              </div>
            )}

            {!isLoading && !error &&
              sources.map((source) => {
                const isWeb = source.type.toLowerCase().includes("web");
                // "Vectorizado" = ya esta en Qdrant y el RAG puede encontrarlo.
                // "Disponible" = el archivo existe en data/ pero todavia no se
                // ingesto, asi que NO responde preguntas. La distincion importa:
                // sin ella el creador cuenta como base lo que todavia no lo es.
                const isIndexed = source.status.toLowerCase().includes("vectorizado");

                return (
                  <div
                    key={source.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-glass-edge bg-surface-container-lowest/35 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {isWeb ? (
                        <Globe
                          size={16}
                          strokeWidth={1.5}
                          className="shrink-0 text-on-surface-variant"
                          aria-hidden="true"
                        />
                      ) : (
                        <FileText
                          size={16}
                          strokeWidth={1.5}
                          className="shrink-0 text-on-surface-variant"
                          aria-hidden="true"
                        />
                      )}
                      <p className="truncate text-sm font-medium text-on-surface" title={source.title}>
                        {source.title}
                      </p>
                    </div>

                    <span
                      className="shrink-0 text-[0.75rem] font-medium uppercase tracking-[0.1em] text-on-surface-variant"
                      title={
                        isIndexed
                          ? "Indexado: el asistente puede consultarlo"
                          : "Todavía no indexado: el asistente aún no puede consultarlo"
                      }
                    >
                      {isWeb ? "Web" : "PDF"}
                      {!isIndexed && " · sin indexar"}
                    </span>
                  </div>
                );
              })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
