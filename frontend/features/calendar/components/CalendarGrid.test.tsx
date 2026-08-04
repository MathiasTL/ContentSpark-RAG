import fs from "node:fs";
import path from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCalendarStore } from "../store/calendarStore";
import CalendarGrid from "./CalendarGrid";

function resetStore(overrides: Partial<ReturnType<typeof useCalendarStore.getState>> = {}) {
  useCalendarStore.setState({
    calendars: [],
    currentCalendar: null,
    viewMode: "month",
    isLoading: false,
    isGenerating: false,
    error: null,
    ...overrides,
  });
}

const fakeEntry = {
  id: "e1",
  calendar_id: "c1",
  date: "2026-08-05",
  time_slot: "09:00",
  title: "IG: Reel matutino",
  format: "short_video",
  platform: "instagram",
  hook: null,
  description: null,
  status: "idea",
  google_calendar_event_id: null,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-03T10:00:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CalendarGrid — código fuente", () => {
  it("no contiene events/Octubre 2024/FIRST_DAY_OFFSET hardcodeados", () => {
    const source = fs.readFileSync(path.join(__dirname, "CalendarGrid.tsx"), "utf-8");
    expect(source).not.toMatch(/\bconst events\b/);
    expect(source).not.toMatch(/Octubre 2024/);
    expect(source).not.toMatch(/FIRST_DAY_OFFSET/);
  });
});

describe("CalendarGrid — mes derivado del calendario activo", () => {
  it("ancla el header en el mes del calendario activo, no en un mes fijo", () => {
    resetStore({
      currentCalendar: {
        id: "c1",
        name: null,
        start_date: "2026-08-01",
        end_date: "2026-08-31",
        frequency: 3,
        status: "draft",
        entries: [fakeEntry as never],
      },
    });

    render(<CalendarGrid />);

    expect(screen.getByText("Agosto 2026")).toBeInTheDocument();
    expect(screen.queryByText("Octubre 2024")).not.toBeInTheDocument();
  });

  it("sin calendario activo, ancla el header en el mes real del sistema", () => {
    resetStore({ currentCalendar: null });

    render(<CalendarGrid />);

    expect(screen.getByText("Agosto 2026")).toBeInTheDocument();
  });
});

describe("CalendarGrid — vista semana vs mes", () => {
  it("renderiza una fila de 7 celdas en modo semana", () => {
    resetStore({
      viewMode: "week",
      currentCalendar: {
        id: "c1",
        name: null,
        start_date: "2026-08-01",
        end_date: "2026-08-31",
        frequency: 3,
        status: "draft",
        entries: [],
      },
    });

    const { container } = render(<CalendarGrid />);

    expect(container.querySelectorAll('[data-testid^="calendar-cell-"]')).toHaveLength(7);
  });

  it("renderiza el grid completo del mes en modo mes (más de 7 celdas)", () => {
    resetStore({
      viewMode: "month",
      currentCalendar: {
        id: "c1",
        name: null,
        start_date: "2026-08-01",
        end_date: "2026-08-31",
        frequency: 3,
        status: "draft",
        entries: [],
      },
    });

    const { container } = render(<CalendarGrid />);

    expect(
      container.querySelectorAll('[data-testid^="calendar-cell-"]').length,
    ).toBeGreaterThan(7);
  });
});

describe("CalendarGrid — edición", () => {
  it("clic en un chip de entry llama a onEditEntry con el id", () => {
    resetStore({
      currentCalendar: {
        id: "c1",
        name: null,
        start_date: "2026-08-01",
        end_date: "2026-08-31",
        frequency: 3,
        status: "draft",
        entries: [fakeEntry as never],
      },
    });
    const onEditEntry = vi.fn();

    render(<CalendarGrid onEditEntry={onEditEntry} />);

    fireEvent.click(screen.getByRole("button", { name: /editar ig: reel matutino/i }));

    expect(onEditEntry).toHaveBeenCalledWith("e1");
  });
});
