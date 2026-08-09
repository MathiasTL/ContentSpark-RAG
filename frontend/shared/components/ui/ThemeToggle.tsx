"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import { useTheme } from "@/shared/hooks/useTheme";
import type { ThemePreference } from "@/shared/lib/theme";

type Option = {
  value: ThemePreference;
  label: string;
  Icon: typeof Sun;
};

const OPTIONS: Option[] = [
  { value: "light", label: "Claro", Icon: Sun },
  { value: "system", label: "Sistema", Icon: Monitor },
  { value: "dark", label: "Oscuro", Icon: Moon },
];

/**
 * Control segmentado de tema. Tres estados explícitos en vez de un botón que
 * cicla: "Sistema" es una elección real y tiene que poder recuperarse.
 */
export default function ThemeToggle() {
  const { preference, setPreference, mounted } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Tema de la interfaz"
      className="flex items-center gap-1 rounded-full border border-glass-edge bg-glass-edge-soft p-1"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        // Antes de montar no sabemos la preferencia guardada: no marcamos
        // ninguna opción en vez de marcar una equivocada.
        const isSelected = mounted && preference === value;

        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            title={label}
            onClick={() => setPreference(value)}
            className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-[0.6875rem] font-medium uppercase tracking-[0.1em] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:min-h-8 ${
              isSelected
                ? "bg-primary text-white"
                : "text-on-surface-variant hover:bg-glass-edge hover:text-on-surface"
            }`}
          >
            <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
