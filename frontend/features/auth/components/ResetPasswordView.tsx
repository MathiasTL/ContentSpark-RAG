"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import Alert from "@/shared/components/ui/Alert";
import Button, { buttonClass } from "@/shared/components/ui/Button";
import PasswordField from "@/shared/components/ui/PasswordField";
import { createClient } from "@/shared/lib/supabase";
import { mapAuthError, type ErrorRule, type FieldError } from "../lib/auth-errors";
import AuthShell from "./AuthShell";
import { PASSWORD_MIN_LENGTH } from "../lib/constants";

type SessionStatus = "checking" | "valid" | "invalid";

const RESET_ERROR_RULES: ErrorRule[] = [
  [
    /should be different|same as/,
    {
      field: "password",
      text: "La contraseña nueva tiene que ser distinta de la anterior.",
    },
  ],
  [
    /password.*least|least.*password/,
    {
      field: "password",
      text: `La contraseña necesita al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
    },
  ],
  [
    /expired|invalid/,
    {
      field: null,
      text: "El enlace expiró mientras completabas el formulario. Pedí uno nuevo.",
    },
  ],
];

export default function ResetPasswordView() {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<FieldError | null>(null);
  const router = useRouter();
  const hasRun = useRef(false);

  const passwordError = error?.field === "password" ? error.text : null;
  const confirmError = error?.field === "confirm" ? error.text : null;
  const formError = error?.field === null ? error.text : null;

  useEffect(() => {
    // Evita que React Strict Mode ejecute esto dos veces y consuma el código PKCE
    if (hasRun.current) return;
    hasRun.current = true;

    const verifyRecoverySession = async () => {
      const supabase = createClient();

      // Si ya hay sesión (el código ya fue intercambiado), continuamos
      const {
        data: { session: existing },
      } = await supabase.auth.getSession();
      if (existing) {
        setSessionStatus("valid");
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const errorParam =
        params.get("error_description") ?? params.get("error") ?? null;

      if (errorParam) {
        setSessionStatus("invalid");
        return;
      }

      if (code) {
        const { data, error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        setSessionStatus(exchangeError || !data?.session ? "invalid" : "valid");
        return;
      }

      // Fallback para flujo implícito (tokens en el hash)
      const hashParams = new URLSearchParams(
        window.location.hash.replace(/^#/, ""),
      );
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        setSessionStatus(sessionError || !data?.session ? "invalid" : "valid");
        return;
      }

      setSessionStatus("invalid");
    };

    void verifyRecoverySession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Este error pertenece al campo de confirmación, no al formulario.
    if (password !== confirmPassword) {
      setError({ field: "confirm", text: "Las contraseñas no coinciden." });
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(
          mapAuthError(
            updateError.message,
            RESET_ERROR_RULES,
            "No pudimos guardar la contraseña. Intentá de nuevo en un momento.",
          ),
        );
        return;
      }

      router.push("/chat");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Nueva contraseña"
      subtitle="Elegí una contraseña nueva para tu cuenta"
    >
      {sessionStatus === "checking" ? (
        <p role="status" className="text-center text-sm font-light text-on-surface-variant">
          Verificando tu enlace de recuperación...
        </p>
      ) : sessionStatus === "invalid" ? (
        <div className="space-y-4">
          <Alert tone="danger">
            Este enlace de recuperación ya no es válido: puede haber expirado o ya
            haber sido utilizado.
          </Alert>
          {/* Link, no button: navega. Comparte las clases para no divergir. */}
          <Link href="/forgot-password" className={`${buttonClass("primary")} block text-center`}>
            Solicitar un nuevo enlace
          </Link>
        </div>
      ) : (
        <>
          {formError ? (
            <Alert tone="danger" className="mb-4">
              {formError}
            </Alert>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5" noValidate>
            <PasswordField
              id="reset-password"
              label="Nueva contraseña"
              value={password}
              onChange={setPassword}
              visible={showPassword}
              onToggleVisibility={() => setShowPassword(!showPassword)}
              autoComplete="new-password"
              autoFocus
              minLength={PASSWORD_MIN_LENGTH}
              error={passwordError}
              hint={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres.`}
            />

            {/* Sin ojo propio: el de arriba gobierna los dos campos. */}
            <PasswordField
              id="reset-confirm"
              label="Confirmar contraseña"
              value={confirmPassword}
              onChange={setConfirmPassword}
              visible={showPassword}
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              error={confirmError}
            />

            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Guardando..." : "Guardar contraseña"}
            </Button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
