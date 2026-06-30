"""add_missed_to_existing_jobs_immediate_on

Revision ID: 20260630000000
Revises: 20260626120000
Create Date: 2026-06-30 00:00:00

Backfill: add 'missed' to immediate_on for existing jobs that don't have it.
Needed because A1 (overdue detection) introduced 'missed' as a new status —
jobs created before A1 only had 'failure' in immediate_on by default.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "20260630000000"
down_revision: Union[str, None] = "20260626120000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Only backfill jobs that already opted into immediate alerts (array non-empty).
    # Jobs with immediate_on = '{}' deliberately have no notifications — leave them alone.
    op.execute("""
        UPDATE jobs
        SET immediate_on = array_append(immediate_on, 'missed')
        WHERE immediate_on IS NOT NULL
          AND array_length(immediate_on, 1) > 0
          AND NOT ('missed' = ANY(immediate_on))
    """)


def downgrade() -> None:
    op.execute("""
        UPDATE jobs
        SET immediate_on = array_remove(immediate_on, 'missed')
        WHERE immediate_on IS NOT NULL
          AND 'missed' = ANY(immediate_on)
    """)
