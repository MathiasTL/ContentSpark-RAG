export const NICHES = [
  'tecnologia',
  'fitness',
  'finanzas',
  'educacion',
  'lifestyle',
  'negocios',
] as const;

export const PLATFORMS = [
  'tiktok',
  'instagram',
  'youtube',
  'linkedin',
  'x',
] as const;

export const FORMATS = [
  'short_video',
  'carousel',
  'story',
  'long_video',
  'post',
] as const;

// Etiquetas semanticas usadas por el backend (calendar_agent.TIME_SLOTS) —
// NUNCA horas de reloj. `TIME_SLOT_HOURS` mapea cada etiqueta a una hora
// representativa, usada solo para ordenar/filtrar en el frontend (nunca se
// debe parsear la etiqueta en si como una hora, ver TimelineCards).
export const TIME_SLOTS = ['morning', 'afternoon', 'evening'] as const;

export const TIME_SLOT_HOURS: Record<(typeof TIME_SLOTS)[number], string> = {
  morning: '09:00',
  afternoon: '14:00',
  evening: '19:00',
};

export const TIME_SLOT_LABELS: Record<(typeof TIME_SLOTS)[number], string> = {
  morning: 'Mañana',
  afternoon: 'Tarde',
  evening: 'Noche',
};

// Zonas horarias curadas para el <select> de perfil (design.md §7.2):
// Latinoamérica, España y las principales zonas de EE.UU./UE donde
// plausiblemente operan los creadores de este producto. No es la lista
// completa de ~600 identificadores IANA — un texto libre sobre esa lista
// completa es un generador de 422. La zona detectada por el navegador se
// antepone en tiempo de render si no está aquí (ProfileForm.tsx), para que
// esta lista curada nunca fuerce a un creador fuera de su zona real.
export const TIMEZONES = [
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/Montevideo',
  'America/Caracas',
  'America/La_Paz',
  'America/Asuncion',
  'America/Guatemala',
  'America/San_Salvador',
  'America/Tegucigalpa',
  'America/Managua',
  'America/Costa_Rica',
  'America/Panama',
  'America/Santo_Domingo',
  'Europe/Madrid',
  'Atlantic/Canary',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Lisbon',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
] as const;

export const FREQUENCY_RECOMMENDATIONS: Record<string, number> = {
  tecnologia: 5,
  fitness: 6,
  finanzas: 4,
  educacion: 3,
  lifestyle: 6,
  negocios: 4,
};
