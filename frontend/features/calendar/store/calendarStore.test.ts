import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as calendarApi from '../services/calendar-api';
import { ApiError } from '@/shared/lib/api-fetch';
import { useCalendarStore } from './calendarStore';

function resetStore() {
  useCalendarStore.setState({
    calendars: [],
    currentCalendar: null,
    viewMode: 'month',
    isLoading: false,
    isGenerating: false,
    error: null,
  });
}

beforeEach(() => {
  resetStore();
  vi.restoreAllMocks();
});

const fakeCalendarItem = {
  id: 'c1',
  name: null,
  start_date: '2026-08-03',
  end_date: '2026-08-09',
  frequency: 3,
  status: 'draft',
};

const fakeEntry = {
  id: 'e1',
  calendar_id: 'c1',
  date: '2026-08-03',
  time_slot: null,
  title: 'Post original',
  format: 'short_video',
  platform: 'instagram',
  hook: null,
  description: null,
  status: 'planned',
  google_calendar_event_id: null,
};

const fakeCalendarDetail = { ...fakeCalendarItem, entries: [fakeEntry] };

describe('loadCalendars', () => {
  it('setea isLoading true y luego false, poblando calendars', async () => {
    let resolveGetCalendars: (value: (typeof fakeCalendarItem)[]) => void;
    const promise = new Promise<(typeof fakeCalendarItem)[]>((resolve) => {
      resolveGetCalendars = resolve;
    });
    vi.spyOn(calendarApi, 'getCalendars').mockReturnValue(promise);

    const loadPromise = useCalendarStore.getState().loadCalendars();

    expect(useCalendarStore.getState().isLoading).toBe(true);

    resolveGetCalendars!([fakeCalendarItem]);
    await loadPromise;

    const state = useCalendarStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.calendars).toEqual([fakeCalendarItem]);
  });

  it('setea error si getCalendars falla', async () => {
    vi.spyOn(calendarApi, 'getCalendars').mockRejectedValue(new ApiError(500, 'boom'));

    await useCalendarStore.getState().loadCalendars();

    const state = useCalendarStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeTruthy();
  });
});

describe('loadCalendar', () => {
  it('popula currentCalendar', async () => {
    vi.spyOn(calendarApi, 'getCalendar').mockResolvedValue(fakeCalendarDetail);

    await useCalendarStore.getState().loadCalendar('c1');

    const state = useCalendarStore.getState();
    expect(state.currentCalendar).toEqual(fakeCalendarDetail);
    expect(state.isLoading).toBe(false);
  });
});

describe('generate', () => {
  it('setea isGenerating true y luego false, poblando currentCalendar en exito', async () => {
    let resolveGenerate: (value: typeof fakeCalendarDetail) => void;
    const promise = new Promise<typeof fakeCalendarDetail>((resolve) => {
      resolveGenerate = resolve;
    });
    vi.spyOn(calendarApi, 'generateCalendar').mockReturnValue(promise);

    const generatePromise = useCalendarStore.getState().generate({ period: 'current_week' });

    expect(useCalendarStore.getState().isGenerating).toBe(true);

    resolveGenerate!(fakeCalendarDetail);
    await generatePromise;

    const state = useCalendarStore.getState();
    expect(state.isGenerating).toBe(false);
    expect(state.currentCalendar).toEqual(fakeCalendarDetail);
  });

  it('setea error (no revienta) en un 409 ApiError', async () => {
    const errorBody = { detail: 'Perfil incompleto', missing_fields: ['niche'] };
    vi.spyOn(calendarApi, 'generateCalendar').mockRejectedValue(
      new ApiError(409, 'generateCalendar fallo con status 409', errorBody),
    );

    await expect(
      useCalendarStore.getState().generate({ period: 'current_week' }),
    ).resolves.not.toThrow();

    const state = useCalendarStore.getState();
    expect(state.isGenerating).toBe(false);
    expect(state.error).toBeTruthy();
  });
});

describe('updateEntry', () => {
  it('llama updateEntry y actualiza la entrada local en exito', async () => {
    useCalendarStore.setState({ currentCalendar: fakeCalendarDetail });
    const updatedEntry = { ...fakeEntry, title: 'Nuevo titulo' };
    const updateEntrySpy = vi
      .spyOn(calendarApi, 'updateEntry')
      .mockResolvedValue(updatedEntry);

    await useCalendarStore.getState().updateEntry('e1', { title: 'Nuevo titulo' });

    expect(updateEntrySpy).toHaveBeenCalledWith('c1', 'e1', { title: 'Nuevo titulo' });
    const state = useCalendarStore.getState();
    expect(state.currentCalendar?.entries[0]).toEqual(updatedEntry);
  });
});

describe('confirm', () => {
  it('llama confirmCalendar y actualiza status local en exito', async () => {
    useCalendarStore.setState({
      currentCalendar: fakeCalendarDetail,
      calendars: [fakeCalendarItem],
    });
    const confirmed = { ...fakeCalendarItem, status: 'confirmed' };
    const confirmSpy = vi.spyOn(calendarApi, 'confirmCalendar').mockResolvedValue(confirmed);

    await useCalendarStore.getState().confirm();

    expect(confirmSpy).toHaveBeenCalledWith('c1');
    const state = useCalendarStore.getState();
    expect(state.currentCalendar?.status).toBe('confirmed');
    expect(state.calendars[0].status).toBe('confirmed');
  });
});

describe('remove', () => {
  it('llama deleteCalendar y remueve el calendario del estado local en exito', async () => {
    useCalendarStore.setState({
      calendars: [fakeCalendarItem],
      currentCalendar: fakeCalendarDetail,
    });
    const removeSpy = vi.spyOn(calendarApi, 'deleteCalendar').mockResolvedValue(undefined);

    await useCalendarStore.getState().remove('c1');

    expect(removeSpy).toHaveBeenCalledWith('c1');
    const state = useCalendarStore.getState();
    expect(state.calendars).toEqual([]);
    expect(state.currentCalendar).toBeNull();
  });
});

describe('setViewMode', () => {
  it('alterna viewMode entre month y week', () => {
    expect(useCalendarStore.getState().viewMode).toBe('month');

    useCalendarStore.getState().setViewMode('week');
    expect(useCalendarStore.getState().viewMode).toBe('week');

    useCalendarStore.getState().setViewMode('month');
    expect(useCalendarStore.getState().viewMode).toBe('month');
  });
});
