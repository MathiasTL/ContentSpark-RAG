"""init: users, profiles, chats, calendars

Revision ID: 04bb76c6e29f
Revises:
Create Date: 2026-03-31 23:56:14.957443

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '04bb76c6e29f'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Crear todas las tablas iniciales."""

    # --- users ---
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("onboarding_completed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )

    # --- creator_profiles ---
    op.create_table(
        "creator_profiles",
        sa.Column("id", sa.Uuid(), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("niche", sa.String(100), nullable=True),
        sa.Column("sub_niche", sa.String(100), nullable=True),
        sa.Column("primary_goal", sa.String(255), nullable=True),
        sa.Column("tone", sa.String(100), nullable=True),
        sa.Column("target_audience", sa.Text(), nullable=True),
        sa.Column("current_frequency", sa.String(50), nullable=True),
        sa.Column("desired_frequency", sa.String(50), nullable=True),
        sa.Column("preferred_formats", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )

    # --- social_accounts ---
    op.create_table(
        "social_accounts",
        sa.Column("id", sa.Uuid(), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("profile_id", sa.Uuid(), nullable=False),
        sa.Column("platform", sa.String(50), nullable=False),
        sa.Column("handle", sa.String(255), nullable=False),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("follower_count", sa.Integer(), nullable=True),
        sa.Column("added_at", sa.String(50), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["profile_id"], ["creator_profiles.id"], ondelete="CASCADE"),
    )

    # --- chats ---
    op.create_table(
        "chats",
        sa.Column("id", sa.Uuid(), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(255), nullable=True),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )

    # --- messages ---
    op.create_table(
        "messages",
        sa.Column("id", sa.Uuid(), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("chat_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.String(10), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("sources", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["chat_id"], ["chats.id"], ondelete="CASCADE"),
    )

    # --- content_calendars ---
    op.create_table(
        "content_calendars",
        sa.Column("id", sa.Uuid(), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("frequency", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'draft'")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )

    # --- content_entries ---
    op.create_table(
        "content_entries",
        sa.Column("id", sa.Uuid(), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("calendar_id", sa.Uuid(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("time_slot", sa.String(20), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("format", sa.String(50), nullable=False),
        sa.Column("platform", sa.String(50), nullable=False),
        sa.Column("hook", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'idea'")),
        sa.Column("google_calendar_event_id", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["calendar_id"], ["content_calendars.id"], ondelete="CASCADE"),
    )

    # Indices para queries frecuentes
    op.create_index("ix_chats_user_id", "chats", ["user_id"])
    op.create_index("ix_messages_chat_id", "messages", ["chat_id"])
    op.create_index("ix_content_entries_calendar_id", "content_entries", ["calendar_id"])
    op.create_index("ix_content_entries_date", "content_entries", ["date"])


def downgrade() -> None:
    """Eliminar todas las tablas."""
    op.drop_index("ix_content_entries_date", table_name="content_entries")
    op.drop_index("ix_content_entries_calendar_id", table_name="content_entries")
    op.drop_index("ix_messages_chat_id", table_name="messages")
    op.drop_index("ix_chats_user_id", table_name="chats")
    op.drop_table("content_entries")
    op.drop_table("content_calendars")
    op.drop_table("messages")
    op.drop_table("chats")
    op.drop_table("social_accounts")
    op.drop_table("creator_profiles")
    op.drop_table("users")
