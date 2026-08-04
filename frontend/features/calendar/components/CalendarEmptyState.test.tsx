import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCalendarStore } from "../store/calendarStore";
import CalendarEmptyState from "./CalendarEmptyState";

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
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CalendarEmptyState — visibilidad", () => {
  it("se renderiza cuando calendars.length === 0", () => {
    render(<CalendarEmptyState />);

    expect(screen.getByRole("heading")).toBeInTheDocument();
  });

  it("se renderiza cuando la última llamada a generate() resolvió un 409 (errorStatus)", () => {
    resetStore({
      calendars: [
        {
          id: "c1",
          name: null,
          start_date: "2026-08-01",
          end_date: "2026-08-31",
          frequency: 3,
          status: "draft",
        },
      ],
      error: "generateCalendar fallo con status 409",
      errorStatus: 409,
    });

    render(<CalendarEmptyState />);

    expect(screen.getByRole("heading")).toBeInTheDocument();
  });

  it("no se renderiza cuando hay calendarios y no hubo error 409", () => {
    resetStore({
      calendars: [
        {
          id: "c1",
          name: null,
          start_date: "2026-08-01",
          end_date: "2026-08-31",
          frequency: 3,
          status: "draft",
        },
      ],
    });

    render(<CalendarEmptyState />);

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("NO se renderiza cuando hay calendarios y el mensaje de error menciona '409' pero errorStatus no es 409 (regresion del substring-match)", () => {
    resetStore({
      calendars: [
        {
          id: "c1",
          name: null,
          start_date: "2026-08-01",
          end_date: "2026-08-31",
          frequency: 3,
          status: "draft",
        },
      ],
      error: "updateEntry fallo con status 422: campo status invalido (permitidos: idea, drafted, recorded, published; ver issue #409)",
      errorStatus: 422,
    });

    render(<CalendarEmptyState />);

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});

describe("CalendarEmptyState — CTA", () => {
  it("el CTA enlaza a /onboarding", () => {
    render(<CalendarEmptyState />);

    expect(screen.getByRole("link")).toHaveAttribute("href", "/onboarding");
  });

  it("no llama automáticamente al endpoint de generación al renderizar", () => {
    const generateSpy = vi.fn();
    useCalendarStore.setState({ generate: generateSpy });

    render(<CalendarEmptyState />);

    expect(generateSpy).not.toHaveBeenCalled();
  });
});
