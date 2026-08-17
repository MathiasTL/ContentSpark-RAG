"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail } from "lucide-react";

import Alert from "@/shared/components/ui/Alert";
import Button from "@/shared/components/ui/Button";
import Field, { FIELD_ICON_CLASS } from "@/shared/components/ui/Field";
import PasswordField from "@/shared/components/ui/PasswordField";
import { createClient } from "@/shared/lib/supabase";
import { mapAuthError, type ErrorRule, type FieldError } from "../lib/auth-errors";
import AuthDivider from "./AuthDivider";
import AuthShell from "./AuthShell";
import GoogleButton from "./GoogleButton";

const LOGIN_ERROR_RULES: ErrorRule[] = [
  [
    /invalid login credentials/,
    {
      field: "password",
      text: "El correo o la contraseña no coinciden. Revisalos e intentá de nuevo.",
    },
  ],
  [
    /email not confirmed/,
    {
      field: null,
      text: "Todavía no confirmaste tu correo. Buscá el mail de verificación que te enviamos.",
    },
  ],
];

export default function LoginView() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<FieldError | null>(null);
  const router = useRouter();

  const passwordError = error?.field === "password" ? error.text : null;
  const formError = error?.field === null ? error.text : null;

  const fail = (message: string) =>
    setError(
      mapAuthError(
        message,
        LOGIN_ERROR_RULES,
        "No pudimos iniciar sesión. Intentá de nuevo en un momento.",
      ),
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        fail(authError.message);
        return;
      }

      router.push("/chat");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    void (async () => {
      setError(null);
      setIsLoading(true);
      try {
        const supabase = createClient();
        const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/callback` },
        });

        if (oauthError) {
          fail(oauthError.message);
          return;
        }

        if (data?.url) window.location.href = data.url;
      } finally {
        setIsLoading(false);
      }
    })();
  };

  return (
    <AuthShell title="ContentSpark" subtitle="Entra a tu espacio de trabajo">
      {formError ? (
        <Alert tone="danger" className="mb-4">
          {formError}
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5" noValidate>
        <Field
          id="login-email"
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

        <PasswordField
          id="login-password"
          label="Contraseña"
          value={password}
          onChange={setPassword}
          visible={showPassword}
          onToggleVisibility={() => setShowPassword(!showPassword)}
          autoComplete="current-password"
          error={passwordError}
          labelTrailing={
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-primary transition-colors duration-150 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          }
        />

        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Ingresando..." : "Iniciar sesión"}
        </Button>
      </form>

      <AuthDivider label="O continúa con" />

      <GoogleButton onClick={handleGoogleLogin} disabled={isLoading} />

      <p className="mt-5 text-center text-sm font-light text-on-surface-variant sm:mt-6">
        ¿No tienes cuenta?{" "}
        <Link
          href="/signup"
          className="ml-1 font-medium text-primary transition-colors duration-150 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Crea una cuenta
        </Link>
      </p>
    </AuthShell>
  );
}
