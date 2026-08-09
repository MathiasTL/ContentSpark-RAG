"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/shared/lib/supabase";

export type CurrentUser = {
  name: string;
  email?: string;
  avatar?: string;
};

/**
 * Carga el usuario autenticado y lo normaliza para la interfaz.
 *
 * Vive en un hook compartido porque lo consumen dos superficies distintas
 * (AppSidebar en escritorio y MobileNav por debajo de `lg`), y duplicar la
 * lectura de `user_metadata` garantizaría que se desincronicen.
 */
export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) return;

      const meta = data.user.user_metadata ?? {};
      setUser({
        name:
          meta.full_name ||
          meta.name ||
          data.user.email?.split("@")[0] ||
          "Creator",
        email: data.user.email ?? undefined,
        avatar: meta.avatar_url ?? meta.picture,
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return user;
}
