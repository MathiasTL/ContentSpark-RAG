import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// 1. Instanciamos la fuente Inter
// Subsets 'latin' optimiza el peso del archivo para nuestro idioma
// El peso (weight) no lo definimos aquí para que importe los variables por defecto
const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter", // Creamos una variable CSS para Tailwind
  display: 'swap',          // Evita el parpadeo de texto al cargar la página (FOUT)
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
    <html lang="es">
      {/* Aplicamos la fuente 'inter.className' al body. 
        También añadimos 'antialiased' (una clase de Tailwind) que hace que 
        las fuentes se vean mucho más suaves y definidas, al estilo macOS.
      */}
      <body className={`${inter.className} antialiased bg-slate-50 text-slate-900`}>
        {children}
      </body>
    </html>
  );
}