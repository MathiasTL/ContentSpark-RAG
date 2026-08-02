"use client";

import { useEffect } from "react";
import { useProfileStore } from "../store/profileStore";
import ProfileForm from "./ProfileForm";

// Contenedor de la pantalla de perfil: carga el perfil persistido al
// montar (si aún no está en el store) y delega la edición a
// ProfileForm. La regla de completitud del perfil vive solo en el
// backend (GET /api/profile/status) — esta vista no la reimplementa.
export default function ProfileView() {
  const profile = useProfileStore((s) => s.profile);
  const isLoading = useProfileStore((s) => s.isLoading);
  const load = useProfileStore((s) => s.load);

  useEffect(() => {
    if (!profile) {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-4 py-10 sm:px-6">
      <div className="rounded-3xl border border-white/20 bg-white/40 p-6 shadow-[0_32px_64px_-16px_rgba(110,44,224,0.12)] backdrop-blur-xl sm:p-10">
        <h1 className="text-xl font-semibold tracking-tight text-[#2c2f33] sm:text-2xl">
          Tu perfil
        </h1>
        <p className="mt-1 text-sm font-light text-[#595c60]">
          Actualiza tu información para personalizar tus respuestas y
          recomendaciones.
        </p>

        <div className="mt-6">
          {isLoading && !profile ? (
            <p className="text-sm text-[#595c60]">Cargando perfil...</p>
          ) : (
            <ProfileForm />
          )}
        </div>
      </div>
    </div>
  );
}
