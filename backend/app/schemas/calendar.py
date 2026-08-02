# Fase 3: Esquemas Pydantic para calendarios de contenido
from datetime import date

from pydantic import BaseModel


class CalendarGenerateRequest(BaseModel):
    frequency: int  # posts por semana: 3, 5 o 7
    period: str  # "current_week" | "next_week" | "month"
    formats: dict | None = None  # {"short_video": 3, "carousel": 1, "story": 1}


class EntryUpdate(BaseModel):
    title: str | None = None
    hook: str | None = None
    description: str | None = None
    format: str | None = None
    platform: str | None = None
    status: str | None = None
    time_slot: str | None = None


class CalendarResponse(BaseModel):
    id: str
    name: str
    start_date: date
    end_date: date
    frequency: int
    status: str
