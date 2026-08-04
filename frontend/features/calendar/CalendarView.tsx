"use client";

import { useEffect, useState } from "react";
import TopBar from "./components/TopBar";
import GenerateControl from "./components/GenerateControl";
import TimelineCards from "./components/TimelineCards";
import CalendarGrid from "./components/CalendarGrid";
import ConfirmBar from "./components/ConfirmBar";
import CalendarEmptyState from "./components/CalendarEmptyState";
import GoogleSyncButton from "./components/GoogleSyncButton";
import PerformancePanel from "./components/PerformancePanel";
import ActivityPanel from "./components/ActivityPanel";
import CreatorTip from "./components/CreatorTip";
import EntryEditModal from "./components/EntryEditModal";
import { useCalendarStore } from "./store/calendarStore";

export default function CalendarView() {
  const calendars = useCalendarStore((s) => s.calendars);
  const currentCalendar = useCalendarStore((s) => s.currentCalendar);
  const errorStatus = useCalendarStore((s) => s.errorStatus);
  const loadCalendars = useCalendarStore((s) => s.loadCalendars);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  useEffect(() => {
    void loadCalendars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <div className="min-h-screen">
      <div>
        <TopBar />

        <div className="grid grid-cols-12 gap-6 p-5 pb-24 sm:gap-8 sm:p-8 sm:pb-24 lg:p-10 lg:pb-10">
          {/* Columna central */}
          <div className="col-span-12 space-y-8 sm:space-y-10 lg:col-span-9">
            <GenerateControl />
            {showEmptyState ? (
              <CalendarEmptyState />
            ) : (
              <>
                <ConfirmBar />
                <TimelineCards onEditEntry={setEditingEntryId} />
                <CalendarGrid onEditEntry={setEditingEntryId} />
              </>
            )}
          </div>

          {/* Sidebar derecho */}
          <aside className="col-span-12 space-y-6 sm:space-y-8 lg:col-span-3">
            <GoogleSyncButton />
            <PerformancePanel />
            <ActivityPanel />
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
