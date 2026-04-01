import { createBrowserClient } from "@supabase/ssr";

// Cliente Supabase para componentes del navegador (Client Components)
// Usa las keys públicas (sb_publishable_...) — seguras para exponer en el frontend
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
