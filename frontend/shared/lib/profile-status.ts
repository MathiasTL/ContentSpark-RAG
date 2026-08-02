// Fetch de estado de completitud del perfil, ejecutado del lado del
// servidor (proxy.ts). NO reutiliza apiFetch (shared/lib/api-fetch.ts)
// porque ese cliente lee la sesión del navegador (window) — aquí el
// token ya lo tenemos resuelto desde las cookies via el middleware.
//
// Regla de completitud (design D2): esta función NUNCA lanza. Cualquier
// falla (status != 200, red, timeout) se degrada a `null`, que el
// proxy interpreta como "no redirigir por onboarding" (fail-open).
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const STATUS_FETCH_TIMEOUT_MS = 3000;

export async function fetchProfileStatus(
  accessToken: string,
): Promise<boolean | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/profile/status`, {
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
