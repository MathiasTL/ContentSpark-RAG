import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as profileApi from '../services/profile-api';
import { ApiError } from '@/shared/lib/api-fetch';
import { useProfileStore } from './profileStore';

function resetStore() {
  useProfileStore.setState({ profile: null, isLoading: false, error: null });
}

beforeEach(() => {
  resetStore();
  vi.restoreAllMocks();
});

const fakeProfile = {
  id: '1',
  user_id: 'u1',
  display_name: null,
  bio: null,
  niche: 'marketing',
  sub_niche: null,
  primary_goal: 'crecer',
  tone: 'cercano',
  target_audience: 'emprendedores',
  current_frequency: null,
  desired_frequency: null,
  preferred_formats: [],
  timezone: null,
  social_accounts: [],
};

describe('load', () => {
  it('setea isLoading true y luego false, poblando profile', async () => {
    let resolveGetProfile: (value: typeof fakeProfile) => void;
    const getProfilePromise = new Promise<typeof fakeProfile>((resolve) => {
      resolveGetProfile = resolve;
    });
    vi.spyOn(profileApi, 'getProfile').mockReturnValue(getProfilePromise);

    const loadPromise = useProfileStore.getState().load();

    expect(useProfileStore.getState().isLoading).toBe(true);

    resolveGetProfile!(fakeProfile);
    await loadPromise;

    const state = useProfileStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.profile).toEqual(fakeProfile);
    expect(state.error).toBeNull();
  });

  it('setea error y deja isLoading false si getProfile falla', async () => {
    vi.spyOn(profileApi, 'getProfile').mockRejectedValue(new ApiError(500, 'boom'));

    await useProfileStore.getState().load();

    const state = useProfileStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeTruthy();
    expect(state.profile).toBeNull();
  });
});

describe('save', () => {
  it('llama updateProfile y refresca profile en éxito', async () => {
    const updated = { ...fakeProfile, bio: 'Nueva bio' };
    const updateProfileSpy = vi
      .spyOn(profileApi, 'updateProfile')
      .mockResolvedValue(updated);

    await useProfileStore.getState().save({ bio: 'Nueva bio' });

    expect(updateProfileSpy).toHaveBeenCalledWith({ bio: 'Nueva bio' });
    const state = useProfileStore.getState();
    expect(state.profile).toEqual(updated);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('setea error si updateProfile falla', async () => {
    vi.spyOn(profileApi, 'updateProfile').mockRejectedValue(new ApiError(400, 'boom'));

    await expect(
      useProfileStore.getState().save({ bio: 'x' }),
    ).rejects.toThrow();

    const state = useProfileStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeTruthy();
  });
});
