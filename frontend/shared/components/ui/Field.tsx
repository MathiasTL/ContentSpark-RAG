import type { InputHTMLAttributes, ReactNode } from "react";

export const FIELD_LABEL_CLASS =
  "ml-1 text-xs font-medium uppercase tracking-[0.1em] text-on-surface-variant";

export const FIELD_ICON_CLASS =
  "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant";

/** Clases del input. Se exporta para que PasswordField las reutilice. */
export function inputClass(hasError: boolean, hasTrailing: boolean): string {
  return [
    "w-full rounded-2xl border bg-surface-container-lowest/30 py-3.5 pl-12 text-base font-light text-on-surface",
    "outline-none transition-colors duration-150 placeholder:text-on-surface-variant focus:ring-2",
    hasTrailing ? "pr-14" : "pr-4",
    hasError
      ? "border-danger focus:border-danger focus:ring-danger/25"
      : "border-glass-edge focus:border-primary focus:ring-primary/25",
  ].join(" ");
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className"> & {
  /** Obligatorio: es lo que ata la etiqueta al campo. */
  id: string;
  label: string;
  /** SVG decorativo a la izquierda. Debe llevar `aria-hidden`. */
  icon: ReactNode;
  /** Mensaje de error de ESTE campo. Reemplaza al hint cuando está presente. */
  error?: string | null;
  /** Texto de ayuda permanente, visible antes de enviar. */
  hint?: string | null;
  /** Control a la derecha del input (por ejemplo el ojo de contraseña). */
  trailing?: ReactNode;
  /**
   * Contenido alineado a la derecha en la MISMA fila que la etiqueta, para
   * enlaces auxiliares como "¿Olvidaste tu contraseña?".
   */
  labelTrailing?: ReactNode;
};

/**
 * Campo de formulario con etiqueta, icono guía y mensaje.
 *
 * Ata `label` ↔ `input` por id y arma el `aria-describedby` solo: cuando eso
 * queda a criterio de cada vista, se olvida, y la etiqueta pasa a ser
 * decorativa aunque se vea bien.
 *
 * El hint y el error ocupan el MISMO lugar a propósito. El requisito se
 * declara antes de enviar y, si falla, ese mismo párrafo cambia de tono en
 * vez de aparecer un mensaje nuevo que desplaza el layout.
 */
export default function Field({
  id,
  label,
  icon,
  error = null,
  hint = null,
  trailing,
  labelTrailing,
  ...inputProps
}: Props) {
  const messageId = error || hint ? `${id}-message` : undefined;

  return (
    <div className="space-y-1.5">
      {labelTrailing ? (
        <div className="flex items-center justify-between px-1">
          <label htmlFor={id} className="text-xs font-medium uppercase tracking-[0.1em] text-on-surface-variant">
            {label}
          </label>
          {labelTrailing}
        </div>
      ) : (
        <label htmlFor={id} className={FIELD_LABEL_CLASS}>
          {label}
        </label>
      )}

      <div className="relative">
        {icon}
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={messageId}
          className={inputClass(Boolean(error), Boolean(trailing))}
          {...inputProps}
        />
        {trailing}
      </div>

      {error || hint ? (
        <p
          id={messageId}
          role={error ? "alert" : undefined}
          className={`ml-1 text-xs font-light ${
            error ? "text-danger" : "text-on-surface-variant"
          }`}
        >
          {error ?? hint}
        </p>
      ) : null}
    </div>
  );
}
