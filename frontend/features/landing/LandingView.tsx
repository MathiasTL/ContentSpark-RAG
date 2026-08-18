"use client";

import "./landing-tokens.css";
import GradientBackground from "./components/GradientBackground";
import Navbar from "./components/Navbar";
import HeroSection from "./components/HeroSection";
import BrandSection from "./components/BrandSection";
import FeaturesGrid from "./components/FeaturesGrid";
import NicheMarquee from "./components/NicheMarquee";
import CTASection from "./components/CTASection";
import Footer from "./components/Footer";

// `.landing-root` es el único punto de entrada de la paleta propia de
// landing (ver landing-tokens.css) — ningún otro componente de la app debe
// depender de estos tokens ni de la clase `font-display`.
export default function LandingView() {
  return (
    <div className="landing-root scroll-smooth bg-[var(--landing-canvas)] font-sans text-[var(--landing-ink)]">
      <GradientBackground />
      <Navbar />
      <main>
        <HeroSection />
        <BrandSection />
        <FeaturesGrid />
        <NicheMarquee />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
