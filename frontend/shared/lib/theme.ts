/**
 * Lógica de tema claro/oscuro.
 *
 * Estrategia (fijada en DESIGN.md): clase `.dark` sobre <html>, con la
 * preferencia del sistema como valor inicial y una elección manual que
 * persiste. El CSS solo conoce la clase; quién la pone es este módulo.
 */

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "contentspark-theme";

/** Media query que representa la preferencia del sistema operativo. */
export const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;

/**
 * Acceso seguro a localStorage. Leer la propiedad ya puede lanzar cuando el
 * navegador tiene el almacenamiento bloqueado, así que no alcanza con
 * proteger getItem/setItem.
 */
export function getLocalStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * Lee la preferencia persistida. Cualquier valor ausente, corrupto o un
 * storage inaccesible (modo privado, cookies bloqueadas) cae en "system".
 */
export function readStoredPreference(
  storage: ReadableStorage | null | undefined,
): ThemePreference {
  if (!storage) return "system";
  try {
    const stored = storage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

/** Persiste la preferencia. Falla en silencio si el storage no está disponible. */
export function persistPreference(
  storage: WritableStorage | null | undefined,
  preference: ThemePreference,
): void {
  if (!storage) return;
  try {
    storage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage inaccesible: la sesión actual sigue funcionando sin persistencia.
  }
}

/** Traduce preferencia + estado del sistema al tema efectivo. */
export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

/**
 * Aplica el tema al documento: la clase que lee Tailwind y `color-scheme`,
 * que es lo que le dice al navegador cómo pintar scrollbars y controles nativos.
 */
export function applyResolvedTheme(
  root: HTMLElement,
  resolved: ResolvedTheme,
): void {
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

/**
 * Script bloqueante que corre antes del primer pintado para evitar el
 * parpadeo de tema. Se mantiene acá, junto a la lógica que replica, para que
 * la clave de storage y las reglas no puedan divergir.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(
  THEME_STORAGE_KEY,
)};var p=localStorage.getItem(k);if(p!=="light"&&p!=="dark"){p="system";}var d=p==="dark"||(p==="system"&&window.matchMedia(${JSON.stringify(
  DARK_MEDIA_QUERY,
)}).matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;
