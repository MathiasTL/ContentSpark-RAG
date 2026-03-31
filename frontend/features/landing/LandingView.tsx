"use client";

import GradientBackground from "./components/GradientBackground";
import Navbar from "./components/Navbar";
import HeroSection from "./components/HeroSection";
import FeaturesGrid from "./components/FeaturesGrid";
import BrandSection from "./components/BrandSection";
import CTASection from "./components/CTASection";
import Footer from "./components/Footer";

export default function LandingView() {
  return (
    <div className="scroll-smooth">
      <GradientBackground />
      <Navbar />
      <main>
        <HeroSection />
        <FeaturesGrid />
        <BrandSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
