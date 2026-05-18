"use client";

import { useEffect } from "react";
import { create } from "zustand";

const STORAGE_KEY = "chat-sidebar-collapsed";

interface SidebarState {
  collapsed: boolean;
  hydrated: boolean;
  setCollapsed: (value: boolean) => void;
  toggle: () => void;
  hydrate: () => void;
}

const useSidebarStore = create<SidebarState>((set, get) => ({
  collapsed: false,
  hydrated: false,
  setCollapsed: (value) => {
    set({ collapsed: value });
    try {
      window.localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // ignorar
    }
  },
  toggle: () => {
    const next = !get().collapsed;
    set({ collapsed: next });
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // ignorar
    }
  },
  hydrate: () => {
    if (get().hydrated) return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      set({ collapsed: raw === "true", hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
}));

export function useSidebarCollapsed(): {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (value: boolean) => void;
} {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggle = useSidebarStore((s) => s.toggle);
  const setCollapsed = useSidebarStore((s) => s.setCollapsed);
  const hydrate = useSidebarStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return { collapsed, toggle, setCollapsed };
}
