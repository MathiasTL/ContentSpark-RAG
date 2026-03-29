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

export const FREQUENCY_RECOMMENDATIONS: Record<string, number> = {
  tecnologia: 5,
  fitness: 6,
  finanzas: 4,
  educacion: 3,
  lifestyle: 6,
  negocios: 4,
};
