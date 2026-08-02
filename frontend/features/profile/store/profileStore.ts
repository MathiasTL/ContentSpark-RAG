import { create } from "zustand";
import type { Profile, ProfileUpdateInput } from "../services/profile-api";
import * as profileApi from "../services/profile-api";

export interface ProfileState {
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;

  load: () => Promise<void>;
  save: (partial: ProfileUpdateInput) => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  isLoading: false,
  error: null,

  load: async () => {
    set({ isLoading: true, error: null });
    try {
      const profile = await profileApi.getProfile();
      set({ profile, isLoading: false, error: null });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "No se pudo cargar el perfil",
      });
    }
  },

  save: async (partial) => {
    set({ isLoading: true, error: null });
    try {
      const profile = await profileApi.updateProfile(partial);
      set({ profile, isLoading: false, error: null });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "No se pudo guardar el perfil",
      });
      throw err;
    }
  },
}));
