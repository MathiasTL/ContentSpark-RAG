export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  onboardingCompleted: boolean;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}
