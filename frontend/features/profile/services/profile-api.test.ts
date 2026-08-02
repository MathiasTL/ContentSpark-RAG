import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiFetchModule from '@/shared/lib/api-fetch';
import { ApiError } from '@/shared/lib/api-fetch';
import {
  getProfile,
  getProfileStatus,
  submitOnboarding,
  updateProfile,
} from './profile-api';

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

describe('getProfile', () => {
  it('llama apiFetch con GET /api/profile y retorna el JSON parseado', async () => {
    const profile = { id: '1', user_id: 'u1', niche: null };
    const apiFetchSpy = vi
      .spyOn(apiFetchModule, 'apiFetch')
      .mockResolvedValue(mockResponse(profile));

    const result = await getProfile();

    expect(apiFetchSpy).toHaveBeenCalledWith('/api/profile', { method: 'GET' });
    expect(result).toEqual(profile);
  });

  it('lanza ApiError si la respuesta no es ok', async () => {
    vi.spyOn(apiFetchModule, 'apiFetch').mockResolvedValue(mockResponse({}, false, 500));

    await expect(getProfile()).rejects.toThrow(ApiError);
  });
});

describe('updateProfile', () => {
  it('llama apiFetch con PUT /api/profile y el body dado', async () => {
    const partial = { bio: 'Nueva bio' };
    const updated = { id: '1', user_id: 'u1', bio: 'Nueva bio' };
    const apiFetchSpy = vi
      .spyOn(apiFetchModule, 'apiFetch')
      .mockResolvedValue(mockResponse(updated));

    const result = await updateProfile(partial);

    expect(apiFetchSpy).toHaveBeenCalledWith('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(partial),
    });
    expect(result).toEqual(updated);
  });

  it('lanza ApiError si la respuesta no es ok', async () => {
    vi.spyOn(apiFetchModule, 'apiFetch').mockResolvedValue(mockResponse({}, false, 400));

    await expect(updateProfile({ bio: 'x' })).rejects.toThrow(ApiError);
  });
});

describe('submitOnboarding', () => {
  it('llama apiFetch con POST /api/profile/onboarding y el payload dado', async () => {
    const payload = {
      niche: 'marketing',
      primary_goal: 'crecer',
      tone: 'cercano',
      target_audience: 'emprendedores',
    };
    const created = { id: '1', user_id: 'u1', ...payload };
    const apiFetchSpy = vi
      .spyOn(apiFetchModule, 'apiFetch')
      .mockResolvedValue(mockResponse(created));

    const result = await submitOnboarding(payload);

    expect(apiFetchSpy).toHaveBeenCalledWith('/api/profile/onboarding', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    expect(result).toEqual(created);
  });

  it('lanza ApiError si la respuesta no es ok', async () => {
    vi.spyOn(apiFetchModule, 'apiFetch').mockResolvedValue(mockResponse({}, false, 422));

    await expect(
      submitOnboarding({
        niche: 'x',
        primary_goal: 'x',
        tone: 'x',
        target_audience: 'x',
      }),
    ).rejects.toThrow(ApiError);
  });
});

describe('getProfileStatus', () => {
  it('llama apiFetch con GET /api/profile/status y retorna el JSON parseado', async () => {
    const status = { is_complete: false, missing_fields: ['niche'] };
    const apiFetchSpy = vi
      .spyOn(apiFetchModule, 'apiFetch')
      .mockResolvedValue(mockResponse(status));

    const result = await getProfileStatus();

    expect(apiFetchSpy).toHaveBeenCalledWith('/api/profile/status', { method: 'GET' });
    expect(result).toEqual(status);
  });

  it('lanza ApiError si la respuesta no es ok', async () => {
    vi.spyOn(apiFetchModule, 'apiFetch').mockResolvedValue(mockResponse({}, false, 500));

    await expect(getProfileStatus()).rejects.toThrow(ApiError);
  });
});
