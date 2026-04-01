"use client";

import GradientBackground from "../landing/components/GradientBackground";
import Sidebar from "./components/Sidebar";
import MobileNav from "./components/MobileNav";
import TopBar from "./components/TopBar";
import TimelineCards from "./components/TimelineCards";
import CalendarGrid from "./components/CalendarGrid";
import GoogleSyncButton from "./components/GoogleSyncButton";
import PerformancePanel from "./components/PerformancePanel";
import ActivityPanel from "./components/ActivityPanel";
import CreatorTip from "./components/CreatorTip";

export default function CalendarView() {
  return (
    <div className="min-h-screen">
      <GradientBackground />
      <Sidebar />
      <MobileNav />

      {/* Contenido principal — desplazado por sidebar en desktop */}
      <div className="lg:pl-64">
        <TopBar />

        <div className="grid grid-cols-12 gap-6 p-5 sm:gap-8 sm:p-8 lg:p-10">
          {/* Columna central */}
          <div className="col-span-12 space-y-8 sm:space-y-10 lg:col-span-9">
            <TimelineCards />
            <CalendarGrid />
          </div>

          {/* Sidebar derecho */}
          <aside className="col-span-12 space-y-6 sm:space-y-8 lg:col-span-3">
            <GoogleSyncButton />
            <PerformancePanel />
            <ActivityPanel />
            <CreatorTip />
          </aside>
        </div>
      </div>
    </div>
  );
}
