"""initial_schema

Revision ID: 20260626095350
Revises:
Create Date: 2026-06-26 09:53:50

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260626095350"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("token", sa.String(64), nullable=False),
        sa.Column("expected_cron", sa.String(100), nullable=True),
        sa.Column("grace_period", sa.Integer, nullable=False, server_default="30"),
        sa.Column("tags", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column(
            "immediate_on",
            postgresql.ARRAY(sa.String),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "immediate_contacts",
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
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_jobs_name", "jobs", ["name"], unique=True)
    op.create_index("ix_jobs_token", "jobs", ["token"], unique=True)

    op.create_table(
        "contacts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("config", postgresql.JSONB, nullable=False),
        sa.Column("active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_table(
        "alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "job_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("job_name", sa.String(255), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("completion_time", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("duration_sec", sa.Integer, nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("log_content", sa.Text, nullable=True),
        sa.Column("tags", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column(
            "received_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_alerts_job_id", "alerts", ["job_id"])
    op.create_index("ix_alerts_job_name", "alerts", ["job_name"])
    op.create_index("ix_alerts_status", "alerts", ["status"])
    op.create_index("ix_alerts_received_at", "alerts", ["received_at"])

    op.create_table(
        "settings",
        sa.Column("key", sa.String(100), primary_key=True),
        sa.Column("value", postgresql.JSONB, nullable=False),
    )

    # Seed default settings
    op.execute("INSERT INTO settings (key, value) VALUES ('retention_days', '90')")


def downgrade() -> None:
    op.drop_table("alerts")
    op.drop_table("settings")
    op.drop_table("contacts")
    op.drop_table("jobs")
