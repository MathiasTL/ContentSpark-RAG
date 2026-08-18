// Deriva la superficie visible de personalizacion del chat a partir del perfil
// del creador.
//
// POR QUE EXISTE: PRODUCT.md establece que el perfil es "la fuente de verdad
// que personaliza todo; ninguna feature debe ignorarlo", pero hasta ahora el
// chat no mostraba ni un rastro de el: la bienvenida era copy de marketing
// generico y los prompts sugeridos eran tres strings fijos. La personalizacion
// existia solo en el backend, sin prueba en la interfaz.
//
// REGLA DE HONESTIDAD: no inventamos personalizacion. Si el perfil no esta
// cargado o no tiene nicho, se devuelven los prompts genericos y el resumen es
// null — nunca un placeholder que insinue que sabemos algo del creador que no
// sabemos. Es la misma regla que ya se aplico al calendario cuando se sacaron
// las metricas inventadas (ledger de DESIGN.md, punto 17).

import type { Profile } from "@/features/profile";
import { NICHE_LABELS, FORMAT_LABELS, PLATFORM_LABELS } from "@/shared/constants/labels";

export const GENERIC_PROMPTS = [
  "Dame hooks virales",
  "Estrategia de contenido para esta semana",
  "Ideas de contenido trending",
];

// Los valores llegan del backend como texto libre: un perfil viejo puede traer
// un nicho o formato que ya no esta en la lista curada. Siempre caemos al valor
// crudo antes que mostrar undefined.
function label(map: Record<string, string>, value: string | null | undefined): string | null {
  if (!value) return null;
  return map[value] ?? value;
}

/**
 * Resumen corto de la personalizacion activa, para mostrar en el header.
 * Devuelve null cuando no hay suficiente perfil como para afirmar nada.
 */
export function buildPersonalizationSummary(profile: Profile | null): string | null {
  if (!profile) return null;

  const parts = [
    label(NICHE_LABELS, profile.niche),
    label(PLATFORM_LABELS, profile.social_accounts?.[0]?.platform),
    label(FORMAT_LABELS, profile.preferred_formats?.[0]),
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Prompts sugeridos derivados del perfil. Sin nicho no hay nada especifico que
 * proponer, asi que se devuelven los genericos en vez de rellenar con humo.
 */
export function buildSuggestedPrompts(profile: Profile | null): string[] {
  const niche = label(NICHE_LABELS, profile?.niche);
  if (!niche) return GENERIC_PROMPTS;

  const nicheText = (label(NICHE_LABELS, profile?.sub_niche) ?? niche).toLowerCase();
  const format = label(FORMAT_LABELS, profile?.preferred_formats?.[0]);
  const platform = label(PLATFORM_LABELS, profile?.social_accounts?.[0]?.platform);

  return [
    format
      ? `Dame hooks de ${nicheText} para ${format.toLowerCase()}`
      : `Dame hooks de ${nicheText}`,
    platform
      ? `Estrategia de esta semana en ${platform}`
      : "Estrategia de contenido para esta semana",
    profile?.primary_goal
      ? `Ideas de ${nicheText} para ${profile.primary_goal.toLowerCase()}`
      : `Qué está funcionando ahora en ${nicheText}`,
  ];
}
