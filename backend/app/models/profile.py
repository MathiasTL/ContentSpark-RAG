# Modelos CreatorProfile y SocialAccount
import uuid

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class CreatorProfile(Base, TimestampMixin):
    __tablename__ = "creator_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    niche: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sub_niche: Mapped[str | None] = mapped_column(String(100), nullable=True)
    primary_goal: Mapped[str | None] = mapped_column(String(255), nullable=True)
    tone: Mapped[str | None] = mapped_column(String(100), nullable=True)
    target_audience: Mapped[str | None] = mapped_column(Text, nullable=True)
    current_frequency: Mapped[str | None] = mapped_column(String(50), nullable=True)
    desired_frequency: Mapped[str | None] = mapped_column(String(50), nullable=True)
    preferred_formats: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Relaciones
    user: Mapped["User"] = relationship(back_populates="profile")
    social_accounts: Mapped[list["SocialAccount"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan"
    )


class SocialAccount(Base):
    __tablename__ = "social_accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("creator_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    platform: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # tiktok, instagram, youtube, linkedin, x
    handle: Mapped[str] = mapped_column(String(255), nullable=False)
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    follower_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    added_at: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )

    # Relaciones
    profile: Mapped["CreatorProfile"] = relationship(back_populates="social_accounts")
