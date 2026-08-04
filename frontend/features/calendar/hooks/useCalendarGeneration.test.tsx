import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as calendarApi from "../services/calendar-api";
import { useCalendarStore } from "../store/calendarStore";
import { useCalendarGeneration } from "./useCalendarGeneration";

function resetStore() {
  useCalendarStore.setState({
    calendars: [],
    currentCalendar: null,
    viewMode: "month",
    isLoading: false,
    isGenerating: false,
    error: null,
  });
}

beforeEach(() => {
  resetStore();
  vi.restoreAllMocks();
});

const fakeCalendarDetail = {
  id: "c1",
  name: null,
  start_date: "2026-08-03",
  end_date: "2026-08-09",
  frequency: 3,
  status: "draft",
  entries: [],
};

describe("draft state", () => {
  it("mantiene period/frequency/formats en un draft local antes de submit", () => {
    const { result } = renderHook(() => useCalendarGeneration());

    expect(result.current.draft.period).toBe("current_week");
    expect(result.current.draft.frequency).toBeNull();
    expect(result.current.draft.formats).toBeNull();

    act(() => {
      result.current.updateDraft({ period: "month", frequency: 5 });
    });

    expect(result.current.draft.period).toBe("month");
    expect(result.current.draft.frequency).toBe(5);
  });
});

describe("submit", () => {
  it("llama calendarStore.generate con el GenerateInput ensamblado del draft", async () => {
    const generateCalendarSpy = vi
      .spyOn(calendarApi, "generateCalendar")
      .mockResolvedValue(fakeCalendarDetail);

    const { result } = renderHook(() => useCalendarGeneration());

    act(() => {
      result.current.updateDraft({
        period: "month",
        frequency: 4,
        formats: { short_video: 3 },
      });
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(generateCalendarSpy).toHaveBeenCalledWith({
      period: "month",
      frequency: 4,
      formats: { short_video: 3 },
    });
    expect(useCalendarStore.getState().currentCalendar).toEqual(fakeCalendarDetail);
  });

  it('omite frequency/formats cuando quedan sin definir ("period only")', async () => {
    const generateCalendarSpy = vi
      .spyOn(calendarApi, "generateCalendar")
      .mockResolvedValue(fakeCalendarDetail);

    const { result } = renderHook(() => useCalendarGeneration());

    await act(async () => {
      await result.current.submit();
    });

    expect(generateCalendarSpy).toHaveBeenCalledWith({ period: "current_week" });
    const calledInput = generateCalendarSpy.mock.calls[0][0];
    expect(calledInput).not.toHaveProperty("frequency");
    expect(calledInput).not.toHaveProperty("formats");
  });
});
