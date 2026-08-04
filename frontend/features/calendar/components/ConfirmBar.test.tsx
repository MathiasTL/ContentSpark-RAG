import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCalendarStore } from "../store/calendarStore";
import ConfirmBar from "./ConfirmBar";

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
      entries: [],
    },
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

describe("ConfirmBar — badge de estado", () => {
  it.each([
    ["draft", "Borrador"],
    ["confirmed", "Confirmado"],
    ["synced", "Sincronizado"],
  ])("renderiza el badge de estado para %s", (status, label) => {
    resetStore({
      currentCalendar: {
        id: "c1",
        name: null,
        start_date: "2026-08-01",
        end_date: "2026-08-31",
        frequency: 3,
        status,
        entries: [],
      },
    });

    render(<ConfirmBar />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

describe("ConfirmBar — confirmar", () => {
  it('el botón "Confirmar calendario" llama a calendarStore.confirm', () => {
    const confirmSpy = vi.fn().mockResolvedValue(undefined);
    useCalendarStore.setState({ confirm: confirmSpy });

    render(<ConfirmBar />);

    fireEvent.click(screen.getByRole("button", { name: /confirmar calendario/i }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
  });

  it("el botón de confirmar está deshabilitado cuando el estado no es draft", () => {
    resetStore({
      currentCalendar: {
        id: "c1",
        name: null,
        start_date: "2026-08-01",
        end_date: "2026-08-31",
        frequency: 3,
        status: "confirmed",
        entries: [],
      },
    });

    render(<ConfirmBar />);

    expect(screen.getByRole("button", { name: /confirmar calendario/i })).toBeDisabled();
  });
});

describe("ConfirmBar — eliminar", () => {
  it("la acción de eliminar llama a calendarStore.remove con el id del calendario", () => {
    const removeSpy = vi.fn().mockResolvedValue(undefined);
    useCalendarStore.setState({ remove: removeSpy });

    render(<ConfirmBar />);

    fireEvent.click(screen.getByRole("button", { name: /eliminar calendario/i }));

    expect(removeSpy).toHaveBeenCalledWith("c1");
  });

  it("la acción de eliminar está deshabilitada cuando el estado es synced", () => {
    resetStore({
      currentCalendar: {
        id: "c1",
        name: null,
        start_date: "2026-08-01",
        end_date: "2026-08-31",
        frequency: 3,
        status: "synced",
        entries: [],
      },
    });

    render(<ConfirmBar />);

    expect(screen.getByRole("button", { name: /eliminar calendario/i })).toBeDisabled();
  });
});
