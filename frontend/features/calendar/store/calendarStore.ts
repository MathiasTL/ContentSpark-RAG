import { create } from "zustand";
import type {
  CalendarDetail,
  CalendarItem,
  EntryUpdateInput,
  GenerateInput,
} from "../services/calendar-api";
import * as calendarApi from "../services/calendar-api";

export interface CalendarState {
  calendars: CalendarItem[];
  currentCalendar: CalendarDetail | null;
  viewMode: "month" | "week";
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;

  setViewMode: (mode: "month" | "week") => void;
  loadCalendars: () => Promise<void>;
  loadCalendar: (id: string) => Promise<void>;
  generate: (input: GenerateInput) => Promise<void>;
  updateEntry: (entryId: string, partial: EntryUpdateInput) => Promise<void>;
  confirm: () => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  calendars: [],
  currentCalendar: null,
  viewMode: "month",
  isLoading: false,
  isGenerating: false,
  error: null,

  setViewMode: (mode) => set({ viewMode: mode }),

  loadCalendars: async () => {
    set({ isLoading: true, error: null });
    try {
      const calendars = await calendarApi.getCalendars();
      set({ calendars, isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "No se pudieron cargar los calendarios",
      });
    }
  },

  loadCalendar: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const currentCalendar = await calendarApi.getCalendar(id);
      set({ currentCalendar, isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "No se pudo cargar el calendario",
      });
    }
  },

  generate: async (input) => {
    set({ isGenerating: true, error: null });
    try {
      const currentCalendar = await calendarApi.generateCalendar(input);
      set({ currentCalendar, isGenerating: false });
    } catch (err) {
      set({
        isGenerating: false,
        error: err instanceof Error ? err.message : "No se pudo generar el calendario",
      });
    }
  },

  updateEntry: async (entryId, partial) => {
    const calendarId = get().currentCalendar?.id;
    if (!calendarId) return;
    const entry = await calendarApi.updateEntry(calendarId, entryId, partial);
    set((state) =>
      state.currentCalendar
        ? {
            currentCalendar: {
              ...state.currentCalendar,
              entries: state.currentCalendar.entries.map((e) =>
                e.id === entry.id ? entry : e,
              ),
            },
          }
        : state,
    );
  },

  confirm: async () => {
    const calendarId = get().currentCalendar?.id;
    if (!calendarId) return;
    const updated = await calendarApi.confirmCalendar(calendarId);
    set((state) =>
      state.currentCalendar
        ? {
            currentCalendar: { ...state.currentCalendar, status: updated.status },
            calendars: state.calendars.map((c) => (c.id === updated.id ? updated : c)),
          }
        : state,
    );
  },

  remove: async (id) => {
    await calendarApi.deleteCalendar(id);
    set((state) => ({
      calendars: state.calendars.filter((c) => c.id !== id),
      currentCalendar: state.currentCalendar?.id === id ? null : state.currentCalendar,
    }));
  },
}));
