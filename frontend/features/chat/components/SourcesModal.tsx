"use client";

import { useEffect, useRef } from "react";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Fuentes ingestadas"
        className="w-full max-w-2xl rounded-3xl border border-white/30 bg-surface-container-lowest/35 shadow-2xl backdrop-blur-xl overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-white/30 bg-surface-container-lowest/20 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-on-surface">Fuentes Ingestadas</h2>
            <p className="text-xs text-on-surface-variant">PDFs usados para alimentar el RAG</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/40 bg-surface-container-lowest/45 px-3 py-1.5 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-lowest/65 cursor-pointer"
          >
            Cerrar
          </button>
        </div>

        <ScrollArea className="h-[380px]">
          <div className="p-5 space-y-3">
            {isLoading && (
              <div className="rounded-2xl border border-white/40 bg-surface-container-lowest/30 px-4 py-3 text-sm text-on-surface-variant">
                Cargando fuentes...
              </div>
            )}

            {!isLoading && error && <Alert tone="danger">{error}</Alert>}

            {!isLoading && !error && sources.length === 0 && (
              <div className="rounded-2xl border border-white/40 bg-surface-container-lowest/30 px-4 py-3 text-sm text-on-surface-variant">
                No hay PDFs ingestados por ahora.
              </div>
            )}

            {!isLoading && !error &&
              sources.map((source) => (
                <div
                  key={source.id}
                  className="rounded-2xl border border-white/40 bg-surface-container-lowest/35 px-4 py-3 flex items-center justify-between"
                >
                  <p className="text-sm font-semibold text-on-surface">{source.title}</p>
                  <span className="rounded-full bg-danger-container px-2.5 py-0.5 text-xs font-semibold text-danger">
                    PDF
                  </span>
                </div>
              ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
