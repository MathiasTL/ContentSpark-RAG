import fs from "node:fs";
import path from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CalendarView from "../CalendarView";
import { useCalendarStore } from "../store/calendarStore";
import TimelineCards from "./TimelineCards";

vi.mock("@/shared/lib/supabase", () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: null } }),
    },
  }),
}));

const NOW = new Date("2026-08-03T10:00:00");

function resetStore(entries: unknown[] = []) {
  useCalendarStore.setState({
    calendars: [],
    currentCalendar: {
      id: "c1",
      name: null,
      start_date: "2026-08-03",
      end_date: "2026-08-09",
      frequency: 3,
      status: "draft",
      entries: entries as never,
    },
    viewMode: "month",
    isLoading: false,
    isGenerating: false,
    error: null,
  });
}

const withinWindowEntry = {
  id: "e1",
  calendar_id: "c1",
  date: "2026-08-04",
  time_slot: "morning",
  title: "Estrategia de hooks para retener audiencia",
  format: "short_video",
  platform: "instagram",
  hook: null,
  description: "Técnicas de retención en los primeros 3 segundos.",
  status: "idea",
  google_calendar_event_id: null,
};

const outsideWindowEntry = {
  ...withinWindowEntry,
  id: "e2",
  date: "2026-08-10",
  title: "Fuera de la ventana de 48h",
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("TimelineCards — código fuente", () => {
  it("no contiene el array sampleCards hardcodeado", () => {
    const source = fs.readFileSync(path.join(__dirname, "TimelineCards.tsx"), "utf-8");
    expect(source).not.toMatch(/sampleCards/);
  });
});

describe("TimelineCards — render", () => {
  it("renderiza exactamente las entries del calendario actual dentro de las próximas 48h", () => {
    resetStore([withinWindowEntry, outsideWindowEntry]);

    render(<TimelineCards />);

    expect(
      screen.getByText("Estrategia de hooks para retener audiencia"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Fuera de la ventana de 48h")).not.toBeInTheDocument();
  });

  it("no muestra datos hardcodeados de las tarjetas de ejemplo previas", () => {
    resetStore([withinWindowEntry]);

    render(<TimelineCards />);

    expect(screen.queryByText(/hilo: algoritmo de tiktok/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tutorial: edición con capcut/i)).not.toBeInTheDocument();
  });

  it("una entry con un time_slot real del backend ('morning'/'afternoon'/'evening') aparece en el timeline de 48h", () => {
    // Regression: the backend's format_calendar assigns time_slot from the
    // semantic TIME_SLOTS labels, never clock times. Parsing the label
    // directly as "${date}T${time_slot}:00" used to yield an Invalid Date
    // for every real entry, making isWithinNextWindow always false and the
    // timeline permanently empty for any real calendar.
    resetStore([
      { ...withinWindowEntry, time_slot: "afternoon" },
      { ...withinWindowEntry, id: "e3", time_slot: "evening" },
    ]);

    render(<TimelineCards />);

    expect(
      screen.getAllByText("Estrategia de hooks para retener audiencia"),
    ).toHaveLength(2);
  });

  it("no renderiza ninguna entry cuando no hay calendario activo", () => {
    useCalendarStore.setState({
      calendars: [],
      currentCalendar: null,
      viewMode: "month",
      isLoading: false,
      isGenerating: false,
      error: null,
    });

    render(<TimelineCards />);

    expect(screen.queryByRole("button", { name: /más opciones/i })).not.toBeInTheDocument();
  });
});

describe("TimelineCards — edición", () => {
  it('el botón "más opciones" llama a onEditEntry con el id de la entry', () => {
    resetStore([withinWindowEntry]);
    const onEditEntry = vi.fn();

    render(<TimelineCards onEditEntry={onEditEntry} />);

    fireEvent.click(screen.getByRole("button", { name: /más opciones/i }));

    expect(onEditEntry).toHaveBeenCalledWith("e1");
  });

  it('el botón "más opciones" abre el EntryEditModal real cuando se compone en CalendarView', () => {
    resetStore([withinWindowEntry]);

    render(<CalendarView />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /más opciones/i }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText(/título/i)).toHaveValue(withinWindowEntry.title);
  });
});
