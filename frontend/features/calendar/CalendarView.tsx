"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import Button from "@/shared/components/ui/Button";
import TopBar from "./components/TopBar";
import GenerateControl from "./components/GenerateControl";
import TimelineCards from "./components/TimelineCards";
import CalendarGrid from "./components/CalendarGrid";
import ConfirmBar from "./components/ConfirmBar";
import CalendarEmptyState from "./components/CalendarEmptyState";
import GoogleSyncButton from "./components/GoogleSyncButton";
import CreatorTip from "./components/CreatorTip";
import EntryEditModal from "./components/EntryEditModal";
import { useCalendarStore } from "./store/calendarStore";

export default function CalendarView() {
  const calendars = useCalendarStore((s) => s.calendars);
  const currentCalendar = useCalendarStore((s) => s.currentCalendar);
  const errorStatus = useCalendarStore((s) => s.errorStatus);
  const isLoading = useCalendarStore((s) => s.isLoading);
  const loadCalendars = useCalendarStore((s) => s.loadCalendars);
  const loadCalendar = useCalendarStore((s) => s.loadCalendar);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [lastCalendarId, setLastCalendarId] = useState<string | null>(null);

  useEffect(() => {
    void loadCalendars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El store no hidrata currentCalendar solo con loadCalendars() (esa llamada
  // trae la lista liviana, sin entries). Sin este efecto, currentCalendar
  // queda en null en cada carga fresca de pagina pese a que ya existe un
  // calendario guardado — ConfirmBar se auto-oculta (if (!currentCalendar)
  // return null) y Timeline/Grid quedan vacios, lo que se percibe como
  // "no funciona nada" pese a que el backend tiene datos. Trae el mas
  // reciente (calendars[0], el backend ordena por created_at desc).
  useEffect(() => {
    if (!currentCalendar && calendars.length > 0) {
      void loadCalendar(calendars[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendars, currentCalendar]);

  // Colapsa el form de generacion cada vez que aparece un calendario nuevo
  // (carga inicial o una generacion exitosa desde el toggle "Generar otro").
  // Ajuste de estado durante el render (no en un efecto): react.dev
  // "Resetting state when a prop changes" — evita el render en cascada que
  // dispara la regla set-state-in-effect.
  if (currentCalendar && currentCalendar.id !== lastCalendarId) {
    setLastCalendarId(currentCalendar.id);
    setShowGenerateForm(false);
  }

  const editingEntry = currentCalendar?.entries.find((e) => e.id === editingEntryId) ?? null;

  // Soft gate (content-calendar-ui / Empty State with Onboarding CTA):
  // sin un calendario activo y sin calendarios en la lista, o el ultimo
  // generate() rechazado por perfil incompleto (409, via el status
  // tipado de ApiError — nunca un match de substring sobre el mensaje),
  // reemplazan timeline/grid por el CTA a /onboarding en lugar de un
  // timeline/grid vacio o roto. currentCalendar manda: si ya hay uno
  // cargado (por ejemplo via generate()/loadCalendar()), se muestra
  // aunque la lista de calendars aun no se haya recargado.
  const showEmptyState =
    !currentCalendar && (calendars.length === 0 || errorStatus === 409);
  const isHydratingCalendar = !currentCalendar && calendars.length > 0 && isLoading;

  return (
    <div className="min-h-screen">
      <div>
        <TopBar />

        <div className="grid grid-cols-12 gap-6 p-5 pb-24 sm:gap-8 sm:p-8 sm:pb-24 lg:p-10 lg:pb-10">
          {/* Columna central */}
          <div className="col-span-12 space-y-8 sm:space-y-10 lg:col-span-9">
            {showEmptyState ? (
              <>
                <GenerateControl />
                <CalendarEmptyState />
              </>
            ) : isHydratingCalendar ? (
              <div className="space-y-4" role="status" aria-label="Cargando calendario">
                <div className="h-20 animate-pulse rounded-3xl bg-surface-container-lowest/10" />
                <div className="h-64 animate-pulse rounded-3xl bg-surface-container-lowest/10" />
                <div className="h-96 animate-pulse rounded-3xl bg-surface-container-lowest/10" />
              </div>
            ) : (
              <>
                <ConfirmBar />
                {showGenerateForm ? (
                  <GenerateControl />
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowGenerateForm(true)}
                    className="!w-auto inline-flex items-center justify-center gap-2 !py-2.5 px-4"
                  >
                    <RefreshCw aria-hidden="true" size={16} strokeWidth={1.5} />
                    Generar otro calendario
                  </Button>
                )}
                <TimelineCards onEditEntry={setEditingEntryId} />
                <CalendarGrid onEditEntry={setEditingEntryId} />
              </>
            )}
          </div>

          {/* Sidebar derecho */}
          <aside className="col-span-12 space-y-6 sm:space-y-8 lg:col-span-3">
            <GoogleSyncButton />
            <CreatorTip />
          </aside>
        </div>
      </div>

      {editingEntry ? (
        <EntryEditModal entry={editingEntry} onClose={() => setEditingEntryId(null)} />
      ) : null}
    </div>
  );
}
