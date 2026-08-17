"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";

import Alert from "@/shared/components/ui/Alert";
import Button from "@/shared/components/ui/Button";
import Field, { FIELD_ICON_CLASS } from "@/shared/components/ui/Field";
import { createClient } from "@/shared/lib/supabase";
import { mapAuthError, type ErrorRule } from "../lib/auth-errors";
import AuthShell from "./AuthShell";

const FORGOT_ERROR_RULES: ErrorRule[] = [
  [
    /invalid email|valid email/,
    {
      field: "email",
      text: "Ese correo no parece válido. Revisalo e intentá de nuevo.",
    },
  ],
];

export default function ForgotPasswordView() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      // No revelamos si el correo existe o no: mostramos el mismo mensaje
      // de éxito salvo que ocurra un error real de la API (rate limit, etc).
      if (error) {
        setErrorText(
          mapAuthError(
            error.message,
            FORGOT_ERROR_RULES,
            "No pudimos enviar el enlace. Intentá de nuevo en un momento.",
          ).text,
        );
        return;
      }

      setIsSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Recuperar contraseña"
      subtitle="Te enviamos un enlace para restablecerla"
    >
      {isSubmitted ? (
        <Alert tone="success">
          Si existe una cuenta con ese correo, vas a recibir un enlace para
          restablecer tu contraseña. Revisá tu bandeja de entrada (y la carpeta de
          spam).
        </Alert>
      ) : (
        <>
          {errorText ? (
            <Alert tone="danger" className="mb-4">
              {errorText}
            </Alert>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5" noValidate>
            <Field
              id="forgot-email"
              name="email"
              label="Correo electrónico"
              type="email"
              autoComplete="email"
              autoFocus
              required
              placeholder="nombre@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail aria-hidden="true" size={18} strokeWidth={1.5} className={FIELD_ICON_CLASS} />}
            />

            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Enviando..." : "Enviar enlace de recuperación"}
            </Button>
          </form>
        </>
      )}

      <p className="mt-5 text-center text-sm font-light text-on-surface-variant sm:mt-6">
        ¿Recordaste tu contraseña?{" "}
        <Link
          href="/login"
          className="ml-1 font-medium text-primary transition-colors duration-150 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Volver a iniciar sesión
        </Link>
      </p>
    </AuthShell>
  );
}
