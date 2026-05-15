"""drop_users_onboarding_completed

Revision ID: e7f16d584e97
Revises: 04bb76c6e29f
Create Date: 2026-05-15 09:18:42.248558

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7f16d584e97'
down_revision: Union[str, Sequence[str], None] = '04bb76c6e29f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("users", "onboarding_completed")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "onboarding_completed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
