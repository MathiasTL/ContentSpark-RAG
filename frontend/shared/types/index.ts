export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

// La completitud del onboarding NO vive acá: se deriva en el servidor a partir
// del perfil y se consume desde GET /api/profile/status como
// ProfileStatusResponse. Ver features/profile/services/profile-api.ts.

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}
