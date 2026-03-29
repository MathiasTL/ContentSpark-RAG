export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  name: string;
}

export interface AuthState {
  user: { id: string; email: string; name: string } | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}
