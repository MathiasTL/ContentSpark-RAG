import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCalendarStore } from "../store/calendarStore";
import GenerateControl from "./GenerateControl";

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

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GenerateControl — controles", () => {
  it("renderiza un selector de periodo con las 3 opciones", () => {
    render(<GenerateControl />);

    const select = screen.getByLabelText(/periodo/i);
    const options = Array.from(select.querySelectorAll("option")).map((o) => o.getAttribute("value"));

    expect(options).toEqual(["current_week", "next_week", "month"]);
  });

  it("renderiza un input de frecuencia", () => {
    render(<GenerateControl />);

    expect(screen.getByLabelText(/frecuencia/i)).toBeInTheDocument();
  });

  it("el input de frecuencia respeta los mismos límites que CalendarGenerateRequest.frequency (ge=1, le=14)", () => {
    render(<GenerateControl />);

    const input = screen.getByLabelText(/frecuencia/i);
    expect(input).toHaveAttribute("min", "1");
    expect(input).toHaveAttribute("max", "14");
  });

  it("renderiza inputs de cantidad por formato", () => {
    render(<GenerateControl />);

    expect(screen.getByLabelText(/video corto/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/carrusel/i)).toBeInTheDocument();
  });
});

describe("GenerateControl — envío", () => {
  it("enviar solo con el periodo llama a generate con {period} y sin frequency/formats", async () => {
    const generateSpy = vi.fn().mockResolvedValue(undefined);
    useCalendarStore.setState({ generate: generateSpy });

    render(<GenerateControl />);

    fireEvent.click(screen.getByRole("button", { name: /generar con ai/i }));

    expect(generateSpy).toHaveBeenCalledTimes(1);
    const callArg = generateSpy.mock.calls[0][0];
    expect(callArg).toEqual({ period: "current_week" });
    expect(callArg).not.toHaveProperty("frequency");
    expect(callArg).not.toHaveProperty("formats");
  });

  it("enviar con frequency y formats explícitos los incluye en la llamada", async () => {
    const generateSpy = vi.fn().mockResolvedValue(undefined);
    useCalendarStore.setState({ generate: generateSpy });

    render(<GenerateControl />);

    fireEvent.change(screen.getByLabelText(/frecuencia/i), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText(/video corto/i), { target: { value: "2" } });

    fireEvent.click(screen.getByRole("button", { name: /generar con ai/i }));

    expect(generateSpy).toHaveBeenCalledTimes(1);
    const callArg = generateSpy.mock.calls[0][0];
    expect(callArg.frequency).toBe(4);
    expect(callArg.formats).toEqual({ short_video: 2 });
  });
});

describe("GenerateControl — error", () => {
  it("muestra el mensaje de error del store cuando la generación falla", () => {
    resetStore({ error: "No se pudo generar el calendario" });

    render(<GenerateControl />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "No se pudo generar el calendario",
    );
  });

  it("no muestra ninguna alerta cuando no hay error", () => {
    render(<GenerateControl />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("GenerateControl — estado de carga", () => {
  it('el botón "Generar con AI" está deshabilitado y muestra estado de carga mientras isGenerating es true', () => {
    resetStore({ isGenerating: true });

    render(<GenerateControl />);

    const button = screen.getByRole("button", { name: /generando/i });
    expect(button).toBeDisabled();
  });
});
