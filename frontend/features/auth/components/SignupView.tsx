"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, User } from "lucide-react";

import Alert from "@/shared/components/ui/Alert";
import Button from "@/shared/components/ui/Button";
import Field, { FIELD_ICON_CLASS } from "@/shared/components/ui/Field";
import PasswordField from "@/shared/components/ui/PasswordField";
import { createClient } from "@/shared/lib/supabase";
import { mapAuthError, type ErrorRule, type FieldError } from "../lib/auth-errors";
import { PASSWORD_MIN_LENGTH } from "../lib/constants";
import AuthDivider from "./AuthDivider";
import AuthShell from "./AuthShell";
import GoogleButton from "./GoogleButton";

const SIGNUP_ERROR_RULES: ErrorRule[] = [
  [
    /already registered|already been registered|user already exists/,
    {
      field: "email",
      text: "Ya existe una cuenta con este correo. Probá iniciar sesión.",
    },
  ],
  [
    /invalid email|valid email/,
    {
      field: "email",
      text: "Ese correo no parece válido. Revisalo e intentá de nuevo.",
    },
  ],
  [
    /password.*least|least.*password/,
    {
      field: "password",
      text: `La contraseña necesita al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
    },
  ],
];

export default function SignupView() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<FieldError | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const router = useRouter();

  const emailError = error?.field === "email" ? error.text : null;
  const passwordError = error?.field === "password" ? error.text : null;
  const formError = error?.field === null ? error.text : null;

  const fail = (message: string) =>
    setError(
      mapAuthError(
        message,
        SIGNUP_ERROR_RULES,
        "No pudimos crear la cuenta. Intentá de nuevo en un momento.",
      ),
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSentTo(null);
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });

      if (authError) {
        fail(authError.message);
        return;
      }

      if (data.session) {
        router.push("/chat");
        return;
      }

      setSentTo(email);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    void (async () => {
      setError(null);
      setSentTo(null);
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
    <AuthShell
      title="Únete a ContentSpark"
      subtitle="Crea tu cuenta y empieza a brillar"
      from="right"
    >
      {formError ? (
        <Alert tone="danger" className="mb-4">
          {formError}
        </Alert>
      ) : null}

      {sentTo ? (
        <Alert tone="success" className="mb-4">
          Te enviamos un correo a {sentTo}. Confirmá tu cuenta desde ahí para entrar.
          <span className="mt-1 block font-light">
            ¿No llegó? Revisá tu carpeta de spam o volvé a intentar con otra dirección.
          </span>
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field
          id="signup-name"
          name="name"
          label="Nombre completo"
          type="text"
          autoComplete="name"
          autoFocus
          required
          placeholder="Tu nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          icon={<User aria-hidden="true" size={18} strokeWidth={1.5} className={FIELD_ICON_CLASS} />}
        />

        <Field
          id="signup-email"
          name="email"
          label="Correo electrónico"
          type="email"
          autoComplete="email"
          required
          placeholder="nombre@empresa.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
          icon={<Mail aria-hidden="true" size={18} strokeWidth={1.5} className={FIELD_ICON_CLASS} />}
        />

        <PasswordField
          id="signup-password"
          label="Contraseña"
          value={password}
          onChange={setPassword}
          visible={showPassword}
          onToggleVisibility={() => setShowPassword(!showPassword)}
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          error={passwordError}
          hint={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres.`}
        />

        <Button type="submit" disabled={isLoading} className="mt-2">
          {isLoading ? "Creando cuenta..." : "Crear cuenta"}
        </Button>
      </form>

      <AuthDivider label="O regístrate con" />

      <GoogleButton onClick={handleGoogleSignup} disabled={isLoading} />

      <p className="mt-5 text-center text-sm font-light text-on-surface-variant sm:mt-6">
        ¿Ya tienes cuenta?{" "}
        <Link
          href="/login"
          className="ml-1 font-medium text-primary transition-colors duration-150 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Inicia sesión
        </Link>
      </p>
    </AuthShell>
  );
}
