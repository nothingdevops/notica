"""phase4_schedules

Revision ID: 20260626120000
Revises: 20260626095350
Create Date: 2026-06-26 12:00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "20260626120000"
down_revision: Union[str, None] = "20260626095350"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "schedules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("cron_expr", sa.String(100), nullable=False),
        sa.Column(
            "contacts",
            postgresql.ARRAY(postgresql.UUID(as_uuid=True)),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_table(
        "schedule_executions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "schedule_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("schedules.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("fired_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_schedule_executions_schedule_id",
        "schedule_executions",
        ["schedule_id"],
    )
    op.create_index(
        "ix_schedule_executions_fired_at",
        "schedule_executions",
        ["fired_at"],
        postgresql_ops={"fired_at": "DESC"},
    )


def downgrade() -> None:
    op.drop_table("schedule_executions")
    op.drop_table("schedules")
