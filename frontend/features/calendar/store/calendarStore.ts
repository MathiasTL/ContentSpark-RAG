import { create } from "zustand";
import { ApiError } from "@/shared/lib/api-fetch";
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
  // Codigo de status HTTP del ultimo error, cuando proviene de un
  // ApiError (ver shared/lib/api-fetch). Null si no hubo error o si el
  // error no trajo un status tipado. Usado para distinguir el rechazo
  // 409 del soft gate (content-calendar-ui / Empty State with
  // Onboarding CTA) de cualquier otro error sin depender de un match de
  // substring sobre el mensaje.
  errorStatus: number | null;

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
  errorStatus: null,

  setViewMode: (mode) => set({ viewMode: mode }),

  loadCalendars: async () => {
    set({ isLoading: true, error: null, errorStatus: null });
    try {
      const calendars = await calendarApi.getCalendars();
      set({ calendars, isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "No se pudieron cargar los calendarios",
        errorStatus: err instanceof ApiError ? err.status : null,
      });
    }
  },

  loadCalendar: async (id) => {
    set({ isLoading: true, error: null, errorStatus: null });
    try {
      const currentCalendar = await calendarApi.getCalendar(id);
      set({ currentCalendar, isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "No se pudo cargar el calendario",
        errorStatus: err instanceof ApiError ? err.status : null,
      });
    }
  },

  generate: async (input) => {
    set({ isGenerating: true, error: null, errorStatus: null });
    try {
      const currentCalendar = await calendarApi.generateCalendar(input);
      set({ currentCalendar, isGenerating: false });
    } catch (err) {
      set({
        isGenerating: false,
        error: err instanceof Error ? err.message : "No se pudo generar el calendario",
        errorStatus: err instanceof ApiError ? err.status : null,
      });
    }
  },

  updateEntry: async (entryId, partial) => {
    const calendarId = get().currentCalendar?.id;
    if (!calendarId) return;
    set({ error: null, errorStatus: null });
    try {
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
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "No se pudo actualizar la entrada",
        errorStatus: err instanceof ApiError ? err.status : null,
      });
    }
  },

  confirm: async () => {
    const calendarId = get().currentCalendar?.id;
    if (!calendarId) return;
    set({ error: null, errorStatus: null });
    try {
      const updated = await calendarApi.confirmCalendar(calendarId);
      set((state) =>
        state.currentCalendar
          ? {
              currentCalendar: { ...state.currentCalendar, status: updated.status },
              calendars: state.calendars.map((c) => (c.id === updated.id ? updated : c)),
            }
          : state,
      );
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "No se pudo confirmar el calendario",
        errorStatus: err instanceof ApiError ? err.status : null,
      });
    }
  },

  remove: async (id) => {
    set({ error: null, errorStatus: null });
    try {
      await calendarApi.deleteCalendar(id);
      set((state) => ({
        calendars: state.calendars.filter((c) => c.id !== id),
        currentCalendar: state.currentCalendar?.id === id ? null : state.currentCalendar,
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "No se pudo eliminar el calendario",
        errorStatus: err instanceof ApiError ? err.status : null,
      });
    }
  },
}));
