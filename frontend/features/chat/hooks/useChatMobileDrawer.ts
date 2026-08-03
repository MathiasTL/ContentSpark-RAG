import { create } from "zustand";

// Estado del drawer de conversaciones en mobile. Es independiente del
// estado de colapso de escritorio (useSidebarCollapsed): ChatSidebar
// está `hidden lg:flex`, así que en mobile necesitamos una superficie
// propia (overlay) con su propio open/close, sin persistencia — es una
// preferencia de sesión, no de usuario.
interface ChatMobileDrawerState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useChatMobileDrawer = create<ChatMobileDrawerState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));
