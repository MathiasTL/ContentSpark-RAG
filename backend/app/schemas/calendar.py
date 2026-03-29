# Fase 3: Esquemas Pydantic para calendarios de contenido
from pydantic import BaseModel
from typing import Optional, List
from datetime import date


class CalendarGenerateRequest(BaseModel):
    frequency: int  # posts por semana: 3, 5 o 7
    period: str  # "current_week" | "next_week" | "month"
    formats: Optional[dict] = None  # {"short_video": 3, "carousel": 1, "story": 1}


class EntryUpdate(BaseModel):
    title: Optional[str] = None
    hook: Optional[str] = None
    description: Optional[str] = None
    format: Optional[str] = None
    platform: Optional[str] = None
    status: Optional[str] = None
    time_slot: Optional[str] = None


class CalendarResponse(BaseModel):
    id: str
    name: str
    start_date: date
    end_date: date
    frequency: int
    status: str
