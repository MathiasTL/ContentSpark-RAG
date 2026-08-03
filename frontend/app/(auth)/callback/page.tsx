"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/shared/lib/supabase";

export default function CallbackPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    // Prevents React Strict Mode from running this twice and consuming the PKCE code
    if (hasRun.current) return;
    hasRun.current = true;

    const finalizeLogin = async () => {
      const supabase = createClient();

      // If already authenticated (code was already exchanged), skip straight to app
      const { data: { session: existing } } = await supabase.auth.getSession();
      if (existing) {
        router.replace("/chat");
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const errorParam = params.get("error_description") ?? params.get("error") ?? null;

      if (errorParam) {
        setErrorMessage(decodeURIComponent(errorParam));
        return;
      }

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          console.error("Auth callback error:", error);
          setErrorMessage(error.message);
          return;
        }

        if (!data?.session) {
          setErrorMessage("No pudimos completar el inicio de sesión: sesión vacía.");
          return;
        }

        router.replace("/chat");
        return;
      }

      // Implicit flow fallback (hash-based tokens)
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error || !data?.session) {
          setErrorMessage(error?.message ?? "No pudimos completar el inicio de sesión.");
          return;
        }

        router.replace("/chat");
        return;
      }

      setErrorMessage("No se recibió código de autorización de Google.");
    };

    void finalizeLogin();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
      <div className="rounded-2xl border border-white/10 bg-surface-container-lowest/5 px-6 py-5 text-center">
        <p className="text-sm font-medium">
          {errorMessage ?? "Finalizando inicio de sesión..."}
        </p>
      </div>
    </div>
  );
}
