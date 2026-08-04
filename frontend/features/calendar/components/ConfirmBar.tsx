"use client";

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

  if (!currentCalendar) return null;

  const { status, id } = currentCalendar;
  const isDraft = status === "draft";
  const isSynced = status === "synced";

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur-xl sm:rounded-[3rem] sm:p-6">
      <span className="rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary-container">
        {STATUS_LABELS[status] ?? status}
      </span>

      {error && (
        <p role="alert" className="w-full text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={!isDraft}
          className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.01] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Confirmar calendario
        </button>
        <button
          type="button"
          onClick={() => void remove(id)}
          disabled={isSynced}
          title={isSynced ? "No se puede eliminar un calendario sincronizado" : undefined}
          className="rounded-2xl border border-white/40 bg-surface-container-lowest/20 px-5 py-2.5 text-sm font-medium text-on-surface transition-all hover:bg-surface-container-lowest/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Eliminar calendario
        </button>
      </div>
    </section>
  );
}
