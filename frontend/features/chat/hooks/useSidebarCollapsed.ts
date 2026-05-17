"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "chat-sidebar-collapsed";

export function useSidebarCollapsed(defaultValue = false): {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (value: boolean) => void;
} {
  const [collapsed, setCollapsedState] = useState<boolean>(defaultValue);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw !== null) setCollapsedState(raw === "true");
    } catch {
      // localStorage no disponible — ignorar
    }
  }, []);

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // ignorar
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignorar
      }
      return next;
    });
  }, []);

  return { collapsed, toggle, setCollapsed };
}
