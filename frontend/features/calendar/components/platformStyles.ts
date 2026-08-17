/**
 * Identidad de plataforma compartida entre CalendarGrid y TimelineCards.
 *
 * El sistema de diseño reserva el único acento (`primary`) para lo accionable
 * y activo, y el contra-acento (`secondary`) para diferenciar como mucho dos
 * series de datos a la vez (DESIGN.md, "Magenta Señal" — el ejemplo textual
 * es el panel de rendimiento del calendario). Cinco plataformas no caben en
 * esa paleta sin inventar un tono por red social, y eso es exactamente lo
 * que el sistema prohíbe ("el violeta primario es escaso y deliberado").
 *
 * Por eso la identidad de plataforma se comunica solo por texto (la
 * etiqueta), nunca por color: un único tratamiento visual neutro para todas
 * las plataformas, con el acento primario reservado para marcar lo
 * accionable (el chip es clickeable → editable).
 */
export const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X",
  linkedin: "LinkedIn",
};

export function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? "Contenido";
}
