import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiFetchModule from '@/shared/lib/api-fetch';
import { ApiError } from '@/shared/lib/api-fetch';
import {
  confirmCalendar,
  deleteCalendar,
  generateCalendar,
  getCalendar,
  getCalendars,
  updateEntry,
} from './calendar-api';

function mockResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('getCalendars', () => {
  it('llama apiFetch con GET /api/calendars y retorna el JSON parseado', async () => {
    const calendars = [
      { id: 'c1', name: null, start_date: '2026-08-03', end_date: '2026-08-09', frequency: 3, status: 'draft' },
    ];
    const apiFetchSpy = vi
      .spyOn(apiFetchModule, 'apiFetch')
      .mockResolvedValue(mockResponse(calendars));

    const result = await getCalendars();

    expect(apiFetchSpy).toHaveBeenCalledWith('/api/calendars', { method: 'GET' });
    expect(result).toEqual(calendars);
  });

  it('lanza ApiError si la respuesta no es ok', async () => {
    vi.spyOn(apiFetchModule, 'apiFetch').mockResolvedValue(mockResponse({}, false, 500));

    await expect(getCalendars()).rejects.toThrow(ApiError);
  });
});

describe('getCalendar', () => {
  it('llama apiFetch con GET /api/calendars/{id} y retorna el JSON parseado', async () => {
    const calendar = {
      id: 'c1',
      name: null,
      start_date: '2026-08-03',
      end_date: '2026-08-09',
      frequency: 3,
      status: 'draft',
      entries: [],
    };
    const apiFetchSpy = vi
      .spyOn(apiFetchModule, 'apiFetch')
      .mockResolvedValue(mockResponse(calendar));

    const result = await getCalendar('c1');

    expect(apiFetchSpy).toHaveBeenCalledWith('/api/calendars/c1', { method: 'GET' });
    expect(result).toEqual(calendar);
  });

  it('lanza ApiError si la respuesta no es ok', async () => {
    vi.spyOn(apiFetchModule, 'apiFetch').mockResolvedValue(mockResponse({}, false, 404));

    await expect(getCalendar('c1')).rejects.toThrow(ApiError);
  });
});

describe('generateCalendar', () => {
  it('llama apiFetch con POST /api/calendar/generate y el body dado', async () => {
    const input = { period: 'current_week' as const };
    const generated = {
      id: 'c1',
      name: null,
      start_date: '2026-08-03',
      end_date: '2026-08-09',
      frequency: 3,
      status: 'draft',
      entries: [],
    };
    const apiFetchSpy = vi
      .spyOn(apiFetchModule, 'apiFetch')
      .mockResolvedValue(mockResponse(generated));

    const result = await generateCalendar(input);

    expect(apiFetchSpy).toHaveBeenCalledWith('/api/calendar/generate', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    expect(result).toEqual(generated);
  });

  it('lanza ApiError si la respuesta no es ok', async () => {
    vi.spyOn(apiFetchModule, 'apiFetch').mockResolvedValue(mockResponse({}, false, 500));

    await expect(generateCalendar({ period: 'current_week' })).rejects.toThrow(ApiError);
  });

  it('en un 409 expone missing_fields en el ApiError, distinto de un error generico', async () => {
    const errorBody = { detail: 'Perfil incompleto', missing_fields: ['niche', 'tone'] };
    vi.spyOn(apiFetchModule, 'apiFetch').mockResolvedValue(mockResponse(errorBody, false, 409));

    let caught: unknown;
    try {
      await generateCalendar({ period: 'current_week' });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiError);
    const apiError = caught as ApiError;
    expect(apiError.status).toBe(409);
    expect(apiError.body).toEqual(errorBody);
  });
});

describe('updateEntry', () => {
  it('llama apiFetch con PUT .../entries/{entryId} y el partial dado', async () => {
    const partial = { title: 'Nuevo titulo' };
    const updated = {
      id: 'e1',
      calendar_id: 'c1',
      date: '2026-08-03',
      time_slot: null,
      title: 'Nuevo titulo',
      format: 'short_video',
      platform: 'instagram',
      hook: null,
      description: null,
      status: 'planned',
      google_calendar_event_id: null,
    };
    const apiFetchSpy = vi
      .spyOn(apiFetchModule, 'apiFetch')
      .mockResolvedValue(mockResponse(updated));

    const result = await updateEntry('c1', 'e1', partial);

    expect(apiFetchSpy).toHaveBeenCalledWith('/api/calendars/c1/entries/e1', {
      method: 'PUT',
      body: JSON.stringify(partial),
    });
    expect(result).toEqual(updated);
  });

  it('lanza ApiError si la respuesta no es ok', async () => {
    vi.spyOn(apiFetchModule, 'apiFetch').mockResolvedValue(mockResponse({}, false, 400));

    await expect(updateEntry('c1', 'e1', { title: 'x' })).rejects.toThrow(ApiError);
  });
});

describe('confirmCalendar', () => {
  it('llama apiFetch con POST .../confirm y retorna el JSON parseado', async () => {
    const confirmed = {
      id: 'c1',
      name: null,
      start_date: '2026-08-03',
      end_date: '2026-08-09',
      frequency: 3,
      status: 'confirmed',
    };
    const apiFetchSpy = vi
      .spyOn(apiFetchModule, 'apiFetch')
      .mockResolvedValue(mockResponse(confirmed));

    const result = await confirmCalendar('c1');

    expect(apiFetchSpy).toHaveBeenCalledWith('/api/calendars/c1/confirm', { method: 'POST' });
    expect(result).toEqual(confirmed);
  });

  it('lanza ApiError si la respuesta no es ok', async () => {
    vi.spyOn(apiFetchModule, 'apiFetch').mockResolvedValue(mockResponse({}, false, 409));

    await expect(confirmCalendar('c1')).rejects.toThrow(ApiError);
  });
});

describe('deleteCalendar', () => {
  it('llama apiFetch con DELETE /api/calendars/{id}', async () => {
    const apiFetchSpy = vi
      .spyOn(apiFetchModule, 'apiFetch')
      .mockResolvedValue(mockResponse(null, true, 204));

    await deleteCalendar('c1');

    expect(apiFetchSpy).toHaveBeenCalledWith('/api/calendars/c1', { method: 'DELETE' });
  });

  it('lanza ApiError si la respuesta no es ok', async () => {
    vi.spyOn(apiFetchModule, 'apiFetch').mockResolvedValue(mockResponse({}, false, 409));

    await expect(deleteCalendar('c1')).rejects.toThrow(ApiError);
  });
});
