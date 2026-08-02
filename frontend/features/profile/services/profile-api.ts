import { apiFetch, ApiError } from "@/shared/lib/api-fetch";

export interface SocialAccount {
  platform: string;
  handle: string;
  url: string | null;
  follower_count: number | null;
}

export interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  bio: string | null;
  niche: string | null;
  sub_niche: string | null;
  primary_goal: string | null;
  tone: string | null;
  target_audience: string | null;
  current_frequency: string | null;
  desired_frequency: string | null;
  preferred_formats: string[];
  social_accounts: SocialAccount[];
}

export interface ProfileStatus {
  is_complete: boolean;
  missing_fields: string[];
}

export interface ProfileOnboardingInput {
  display_name?: string | null;
  bio?: string | null;
  niche: string;
  sub_niche?: string | null;
  primary_goal: string;
  tone: string;
  target_audience: string;
  current_frequency?: string | null;
  desired_frequency?: string | null;
  preferred_formats?: string[];
  social_accounts?: SocialAccount[];
}

export interface ProfileUpdateInput {
  display_name?: string | null;
  bio?: string | null;
  niche?: string | null;
  sub_niche?: string | null;
  primary_goal?: string | null;
  tone?: string | null;
  target_audience?: string | null;
  current_frequency?: string | null;
  desired_frequency?: string | null;
  preferred_formats?: string[] | null;
}

async function ensureOk(response: Response, action: string): Promise<void> {
  if (response.ok) return;
  throw new ApiError(response.status, `${action} fallo con status ${response.status}`);
}

export async function getProfile(): Promise<Profile> {
  const response = await apiFetch("/api/profile", { method: "GET" });
  await ensureOk(response, "getProfile");
  return response.json();
}

export async function updateProfile(partial: ProfileUpdateInput): Promise<Profile> {
  const response = await apiFetch("/api/profile", {
    method: "PUT",
    body: JSON.stringify(partial),
  });
  await ensureOk(response, "updateProfile");
  return response.json();
}

export async function submitOnboarding(payload: ProfileOnboardingInput): Promise<Profile> {
  const response = await apiFetch("/api/profile/onboarding", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  await ensureOk(response, "submitOnboarding");
  return response.json();
}

export async function getProfileStatus(): Promise<ProfileStatus> {
  const response = await apiFetch("/api/profile/status", { method: "GET" });
  await ensureOk(response, "getProfileStatus");
  return response.json();
}
