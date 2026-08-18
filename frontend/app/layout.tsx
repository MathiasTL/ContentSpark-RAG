import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/shared/lib/theme";

// 1. Instanciamos la fuente Inter
// Subsets 'latin' optimiza el peso del archivo para nuestro idioma
// El peso (weight) no lo definimos aquí para que importe los variables por defecto
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter", // Creamos una variable CSS para Tailwind
  display: 'swap',          // Evita el parpadeo de texto al cargar la página (FOUT)
});

// Fraunces: segunda fuente, exclusiva de la landing (ver globals.css --font-display
// y frontend/features/landing/landing-tokens.css). Nunca se usa fuera de ese scope.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
});

// 2. Metadatos globales de la aplicación (SEO básico)
export const metadata: Metadata = {
  title: "ContentSpark | IA para Creadores",
  description: "Genera hooks virales y optimiza tu retención con IA.",
};

// 3. El Layout Raíz
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // 'inter.variable' expone --font-inter, que es lo que consume el token
    // --font-sans de globals.css. Sin esto, 'font-sans' cae al fallback del sistema.
    // 'suppressHydrationWarning' es necesario porque el script de tema modifica
    // la clase y el estilo de <html> antes de que React hidrate.
    <html lang="es" className={`${inter.variable} ${fraunces.variable}`} suppressHydrationWarning>
      {/* 'antialiased' suaviza el renderizado de la tipografía, al estilo macOS. */}
      <body className="font-sans antialiased bg-surface-container-lowest text-on-surface">
        {/* Corre antes de pintar el contenido: evita el parpadeo de tema. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}