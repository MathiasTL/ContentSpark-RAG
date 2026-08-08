// Fetch de estado de completitud del perfil, ejecutado del lado del
// servidor (proxy.ts). NO reutiliza apiFetch (shared/lib/api-fetch.ts)
// porque ese cliente lee la sesión del navegador (window) — aquí el
// token ya lo tenemos resuelto desde las cookies via el middleware.
//
// Regla de completitud (design D2): esta función NUNCA lanza. Cualquier
// falla (status != 200, red, timeout) se degrada a `null`, que el
// proxy interpreta como "no redirigir por onboarding" (fail-open).
const STATUS_FETCH_TIMEOUT_MS = 3000;

// Resolución de URL del backend, en orden de precedencia:
//   1. BACKEND_INTERNAL_URL — solo servidor. Dentro de compose apunta a
//      la red interna (http://backend:8000). Ausente en dev host-native.
//   2. NEXT_PUBLIC_API_URL  — lo que resuelve el navegador. Sirve de
//      default para que `pnpm dev` en el host no cambie de comportamiento.
//   3. http://localhost:8000 — último recurso.
export function resolveBackendUrl(): string {
  return (
    process.env.BACKEND_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8000"
  );
}

export async function fetchProfileStatus(
  accessToken: string,
): Promise<boolean | null> {
  try {
    const response = await fetch(`${resolveBackendUrl()}/api/profile/status`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(STATUS_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { is_complete?: unknown };
    return typeof data.is_complete === "boolean" ? data.is_complete : null;
  } catch {
    return null;
  }
}
