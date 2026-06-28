import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    expected_cron: Mapped[str | None] = mapped_column(String(100), nullable=True)
    grace_period: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    tags: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    immediate_on: Mapped[list] = mapped_column(
        ARRAY(String), default=list, nullable=False, server_default="{}"
    )
    immediate_contacts: Mapped[list] = mapped_column(
        ARRAY(UUID(as_uuid=True)), default=list, nullable=False, server_default="{}"
    )
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now(), onupdate=func.now()
    )

    alerts: Mapped[list["Alert"]] = relationship(  # noqa: F821
        "Alert", back_populates="job", cascade="all, delete-orphan"
    )
