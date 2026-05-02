"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/shared/lib/supabase";

// Fase 1: OAuth callback de Supabase
export default function CallbackPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const finalizeLogin = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const errorParam =
        params.get("error_description") ?? params.get("error") ?? null;

      if (errorParam) {
        setErrorMessage(decodeURIComponent(errorParam));
        return;
      }

      const supabase = createClient();
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error || !data?.session) {
          setErrorMessage("No pudimos completar el inicio de sesion.");
          return;
        }

        router.replace("/chat");
        return;
      }

      const hashParams = new URLSearchParams(
        window.location.hash.replace(/^#/, "")
      );
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (!accessToken || !refreshToken) {
        setErrorMessage("No pudimos completar el inicio de sesion.");
        return;
      }

      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error || !data?.session) {
        setErrorMessage("No pudimos completar el inicio de sesion.");
        return;
      }

      router.replace("/chat");
    };

    void finalizeLogin();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
      <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-center">
        <p className="text-sm font-medium">
          {errorMessage ?? "Finalizando inicio de sesion..."}
        </p>
      </div>
    </div>
  );
}
