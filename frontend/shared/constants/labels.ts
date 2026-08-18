// Etiquetas legibles para los valores de `shared/constants/index.ts`.
//
// Estos tres mapas estaban duplicados a mano en seis archivos (ProfileForm,
// Step1Niche, Step4Formats, GenerateControl, EntryEditModal, NicheMarquee,
// platformStyles). Cada copia era un punto donde una etiqueta podia derivar
// sin que nadie lo notara. Esta es la fuente unica; las copias restantes se
// migran a medida que se toca cada superficie (ver ledger de DESIGN.md).
//
// Se tipan como Record<string, string> a proposito: los valores llegan del
// backend como texto libre, y un perfil viejo puede traer un nicho que ya no
// esta en la lista curada. Por eso el consumidor SIEMPRE debe hacer fallback
// al valor crudo (`NICHE_LABELS[n] ?? n`) en vez de asumir la clave.

export const NICHE_LABELS: Record<string, string> = {
  tecnologia: "Tecnología",
  fitness: "Fitness",
  finanzas: "Finanzas",
  educacion: "Educación",
  lifestyle: "Lifestyle",
  negocios: "Negocios",
};

export const FORMAT_LABELS: Record<string, string> = {
  short_video: "Video corto",
  carousel: "Carrusel",
  story: "Historia",
  long_video: "Video largo",
  post: "Publicación",
};

export const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  x: "X",
};
