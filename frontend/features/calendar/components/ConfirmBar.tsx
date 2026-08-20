"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import Alert from "@/shared/components/ui/Alert";
import { useCalendarStore } from "../store/calendarStore";

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  confirmed: "Confirmado",
  synced: "Sincronizado",
};

export default function ConfirmBar() {
  const currentCalendar = useCalendarStore((s) => s.currentCalendar);
  const confirm = useCalendarStore((s) => s.confirm);
  const remove = useCalendarStore((s) => s.remove);
  const error = useCalendarStore((s) => s.error);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  if (!currentCalendar) return null;

  const { status, id } = currentCalendar;
  const isDraft = status === "draft";
  const isSynced = status === "synced";

  async function handleConfirm() {
    if (isConfirming) return;
    setIsConfirming(true);
    try {
      await confirm();
    } finally {
      setIsConfirming(false);
    }
  }

  async function handleDelete() {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await remove(id);
    } catch {
      setIsDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-glass-edge bg-surface-container-lowest/10 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest ${
          isDraft
            ? "bg-primary/10 text-primary-container"
            : "bg-success-container text-success"
        }`}
      >
        {!isDraft && <CheckCircle2 aria-hidden="true" size={14} strokeWidth={2} />}
        {STATUS_LABELS[status] ?? status}
      </span>

      {error && (
        <Alert tone="danger" className="w-full">
          {error}
        </Alert>
      )}

      <div className="flex gap-3">
        {isDraft ? (
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isConfirming}
            className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary shadow-lg transition-colors duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isConfirming ? "Confirmando…" : "Confirmar calendario"}
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-2xl border border-glass-edge bg-surface-container-lowest/20 px-5 py-2.5 text-sm font-medium text-on-surface-variant">
            <CheckCircle2 aria-hidden="true" size={16} strokeWidth={2} className="text-success" />
            Calendario confirmado
          </span>
        )}
        {confirmingDelete ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-on-surface-variant">¿Eliminar?</span>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
              className="rounded-2xl bg-danger-container px-4 py-2.5 font-semibold text-danger transition-all hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeleting ? "..." : "Sí"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={isDeleting}
              className="rounded-2xl border border-glass-edge bg-surface-container-lowest/20 px-4 py-2.5 font-medium text-on-surface transition-colors duration-150 hover:bg-surface-container-lowest/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              No
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            disabled={isSynced}
            title={isSynced ? "No se puede eliminar un calendario sincronizado" : undefined}
            className="rounded-2xl border border-glass-edge bg-surface-container-lowest/20 px-5 py-2.5 text-sm font-medium text-on-surface transition-colors duration-150 hover:bg-surface-container-lowest/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Eliminar calendario
          </button>
        )}
      </div>
    </section>
  );
}
