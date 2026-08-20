# Fase 3: Esquemas Pydantic para calendarios de contenido
import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

FormatLiteral = Literal["short_video", "carousel", "story", "long_video", "post"]
PlatformLiteral = Literal["tiktok", "instagram", "youtube", "linkedin", "x"]
PeriodLiteral = Literal["current_week", "next_week", "month"]
EntryStatusLiteral = Literal["idea", "drafted", "recorded", "published"]
# calendar_agent.TIME_SLOTS: etiquetas semanticas ("morning"/"afternoon"/
# "evening"), NUNCA horas de reloj (design.md). Tipar el schema como
# Literal cierra permanentemente la via de corrupcion en la que un
# `PUT /entries/{id}` con un valor tipo "09:00" (proveniente de un
# `<input type="time">`) se colaba a la columna sin validacion.
TimeSlotLiteral = Literal["morning", "afternoon", "evening"]


class CalendarGenerateRequest(BaseModel):
    period: PeriodLiteral
    frequency: int | None = Field(default=None, ge=1, le=14)
    formats: dict[FormatLiteral, int] | None = None
    calendar_id: str | None = None

    @field_validator("formats")
    @classmethod
    def _validate_formats(
        cls, value: dict[str, int] | None
    ) -> dict[str, int] | None:
        """Per-value ge=0 (a negative count reaches target_count = sum(...)
        and slices weirdly downstream) and a total cap of 14, matching
        `frequency`'s upper bound."""
        if value is None:
            return value
        if any(count < 0 for count in value.values()):
            raise ValueError("formats values must be >= 0")
        if sum(value.values()) > 14:
            raise ValueError("sum(formats.values()) must be <= 14")
        return value


class EntryUpdate(BaseModel):
    title: str | None = None
    hook: str | None = None
    description: str | None = None
    format: FormatLiteral | None = None
    platform: PlatformLiteral | None = None
    status: EntryStatusLiteral | None = None
    time_slot: TimeSlotLiteral | None = None


class EntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    calendar_id: str
    date: date
    time_slot: TimeSlotLiteral | None = None
    title: str
    format: str
    platform: str
    hook: str | None = None
    description: str | None = None
    status: str
    google_calendar_event_id: str | None = None

    @field_validator("id", "calendar_id", mode="before")
    @classmethod
    def _stringify_uuid(cls, value: object) -> object:
        return str(value) if isinstance(value, uuid.UUID) else value


class CalendarResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str | None = None
    start_date: date
    end_date: date
    frequency: int
    status: str

    @field_validator("id", mode="before")
    @classmethod
    def _stringify_uuid(cls, value: object) -> object:
        return str(value) if isinstance(value, uuid.UUID) else value


class CalendarDetailResponse(CalendarResponse):
    entries: list[EntryResponse] = []


class CalendarStatusError(BaseModel):
    detail: str
    missing_fields: list[str]
