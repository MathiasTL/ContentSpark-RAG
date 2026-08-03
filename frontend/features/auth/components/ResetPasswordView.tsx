"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import AuthBackground from "./AuthBackground";
import { createClient } from "@/shared/lib/supabase";

type SessionStatus = "checking" | "valid" | "invalid";

export default function ResetPasswordView() {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();
  const hasRun = useRef(false);
  const errorId = useId();

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
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error || !data?.session) {
          setSessionStatus("invalid");
          return;
        }

        setSessionStatus("valid");
        return;
      }

      // Fallback para flujo implícito (tokens en el hash)
      const hashParams = new URLSearchParams(
        window.location.hash.replace(/^#/, "")
      );
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error || !data?.session) {
          setSessionStatus("invalid");
          return;
        }

        setSessionStatus("valid");
        return;
      }

      setSessionStatus("invalid");
    };

    void verifyRecoverySession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage("Las contraseñas no coinciden.");
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      router.push("/chat");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AuthBackground />

      <main className="relative flex min-h-dvh items-center justify-center px-4 py-6 sm:py-8 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, x: -20, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 20, scale: 0.95 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className="w-full max-w-[420px] sm:max-w-[458px]"
        >
          {/* Card glassmorphism */}
          <div className="rounded-2xl border border-white/20 bg-surface-container-lowest/40 px-6 py-7 shadow-[0_32px_64px_-16px_rgba(110,44,224,0.1)] backdrop-blur-xl sm:rounded-3xl sm:px-10 sm:py-8">
            {/* Header */}
            <div className="mb-5 flex flex-col items-center sm:mb-6">
              <motion.img
                initial={{ rotate: 10, scale: 0.8 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                src="/only_logo.png"
                alt="ContentSpark Logo"
                className="mb-3 h-12 w-12 sm:h-14 sm:w-14"
              />
              <h1 className="text-xl font-semibold tracking-tight text-on-surface sm:text-2xl">
                Nueva contraseña
              </h1>
              <p className="mt-1 text-center text-sm font-light text-on-surface-variant">
                Elegí una contraseña nueva para tu cuenta
              </p>
            </div>

            {sessionStatus === "checking" ? (
              <p className="text-center text-sm font-light text-on-surface-variant">
                Verificando tu enlace de recuperación...
              </p>
            ) : sessionStatus === "invalid" ? (
              <div className="space-y-4">
                <div
                  role="alert"
                  className="rounded-2xl border border-red-200/60 bg-red-50/80 px-4 py-3 text-sm text-red-700"
                >
                  Este enlace de recuperación ya no es válido: puede haber
                  expirado o ya haber sido utilizado.
                </div>
                <Link
                  href="/forgot-password"
                  className="block w-full rounded-full bg-gradient-to-r from-primary to-primary-container py-3 text-center font-semibold text-white shadow-lg shadow-primary/20 transition-all duration-300 hover:scale-[1.02] active:scale-95 sm:py-3.5"
                >
                  Solicitar un nuevo enlace
                </Link>
              </div>
            ) : (
              <>
                {errorMessage ? (
                  <div
                    id={errorId}
                    role="alert"
                    className="mb-4 rounded-2xl border border-red-200/60 bg-red-50/80 px-4 py-3 text-sm text-red-700"
                  >
                    {errorMessage}
                  </div>
                ) : null}

                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                  {/* Nueva contraseña */}
                  <div className="space-y-1.5">
                    <label className="ml-1 text-xs font-medium uppercase tracking-widest text-on-surface-variant">
                      Nueva contraseña
                    </label>
                    <div className="relative">
                      <svg
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-[#75777b]"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={6}
                        aria-invalid={errorMessage ? true : undefined}
                        aria-describedby={errorMessage ? errorId : undefined}
                        className="w-full rounded-xl border border-white/40 bg-surface-container-lowest/30 py-3 pl-11 pr-11 text-sm font-light text-on-surface outline-none transition-all placeholder:text-[#75777b]/50 focus:border-primary focus:ring-2 focus:ring-primary/20 sm:rounded-2xl sm:py-3.5 sm:pl-12 sm:pr-12 sm:text-base"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#75777b] transition-colors hover:text-on-surface"
                      >
                        {showPassword ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Confirmar contraseña */}
                  <div className="space-y-1.5">
                    <label className="ml-1 text-xs font-medium uppercase tracking-widest text-on-surface-variant">
                      Confirmar contraseña
                    </label>
                    <div className="relative">
                      <svg
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-[#75777b]"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={6}
                        aria-invalid={errorMessage ? true : undefined}
                        aria-describedby={errorMessage ? errorId : undefined}
                        className="w-full rounded-xl border border-white/40 bg-surface-container-lowest/30 py-3 pl-11 pr-4 text-sm font-light text-on-surface outline-none transition-all placeholder:text-[#75777b]/50 focus:border-primary focus:ring-2 focus:ring-primary/20 sm:rounded-2xl sm:py-3.5 sm:pl-12 sm:text-base"
                      />
                    </div>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full rounded-full bg-gradient-to-r from-primary to-primary-container py-3 font-semibold text-white shadow-lg shadow-primary/20 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:hover:scale-100 sm:py-3.5"
                  >
                    {isLoading ? "Guardando..." : "Guardar contraseña"}
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Footer */}
          <footer className="mt-5 text-center sm:mt-6">
            <p className="text-[10px] font-light uppercase tracking-[0.2em] text-[#75777b]/60">
              © 2025 ContentSpark. Todos los derechos reservados.
            </p>
          </footer>
        </motion.div>
      </main>
    </>
  );
}
