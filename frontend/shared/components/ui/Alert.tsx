import type { ReactNode } from "react";

export type AlertTone = "danger" | "success";

type Props = {
  tone: AlertTone;
  children: ReactNode;
  className?: string;
  id?: string;
};

/**
 * Aviso a nivel de formulario o de pantalla.
 *
 * El `role` lo decide el tono, no quien lo llama: un error interrumpe
 * (`alert`) y una confirmación no (`status`). Dejarlo a criterio de cada
 * vista es exactamente cómo se terminan olvidando los lectores de pantalla.
 *
 * Para un error atribuible a un campo, esto NO es lo correcto: el mensaje va
 * debajo del campo, y de eso se encarga `Field`.
 */
export default function Alert({ tone, children, className = "", id }: Props) {
  const byTone: Record<AlertTone, string> = {
    danger: "border-danger/40 bg-danger-container text-danger",
    success: "border-success/40 bg-success-container text-success",
  };

  return (
    <div
      id={id}
      role={tone === "danger" ? "alert" : "status"}
      className={`rounded-2xl border px-4 py-3 text-sm ${byTone[tone]} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
