"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import AuthBackground from "./AuthBackground";

export default function SignupView() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // TODO Fase 1: Integrar Supabase Auth Signup
    console.log("Signup:", { name, email, password });
    setTimeout(() => setIsLoading(false), 1000);
  };

  const handleGoogleLogin = () => {
    // TODO Fase 1: Integrar Supabase Google OAuth
    console.log("Google OAuth");
  };

  return (
    <>
      <AuthBackground />

      <main className="relative flex min-h-dvh items-center justify-center px-4 py-6 sm:py-8 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, x: 20, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -20, scale: 0.95 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className="w-full max-w-[420px] sm:max-w-[458px]"
        >
          {/* Card glassmorphism */}
          <div className="rounded-2xl border border-white/20 bg-white/40 px-6 py-7 shadow-[0_32px_64px_-16px_rgba(110,44,224,0.1)] backdrop-blur-xl sm:rounded-3xl sm:px-10 sm:py-8">
            {/* Header */}
            <div className="mb-5 flex flex-col items-center sm:mb-6">
              <motion.img
                initial={{ rotate: -10, scale: 0.8 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                src="/only_logo.png"
                alt="ContentSpark Logo"
                className="mb-3 h-12 w-12 sm:h-14 sm:w-14"
              />
              <h1 className="text-xl font-semibold tracking-tight text-[#2c2f33] sm:text-2xl">
                Únete a ContentSpark
              </h1>
              <p className="mt-1 text-center text-sm font-light text-[#595c60]">
                Crea tu cuenta y empieza a brillar
              </p>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-4">
              {/* Nombre Completo */}
              <div className="space-y-1.5">
                <label className="ml-1 text-xs font-medium uppercase tracking-widest text-[#595c60]">
                  Nombre completo
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
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre"
                    required
                    className="w-full rounded-xl border border-white/40 bg-white/30 py-3 pl-11 pr-4 text-sm font-light text-[#2c2f33] outline-none transition-all placeholder:text-[#75777b]/50 focus:border-[#6e2ce0] focus:ring-2 focus:ring-[#6e2ce0]/20 sm:rounded-2xl sm:py-3.5 sm:pl-12 sm:text-base"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="ml-1 text-xs font-medium uppercase tracking-widest text-[#595c60]">
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
                    className="w-full rounded-xl border border-white/40 bg-white/30 py-3 pl-11 pr-4 text-sm font-light text-[#2c2f33] outline-none transition-all placeholder:text-[#75777b]/50 focus:border-[#6e2ce0] focus:ring-2 focus:ring-[#6e2ce0]/20 sm:rounded-2xl sm:py-3.5 sm:pl-12 sm:text-base"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="ml-1 text-xs font-medium uppercase tracking-widest text-[#595c60]">
                  Contraseña
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
                    className="w-full rounded-xl border border-white/40 bg-white/30 py-3 pl-11 pr-11 text-sm font-light text-[#2c2f33] outline-none transition-all placeholder:text-[#75777b]/50 focus:border-[#6e2ce0] focus:ring-2 focus:ring-[#6e2ce0]/20 sm:rounded-2xl sm:py-3.5 sm:pl-12 sm:pr-12 sm:text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#75777b] transition-colors hover:text-[#2c2f33]"
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

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-full bg-gradient-to-r from-[#6e2ce0] to-[#b08cff] py-3 font-semibold text-white shadow-lg shadow-[#6e2ce0]/20 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:hover:scale-100 sm:py-3.5 mt-2"
              >
                {isLoading ? "Creando cuenta..." : "Crear cuenta"}
              </button>
            </form>

            {/* Divider */}
            <div className="my-5 flex w-full items-center gap-3 sm:my-6 sm:gap-4">
              <div className="h-px flex-1 bg-[#abadb2]/20" />
              <span className="text-[10px] font-medium uppercase tracking-widest text-[#75777b] sm:text-xs">
                O regístrate con
              </span>
              <div className="h-px flex-1 bg-[#abadb2]/20" />
            </div>

            {/* Google OAuth */}
            <button
              onClick={handleGoogleLogin}
              className="flex w-full items-center justify-center gap-3 rounded-full border border-white/40 bg-white/20 py-3 text-sm font-medium text-[#2c2f33] backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:bg-white/40 active:scale-95 sm:py-3.5 sm:text-base"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google
            </button>

            {/* Link a login */}
            <p className="mt-5 text-center text-sm font-light text-[#595c60] sm:mt-6">
              ¿Ya tienes cuenta?{" "}
              <a
                href="/login"
                className="ml-1 font-medium text-[#6e2ce0] hover:underline"
              >
                Inicia sesión
              </a>
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
