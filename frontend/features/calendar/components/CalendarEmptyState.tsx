"use client";

import Link from "next/link";
import { useCalendarStore } from "../store/calendarStore";

export default function CalendarEmptyState() {
  const calendars = useCalendarStore((s) => s.calendars);
  const errorStatus = useCalendarStore((s) => s.errorStatus);

  // Rechazo del soft gate (perfil incompleto) detectado via el status
  // tipado de ApiError, persistido por calendarStore como errorStatus —
  // nunca por un match de substring sobre el mensaje de error (fragil:
  // cualquier mensaje que mencione "409" incidentalmente dispararia un
  // falso positivo).
  const profileIncomplete = errorStatus === 409;
  const hasNoCalendars = calendars.length === 0;

  if (!hasNoCalendars && !profileIncomplete) return null;

  return (
    <section className="rounded-[2rem] border border-white/20 bg-white/10 p-8 text-center shadow-2xl backdrop-blur-xl sm:rounded-[3rem] sm:p-12">
      <h2 className="text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">
        {profileIncomplete
          ? "Completa tu perfil para generar tu calendario"
          : "Aún no tienes calendarios"}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm font-light text-on-surface-variant">
        {profileIncomplete
          ? "Necesitamos algunos datos de tu perfil de creador antes de poder generar contenido personalizado."
          : "Genera tu primer calendario de contenido con AI para empezar a planificar."}
      </p>
      <Link
        href="/onboarding"
        className="mt-6 inline-block rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.01] active:scale-95"
      >
        Completar perfil
      </Link>
    </section>
  );
}
