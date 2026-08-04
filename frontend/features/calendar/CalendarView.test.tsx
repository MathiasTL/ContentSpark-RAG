import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EntryItem } from "./services/calendar-api";
import { useCalendarStore } from "./store/calendarStore";
import CalendarView from "./CalendarView";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const entry: EntryItem = {
  id: "e1",
  calendar_id: "c1",
  date: "2026-08-05",
  time_slot: "09:00",
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
    currentCalendar: null,
    viewMode: "month",
    isLoading: false,
    isGenerating: false,
    error: null,
    errorStatus: null,
    ...overrides,
  });
}

beforeEach(() => {
  resetStore();
  pushMock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CalendarView — carga inicial", () => {
  it("carga calendarStore.loadCalendars al montar", () => {
    const loadCalendarsSpy = vi.fn().mockResolvedValue(undefined);
    useCalendarStore.setState({ loadCalendars: loadCalendarsSpy });

    render(<CalendarView />);

    expect(loadCalendarsSpy).toHaveBeenCalledTimes(1);
  });
});

describe("CalendarView — composición con calendario existente", () => {
  it("compone GenerateControl, ConfirmBar y el modal de edición cuando hay un calendario con entradas", () => {
    resetStore({
      calendars: [
        {
          id: "c1",
          name: null,
          start_date: "2026-08-01",
          end_date: "2026-08-31",
          frequency: 3,
          status: "draft",
          entries: [entry],
        } as never,
      ],
      currentCalendar: {
        id: "c1",
        name: null,
        start_date: "2026-08-01",
        end_date: "2026-08-31",
        frequency: 3,
        status: "draft",
        entries: [entry],
      },
    });

    render(<CalendarView />);

    expect(screen.getByRole("heading", { name: /generar calendario/i })).toBeInTheDocument();
    expect(screen.getByText("Borrador")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("abre el modal de edición de entrada al elegir editar una entrada del grid", () => {
    resetStore({
      calendars: [
        {
          id: "c1",
          name: null,
          start_date: "2026-08-01",
          end_date: "2026-08-31",
          frequency: 3,
          status: "draft",
        } as never,
      ],
      currentCalendar: {
        id: "c1",
        name: null,
        start_date: "2026-08-01",
        end_date: "2026-08-31",
        frequency: 3,
        status: "draft",
        entries: [entry],
      },
    });

    render(<CalendarView />);

    const editButton = screen.getByRole("button", { name: /editar ig: reel matutino/i });
    fireEvent.click(editButton);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText(/título/i)).toHaveValue("IG: Reel matutino");
  });
});

describe("CalendarView — soft gate sin calendarios", () => {
  it("muestra CalendarEmptyState en lugar del timeline cuando no hay calendarios", () => {
    resetStore({ calendars: [], currentCalendar: null });

    render(<CalendarView />);

    expect(screen.getByRole("link", { name: /completar perfil/i })).toHaveAttribute(
      "href",
      "/onboarding",
    );
    expect(screen.queryByText(/visual timeline/i)).not.toBeInTheDocument();
  });

  it("un usuario con perfil incompleto que visita /calendar ve CalendarEmptyState y no es redirigido", () => {
    resetStore({ calendars: [], currentCalendar: null });

    render(<CalendarView />);

    expect(screen.getByRole("link", { name: /completar perfil/i })).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("NO muestra CalendarEmptyState cuando hay calendarios y errorStatus no es 409, aun si el mensaje de error menciona '409'", () => {
    resetStore({
      calendars: [
        {
          id: "c1",
          name: null,
          start_date: "2026-08-01",
          end_date: "2026-08-31",
          frequency: 3,
          status: "draft",
        } as never,
      ],
      currentCalendar: null,
      error: "updateEntry fallo con status 422 (ver issue #409)",
      errorStatus: 422,
    });

    render(<CalendarView />);

    expect(screen.queryByRole("link", { name: /completar perfil/i })).not.toBeInTheDocument();
  });
});
