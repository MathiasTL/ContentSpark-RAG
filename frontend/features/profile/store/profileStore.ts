import { create } from "zustand";
import type { Profile, ProfileUpdateInput } from "../services/profile-api";
import * as profileApi from "../services/profile-api";

export interface ProfileState {
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;
  // Flag transitorio: true justo después de un save() exitoso, para que
  // ProfileForm muestre una confirmación. Se limpia al iniciar cualquier
  // load()/save() nuevo, o cuando el formulario vuelve a editarse
  // (ver clearSaveSuccess, invocado desde updateField/toggleFormat/
  // addSocialAccount/removeSocialAccount).
  saveSuccess: boolean;

  load: () => Promise<void>;
  save: (partial: ProfileUpdateInput) => Promise<void>;
  clearSaveSuccess: () => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  isLoading: false,
  error: null,
  saveSuccess: false,

  load: async () => {
    set({ isLoading: true, error: null, saveSuccess: false });
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
    set({ isLoading: true, error: null, saveSuccess: false });
    try {
      const profile = await profileApi.updateProfile(partial);
      set({ profile, isLoading: false, error: null, saveSuccess: true });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "No se pudo guardar el perfil",
      });
      throw err;
    }
  },

  clearSaveSuccess: () => set({ saveSuccess: false }),
}));
