import { Eye, EyeOff, Lock } from "lucide-react";

import Field, { FIELD_ICON_CLASS } from "./Field";

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Visibilidad controlada: ResetPassword la comparte entre dos campos. */
  visible: boolean;
  /** Si se omite, el campo no dibuja el ojo pero sigue el estado `visible`. */
  onToggleVisibility?: () => void;
  autoComplete: "current-password" | "new-password";
  error?: string | null;
  hint?: string | null;
  minLength?: number;
  autoFocus?: boolean;
  required?: boolean;
  /** Se reenvía a Field: enlace auxiliar en la fila de la etiqueta. */
  labelTrailing?: React.ReactNode;
};

/**
 * Campo de contraseña con el ojo de mostrar/ocultar.
 *
 * La visibilidad es controlada porque en ResetPassword un solo ojo gobierna
 * los dos campos: si cada campo tuviera su estado, mostrarías una contraseña
 * y la confirmación seguiría oculta.
 *
 * El botón tiene 44px reales (`h-11 w-11`) y un `aria-label` que refleja la
 * acción, no el estado. Como icono suelto sin nombre accesible se anunciaba
 * simplemente como "button".
 */
export default function PasswordField({
  id,
  label,
  value,
  onChange,
  visible,
  onToggleVisibility,
  autoComplete,
  error = null,
  hint = null,
  minLength,
  autoFocus,
  required = true,
  labelTrailing,
}: Props) {
  return (
    <Field
      id={id}
      label={label}
      labelTrailing={labelTrailing}
      name={id}
      type={visible ? "text" : "password"}
      autoComplete={autoComplete}
      autoFocus={autoFocus}
      required={required}
      minLength={minLength}
      placeholder="••••••••"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error}
      hint={hint}
      icon={<Lock aria-hidden="true" size={18} strokeWidth={1.5} className={FIELD_ICON_CLASS} />}
      trailing={
        onToggleVisibility ? (
          <button
            type="button"
            onClick={onToggleVisibility}
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={visible}
            className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-on-surface-variant transition-colors duration-150 hover:text-on-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
          >
            {visible ? (
              <EyeOff aria-hidden="true" size={18} strokeWidth={1.5} />
            ) : (
              <Eye aria-hidden="true" size={18} strokeWidth={1.5} />
            )}
          </button>
        ) : undefined
      }
    />
  );
}
