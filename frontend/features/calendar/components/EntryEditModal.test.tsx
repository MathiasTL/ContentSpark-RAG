import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EntryItem } from "../services/calendar-api";
import { useCalendarStore } from "../store/calendarStore";
import EntryEditModal from "./EntryEditModal";

const entry: EntryItem = {
  id: "e1",
  calendar_id: "c1",
  date: "2026-08-05",
  time_slot: "morning",
  title: "IG: Reel matutino",
  format: "short_video",
  platform: "instagram",
  hook: "Hook original",
  description: "Descripción original",
  status: "idea",
  google_calendar_event_id: null,
};

function resetStore(overrides: Partial<ReturnType<typeof useCalendarStore.getState>> = {}) {
  useCalendarStore.setState({
    calendars: [],
    currentCalendar: {
      id: "c1",
      name: null,
      start_date: "2026-08-01",
      end_date: "2026-08-31",
      frequency: 3,
      status: "draft",
      entries: [entry],
    },
    viewMode: "month",
    isLoading: false,
    isGenerating: false,
    error: null,
    ...overrides,
  });
}

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EntryEditModal — formulario pre-rellenado", () => {
  it("renderiza un formulario con los campos editables pre-rellenados desde la entry", () => {
    render(<EntryEditModal entry={entry} onClose={() => {}} />);

    expect(screen.getByLabelText(/título/i)).toHaveValue("IG: Reel matutino");
    expect(screen.getByLabelText(/hook/i)).toHaveValue("Hook original");
    expect(screen.getByLabelText(/descripción/i)).toHaveValue("Descripción original");
    expect(screen.getByLabelText(/formato/i)).toHaveValue("short_video");
    expect(screen.getByLabelText(/plataforma/i)).toHaveValue("instagram");
    expect(screen.getByLabelText(/estado/i)).toHaveValue("idea");
    expect(screen.getByLabelText(/horario/i)).toHaveValue("morning");
  });
});

describe("EntryEditModal — guardado", () => {
  it("al enviar, llama a calendarStore.updateEntry con solo los campos cambiados", () => {
    const updateEntrySpy = vi.fn().mockResolvedValue(undefined);
    useCalendarStore.setState({ updateEntry: updateEntrySpy });

    render(<EntryEditModal entry={entry} onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText(/título/i), {
      target: { value: "IG: Reel actualizado" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(updateEntrySpy).toHaveBeenCalledWith("e1", { title: "IG: Reel actualizado" });
  });
});

describe("EntryEditModal — independiente del estado del calendario", () => {
  it("el modal es funcional cuando el calendario padre está confirmado", () => {
    resetStore({
      currentCalendar: {
        id: "c1",
        name: null,
        start_date: "2026-08-01",
        end_date: "2026-08-31",
        frequency: 3,
        status: "confirmed",
        entries: [entry],
      },
    });

    render(<EntryEditModal entry={entry} onClose={() => {}} />);

    const saveButton = screen.getByRole("button", { name: /guardar/i });
    expect(saveButton).not.toBeDisabled();
    expect(screen.getByLabelText(/título/i)).not.toBeDisabled();
  });
});
