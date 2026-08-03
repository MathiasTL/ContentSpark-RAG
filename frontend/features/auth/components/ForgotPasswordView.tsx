"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import AuthBackground from "./AuthBackground";
import { createClient } from "@/shared/lib/supabase";

export default function ForgotPasswordView() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const errorId = useId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      // No revelamos si el correo existe o no: mostramos el mismo mensaje
      // de éxito salvo que ocurra un error real de la API (rate limit, etc).
      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setIsSubmitted(true);
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
                Recuperar contraseña
              </h1>
              <p className="mt-1 text-center text-sm font-light text-on-surface-variant">
                Te enviamos un enlace para restablecerla
              </p>
            </div>

            {isSubmitted ? (
              <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700">
                Si existe una cuenta con ese correo, vas a recibir un enlace
                para restablecer tu contraseña. Revisá tu bandeja de entrada
                (y la carpeta de spam).
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

                {/* Formulario */}
                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="ml-1 text-xs font-medium uppercase tracking-widest text-on-surface-variant">
                      Correo electrónico
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
                        <rect x="2" y="4" width="20" height="16" rx="2" />
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                      </svg>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nombre@empresa.com"
                        required
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
                    {isLoading ? "Enviando..." : "Enviar enlace de recuperación"}
                  </button>
                </form>
              </>
            )}

            {/* Link a login */}
            <p className="mt-5 text-center text-sm font-light text-on-surface-variant sm:mt-6">
              ¿Recordaste tu contraseña?{" "}
              <Link
                href="/login"
                className="ml-1 font-medium text-primary hover:underline"
              >
                Volver a iniciar sesión
              </Link>
            </p>
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
