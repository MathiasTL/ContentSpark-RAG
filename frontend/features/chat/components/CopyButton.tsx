"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

// Copiar es la accion de conversion real de este producto: el creador saca
// hooks y guiones del chat para llevarlos a su contenido. Hasta ahora exigia
// seleccionar el texto a mano.
//
// VISIBILIDAD: se revela en hover SOLO en pointer devices (`sm:`). En pantallas
// chicas queda siempre visible, porque en tactil no existe el hover y esconder
// la unica accion del mensaje detras de el la vuelve inalcanzable. Tambien
// aparece con foco de teclado, por la misma razon.

interface CopyButtonProps {
  text: string;
  /** Etiqueta accesible; distingue este boton de los otros mensajes de la lista. */
  label?: string;
}

export default function CopyButton({ text, label = "Copiar respuesta" }: CopyButtonProps) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function handleCopy() {
    try {
      // navigator.clipboard no existe en contextos no seguros (http en LAN, por
      // ejemplo). Es un fallo esperable, no una excepcion que deba romper nada.
      if (!navigator.clipboard) throw new Error("clipboard no disponible");
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("error");
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setState("idle"), 2000);
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <button
        type="button"
        onClick={handleCopy}
        aria-label={label}
        className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant opacity-100 transition-colors duration-150 hover:bg-surface-container-lowest/40 hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
      >
        {state === "copied" ? (
          <Check size={16} strokeWidth={2} aria-hidden="true" />
        ) : (
          <Copy size={16} strokeWidth={1.5} aria-hidden="true" />
        )}
      </button>

      {/* El estado se anuncia por texto y no solo por el cambio de icono, que un
          lector de pantalla no percibe. */}
      <span role="status" aria-live="polite" className="text-xs text-on-surface-variant">
        {state === "copied" && "Copiado"}
        {state === "error" && "No se pudo copiar"}
      </span>
    </div>
  );
}
