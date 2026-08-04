import { apiFetch, ApiError } from "@/shared/lib/api-fetch";

export interface EntryItem {
  id: string;
  calendar_id: string;
  date: string;
  time_slot: string | null;
  title: string;
  format: string;
  platform: string;
  hook: string | null;
  description: string | null;
  status: string;
  google_calendar_event_id: string | null;
}

export interface CalendarItem {
  id: string;
  name: string | null;
  start_date: string;
  end_date: string;
  frequency: number;
  status: string;
}

export interface CalendarDetail extends CalendarItem {
  entries: EntryItem[];
}

export interface GenerateInput {
  period: "current_week" | "next_week" | "month";
  frequency?: number;
  formats?: Record<string, number>;
  calendar_id?: string;
}

export interface EntryUpdateInput {
  title?: string;
  hook?: string;
  description?: string;
  format?: string;
  platform?: string;
  status?: string;
  time_slot?: string;
}

async function ensureOk(response: Response, action: string): Promise<void> {
  if (response.ok) return;
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  throw new ApiError(response.status, `${action} fallo con status ${response.status}`, body);
}

export async function getCalendars(): Promise<CalendarItem[]> {
  const response = await apiFetch("/api/calendars", { method: "GET" });
  await ensureOk(response, "getCalendars");
  return response.json();
}

export async function getCalendar(id: string): Promise<CalendarDetail> {
  const response = await apiFetch(`/api/calendars/${id}`, { method: "GET" });
  await ensureOk(response, "getCalendar");
  return response.json();
}

export async function generateCalendar(input: GenerateInput): Promise<CalendarDetail> {
  const response = await apiFetch("/api/calendar/generate", {
    method: "POST",
    body: JSON.stringify(input),
  });
  await ensureOk(response, "generateCalendar");
  return response.json();
}

export async function updateEntry(
  calendarId: string,
  entryId: string,
  partial: EntryUpdateInput,
): Promise<EntryItem> {
  const response = await apiFetch(`/api/calendars/${calendarId}/entries/${entryId}`, {
    method: "PUT",
    body: JSON.stringify(partial),
  });
  await ensureOk(response, "updateEntry");
  return response.json();
}

export async function confirmCalendar(id: string): Promise<CalendarItem> {
  const response = await apiFetch(`/api/calendars/${id}/confirm`, { method: "POST" });
  await ensureOk(response, "confirmCalendar");
  return response.json();
}

export async function deleteCalendar(id: string): Promise<void> {
  const response = await apiFetch(`/api/calendars/${id}`, { method: "DELETE" });
  await ensureOk(response, "deleteCalendar");
}
