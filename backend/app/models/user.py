# Modelo User — sincronizado con Supabase Auth
import uuid

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    onboarding_completed: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    # Relaciones
    profile: Mapped["CreatorProfile"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    chats: Mapped[list["Chat"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    calendars: Mapped[list["ContentCalendar"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
