"use client";

import { ReactNode } from "react";
import { useSidebar } from "./SidebarProvider";

export default function SidebarShell({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();
  return (
    <div
      className={`relative h-dvh overflow-hidden transition-[margin] duration-300 ease-out ${
        collapsed ? "lg:ml-20" : "lg:ml-64"
      }`}
    >
      {children}
    </div>
  );
}
