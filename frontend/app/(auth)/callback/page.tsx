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

      if (!code) {
        setErrorMessage("No se encontro el codigo de autenticacion.");
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
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
