"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import type { Source } from "@/lib/api";

interface SourcesModalProps {
  isOpen: boolean;
  isLoading: boolean;
  sources: Source[];
  error: string | null;
  onClose: () => void;
}

export default function SourcesModal({
  isOpen,
  isLoading,
  sources,
  error,
  onClose,
}: SourcesModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-white/30 bg-white/35 shadow-2xl backdrop-blur-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/30 bg-white/20 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Fuentes Ingestadas</h2>
            <p className="text-xs text-gray-600">PDFs usados para alimentar el RAG</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/40 bg-white/45 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-white/65 cursor-pointer"
          >
            Cerrar
          </button>
        </div>

        <ScrollArea className="h-[380px]">
          <div className="p-5 space-y-3">
            {isLoading && (
              <div className="rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm text-gray-700">
                Cargando fuentes...
              </div>
            )}

            {!isLoading && error && (
              <div className="rounded-2xl border border-rose-200/70 bg-rose-50/70 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            {!isLoading && !error && sources.length === 0 && (
              <div className="rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm text-gray-700">
                No hay PDFs ingestados por ahora.
              </div>
            )}

            {!isLoading && !error &&
              sources.map((source) => (
                <div
                  key={source.id}
                  className="rounded-2xl border border-white/40 bg-white/35 px-4 py-3 flex items-center justify-between"
                >
                  <p className="text-sm font-semibold text-gray-800">{source.title}</p>
                  <span className="rounded-full bg-rose-100/80 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
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
