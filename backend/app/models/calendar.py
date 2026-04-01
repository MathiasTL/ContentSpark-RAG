# Modelos ContentCalendar y ContentEntry
import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class ContentCalendar(Base, TimestampMixin):
    __tablename__ = "content_calendars"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    frequency: Mapped[int] = mapped_column(
        Integer, nullable=False
    )  # Posts por semana
    status: Mapped[str] = mapped_column(
        String(20), default="draft", nullable=False
    )  # draft, confirmed, synced

    # Relaciones
    user: Mapped["User"] = relationship(back_populates="calendars")
    entries: Mapped[list["ContentEntry"]] = relationship(
        back_populates="calendar", cascade="all, delete-orphan", order_by="ContentEntry.date"
    )


class ContentEntry(Base, TimestampMixin):
    __tablename__ = "content_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    calendar_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("content_calendars.id", ondelete="CASCADE"),
        nullable=False,
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    time_slot: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )  # morning, afternoon, evening
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    format: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # short_video, carousel, story, long_video, post
    platform: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # tiktok, instagram, youtube, linkedin
    hook: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="idea", nullable=False
    )  # idea, drafted, recorded, published
    google_calendar_event_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )

    # Relaciones
    calendar: Mapped["ContentCalendar"] = relationship(back_populates="entries")
