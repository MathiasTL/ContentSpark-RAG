"use client";

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
      <div>
        <TopBar />

        <div className="grid grid-cols-12 gap-6 p-5 pb-24 sm:gap-8 sm:p-8 sm:pb-24 lg:p-10 lg:pb-10">
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
