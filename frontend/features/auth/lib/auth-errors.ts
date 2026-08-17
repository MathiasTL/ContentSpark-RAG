/**
 * Traducción de los errores de Supabase Auth.
 *
 * Supabase devuelve texto en inglés pensado para desarrolladores. Mostrarlo
 * crudo rompe el idioma del producto en el peor momento — cuando el usuario
 * ya falló algo. Además decide A QUÉ CAMPO pertenece cada error: uno de
 * credenciales pertenece al campo, no a un banner suelto arriba del formulario.
 */

export type FieldError = {
  /** null = el error es del formulario completo. */
  field: string | null;
  text: string;
};

export type ErrorRule = [test: RegExp, result: FieldError];

/** Errores de infraestructura: valen igual en cualquier flujo de auth. */
const COMMON_RULES: ErrorRule[] = [
  [
    /too many requests|rate limit/,
    {
      field: null,
      text: "Demasiados intentos seguidos. Esperá un minuto y volvé a probar.",
    },
  ],
  [
    /network|fetch|failed to fetch/,
    {
      field: null,
      text: "No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.",
    },
  ],
];

/**
 * Aplica primero las reglas del flujo y después las comunes, para que un
 * flujo pueda dar un mensaje más específico que el genérico.
 */
export function mapAuthError(
  message: string,
  flowRules: ErrorRule[],
  fallback: string,
): FieldError {
  const normalized = message.toLowerCase();

  for (const [test, result] of [...flowRules, ...COMMON_RULES]) {
    if (test.test(normalized)) return result;
  }

  return { field: null, text: fallback };
}
