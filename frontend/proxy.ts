import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Proxy de Next.js para refrescar la sesion de Supabase en cada request
// Esto garantiza que las cookies de auth se mantengan actualizadas
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refrescar la sesion (esto actualiza las cookies si el token expiro)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Nota: los route groups de App Router no forman parte del pathname
  const protectedPrefixes = ["/chat", "/onboarding", "/calendar", "/profile"];
  const isProtectedRoute = protectedPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );
  const isAuthRoute = pathname === "/login" || pathname === "/signup";
  const isCallbackRoute = pathname === "/callback";
  const isLandingRoute = pathname === "/";
  const isOnboardingRoute = pathname.startsWith("/onboarding");

  const onboardingMetadata =
    user?.user_metadata?.onboarding_completed ??
    user?.user_metadata?.onboardingCompleted ??
    user?.app_metadata?.onboarding_completed ??
    user?.app_metadata?.onboardingCompleted;
  const onboardingCompleted =
    typeof onboardingMetadata === "boolean" ? onboardingMetadata : null;

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const allowWithoutOnboarding = pathname.startsWith("/calendar");

  if (
    user &&
    onboardingCompleted === false &&
    !isOnboardingRoute &&
    !allowWithoutOnboarding
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding";
    return NextResponse.redirect(url);
  }

  if (user && onboardingCompleted === true && isOnboardingRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/chat";
    return NextResponse.redirect(url);
  }

  // Si ya esta autenticado e intenta ir a login/signup o landing, redirigir
  if (user && (isAuthRoute || isLandingRoute || isCallbackRoute)) {
    const url = request.nextUrl.clone();
    url.pathname = onboardingCompleted === false ? "/onboarding" : "/chat";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Excluir archivos estaticos y API routes internas de Next.js
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
