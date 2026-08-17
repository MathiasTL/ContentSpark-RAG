import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "ghost";

/**
 * Clases del botón, expuestas aparte del componente porque a veces la acción
 * primaria es un `<Link>` y no un `<button>` (por ejemplo "Solicitar un nuevo
 * enlace" cuando el enlace de recuperación expiró). Compartir la cadena evita
 * que las dos formas se desincronicen.
 *
 * Carácter "preciso y contenido": transición de 150ms solo en color, sin
 * escalado en hover ni compresión en active, foco visible de 2px.
 */
export function buttonClass(variant: ButtonVariant = "primary"): string {
  const base =
    "w-full rounded-full py-3.5 text-base font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-45";

  const byVariant: Record<ButtonVariant, string> = {
    // `text-on-primary` y no `text-white`: en oscuro el primario se aclara y
    // el texto tiene que invertirse para pasar contraste.
    primary: "bg-primary text-on-primary hover:bg-primary-hover",
    ghost:
      "flex items-center justify-center gap-3 border border-glass-edge bg-surface-container-lowest/20 text-on-surface backdrop-blur-md hover:bg-surface-container-lowest/40",
  };

  return `${base} ${byVariant[variant]}`;
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export default function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={`${buttonClass(variant)} ${className}`.trim()}
      {...rest}
    />
  );
}
