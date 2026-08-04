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

export const FREQUENCY_RECOMMENDATIONS: Record<string, number> = {
  tecnologia: 5,
  fitness: 6,
  finanzas: 4,
  educacion: 3,
  lifestyle: 6,
  negocios: 4,
};
