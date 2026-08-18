"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { useProfileStore } from "../store/profileStore";

const DISMISS_KEY = "cs.timezone-nudge.dismissed";

// El acceso a localStorage puede lanzar, no solo devolver null: Safari en
// navegación privada y algunas políticas empresariales deshabilitan web
// storage por completo. Este componente se monta en app/(app)/layout.tsx,
// que envuelve TODAS las rutas autenticadas, así que una excepción sin
// atrapar durante el render inicial tumbaría cada página de la app. Sin
// poder persistir, degradamos a "no descartado": el aviso reaparece, que
// es molesto pero inofensivo comparado con un layout roto.
function readDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

// Banner de una sola vez para creadores cuyo perfil todavía no tiene
// timezone (NULL): el calendario se resuelve en UTC hasta que la
// completen. Dismissal es client-only (localStorage), sin columna ni
// endpoint nuevo (design.md §7.3, decisión de producto asentada).
export default function TimezoneNudge() {
  const profile = useProfileStore((s) => s.profile);
  const isLoading = useProfileStore((s) => s.isLoading);
  const load = useProfileStore((s) => s.load);
  const [dismissed, setDismissed] = useState(readDismissed);

  // Mismo patrón de montaje idempotente que ProfileView.tsx:16-21, con el
  // guard adicional de isLoading para no disparar una segunda carga
  // mientras la primera sigue en vuelo (el store es un singleton, así que
  // dos montajes comparten un único GET /api/profile por sesión).
  useEffect(() => {
    if (!profile && !isLoading) {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = profile !== null && profile.timezone === null && !dismissed;
  if (!visible) return null;

  function dismiss(): void {
    // El descarte se aplica igual aunque no se pueda persistir: la sesión
    // actual respeta el click, y a lo sumo el aviso vuelve en la próxima.
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Storage deshabilitado: sin persistencia, sin romper el layout.
    }
    setDismissed(true);
  }

  return (
    <div
      role="status"
      className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-2xl border border-glass-edge bg-surface-container-lowest/40 px-4 py-3 text-sm text-on-surface backdrop-blur-md sm:mx-6"
    >
      <p className="flex-1">
        Todavía no configuraste tu zona horaria: tu calendario se está
        generando en UTC.{" "}
        <Link href="/profile" className="font-medium text-primary underline">
          Configurarla en tu perfil
        </Link>
        .
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Descartar aviso de zona horaria"
        className="rounded-full p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-lowest/20"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
