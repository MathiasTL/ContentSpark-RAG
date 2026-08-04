# Fase 3: Esquemas Pydantic para calendarios de contenido
from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

FormatLiteral = Literal["short_video", "carousel", "story", "long_video", "post"]
PlatformLiteral = Literal["tiktok", "instagram", "youtube", "linkedin", "x"]
PeriodLiteral = Literal["current_week", "next_week", "month"]
EntryStatusLiteral = Literal["idea", "drafted", "recorded", "published"]


class CalendarGenerateRequest(BaseModel):
    period: PeriodLiteral
    frequency: int | None = Field(default=None, ge=1, le=14)
    formats: dict[FormatLiteral, int] | None = None
    calendar_id: str | None = None


class EntryUpdate(BaseModel):
    title: str | None = None
    hook: str | None = None
    description: str | None = None
    format: FormatLiteral | None = None
    platform: PlatformLiteral | None = None
    status: EntryStatusLiteral | None = None
    time_slot: str | None = None


class EntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    calendar_id: str
    date: date
    time_slot: str | None = None
    title: str
    format: str
    platform: str
    hook: str | None = None
    description: str | None = None
    status: str
    google_calendar_event_id: str | None = None


class CalendarResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str | None = None
    start_date: date
    end_date: date
    frequency: int
    status: str


class CalendarDetailResponse(CalendarResponse):
    entries: list[EntryResponse] = []


class CalendarStatusError(BaseModel):
    detail: str
    missing_fields: list[str]
