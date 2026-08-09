"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

import {
  applyResolvedTheme,
  DARK_MEDIA_QUERY,
  getLocalStorage,
  persistPreference,
  readStoredPreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "@/shared/lib/theme";

type UseThemeResult = {
  /** Lo que eligió el usuario: "light", "dark" o "system". */
  preference: ThemePreference;
  /** El tema efectivo que está pintado ahora mismo. */
  resolved: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
  /** false durante el render del servidor y la hidratación. */
  mounted: boolean;
};

// ── Store de la preferencia ──────────────────────────────────────────────
// localStorage es estado externo a React, así que se lee con
// useSyncExternalStore en vez de copiarlo a useState desde un efecto.

let listeners: Array<() => void> = [];

function emit() {
  for (const listener of listeners) listener();
}

function subscribePreference(onChange: () => void) {
  listeners.push(onChange);

  // Otra pestaña puede cambiar el tema: escuchamos el evento de storage.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    onChange();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners = listeners.filter((listener) => listener !== onChange);
    window.removeEventListener("storage", onStorage);
  };
}

// Sin caché a propósito: el snapshot es un string primitivo, así que leerlo
// de nuevo devuelve un valor idéntico y satisface la exigencia de estabilidad
// de useSyncExternalStore. Cachearlo solo serviría para quedar desincronizado
// con escrituras al storage que no pasen por setPreference.
function getPreferenceSnapshot(): ThemePreference {
  return readStoredPreference(getLocalStorage());
}

function getServerPreferenceSnapshot(): ThemePreference {
  return "system";
}

// ── Store de la preferencia del sistema operativo ────────────────────────

function subscribeSystem(onChange: () => void) {
  const media = window.matchMedia(DARK_MEDIA_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getSystemSnapshot(): boolean {
  return window.matchMedia(DARK_MEDIA_QUERY).matches;
}

function getServerSystemSnapshot(): boolean {
  return false;
}

// ── Señal de hidratación ─────────────────────────────────────────────────

const noopSubscribe = () => () => {};

/**
 * Mantiene sincronizados la preferencia guardada, la preferencia del sistema
 * y la clase `.dark` del documento.
 *
 * El tema visible ya lo aplicó el script de arranque de `theme.ts` antes del
 * primer pintado; este hook solo lo mantiene al día ante cambios posteriores.
 */
export function useTheme(): UseThemeResult {
  const preference = useSyncExternalStore(
    subscribePreference,
    getPreferenceSnapshot,
    getServerPreferenceSnapshot,
  );

  const systemPrefersDark = useSyncExternalStore(
    subscribeSystem,
    getSystemSnapshot,
    getServerSystemSnapshot,
  );

  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  const resolved = resolveTheme(preference, systemPrefersDark);

  useEffect(() => {
    applyResolvedTheme(document.documentElement, resolved);
  }, [resolved]);

  const setPreference = useCallback((next: ThemePreference) => {
    persistPreference(getLocalStorage(), next);
    emit();
  }, []);

  return { preference, resolved, setPreference, mounted };
}
